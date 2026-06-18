# FreshGuard Supply Platform: Google SQL Database Blueprint
### Enterprise Relational Database Schema & System Architecture Documentation

This document specifies the professional-grade relational database layout for the **FreshGuard Supply Platform** enterprise ecosystem. The schemas are fully optimized for **Google Cloud SQL for PostgreSQL**, ensuring robust telemetry reconciliation, strict contractual compliance, real-time IoT logging, and modular audit trails.

---

## SYSTEM ARCHITECTURE OVERVIEW

The FreshGuard storage subsystem separates core concerns into logical boundaries to preserve transactional performance under heavy real-time feed loads:

```
+-------------------------------------------------------------+
|               CORE SYSTEM MODERATION AREA                   |
|                  (users & organizations)                     |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|               SOURCING & PROCUREMENTS AREA                  |
|          (purchase_requirements & vendor_bids)              |
+------------------------------+------------------------------+
                               |
                               v
+------------------------------+------------------------------+
|               CONTRACTUAL & LEGAL LEVERAGE AREA              |
|             (sla_agreements & purchase_orders)              |
+------------------------------+------------------------------+
                              / \
                             /   \
                            v     v
+----------------------------+   +----------------------------+
|   TRACKING & TELEMETRY     |   |   INTELLIGATION QC & COLD  |
| (shipment_telemetry_logs)  |   | (ai_qc_inspections, splits,|
|                            |   |  vendor_claims_disputes)   |
+----------------------------+   +----------------------------+
```

To support auto-updating timestamps (`updated_at`), we declare a shared trigger helper function at the initialization phase:

```sql
-- Initialization Trigger Helper for automatic updated_at timestamping
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
```

---

## 1. CORE SYSTEM MODERATION AREA

### Table 1: `organizations`
#### Architectural Explanation
The `organizations` table represents corporate legal entities acting as either Buyers, Suppliers (Vendors), or third-party Cold-Chain carrier services. This design acts as the root master data boundary for billing, legal accountability, and logistical origination.

#### DDL Schema
```sql
DROP TABLE IF EXISTS organizations CASCADE;

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registered_name VARCHAR(255) NOT NULL UNIQUE,
    tax_identifier VARCHAR(100) NOT NULL UNIQUE,
    organization_type VARCHAR(50) NOT NULL CHECK (organization_type IN ('BUYER', 'VENDOR', 'CARRIER')),
    headquarters_address TEXT NOT NULL,
    primary_contact_email VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for lookup speed and tax reporting
CREATE INDEX idx_organizations_type ON organizations(organization_type);
CREATE INDEX idx_organizations_tax_id ON organizations(tax_identifier);

-- Update Trigger
CREATE TRIGGER update_organizations_modtime
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique corporate identifier. |
| `registered_name` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | Registered legal enterprise name. |
| `tax_identifier` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | State-level tax registry number. |
| `organization_type` | `VARCHAR(50)` | `NOT NULL`, check constraint | Categorizes role scope on the platform inside system. |
| `headquarters_address` | `TEXT` | `NOT NULL` | Physical headquarters registration address. |
| `primary_contact_email`| `VARCHAR(255)` | `NOT NULL` | Main administration contact point. |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Toggle indicating if organization retains platform access. |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Extensible key-value storage for extra corporate data. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

### Table 2: `users`
#### Architectural Explanation
The `users` table handles actor authentication, cryptographic password hashes, salt references, and system-level access routing controls. Roles explicitly govern accessible dashboard templates ('Buyer', 'Vendor', 'Supply Admin').

#### DDL Schema
```sql
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    routing_role VARCHAR(50) NOT NULL CHECK (routing_role IN ('Buyer', 'Vendor', 'Supply Admin')),
    phone_number VARCHAR(50),
    is_mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(100),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_organization FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexing for fast authentication lookup and routing filter
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_role ON users(routing_role);

-- Update Trigger
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Unique human platform user identifier. |
| `organization_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Association back to their corporate root record. |
| `full_name` | `VARCHAR(150)` | `NOT NULL` | Complete naming identifier. |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | User login email address. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Crypto-secure salted hash representation of password. |
| `routing_role` | `VARCHAR(50)` | `NOT NULL`, check constraint | RBAC value governing interface permissions and view routing. |
| `phone_number` | `VARCHAR(50)` | Nullable | Optional mobile contact for alert routing. |
| `is_mfa_enabled` | `BOOLEAN` | `NOT NULL DEFAULT FALSE`| Multi-Factor Authentication enforcement switch. |
| `mfa_secret` | `VARCHAR(100)` | Nullable | Encrypted multi-factor seed block. |
| `last_login_at` | `TIMESTAMP` | Nullable | Audit tracking for inactive credentials. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

## 2. SOURCING & PROCUREMENTS AREA

### Table 3: `purchase_requirements`
#### Architectural Explanation
The `purchase_requirements` table records incoming buyer requests for bulk perishable agricultural and logistics payloads (e.g. USDA-grade bulk dairy, fresh produce, meat lots). It tracks minimum standards, target volumes, and status.

#### DDL Schema
```sql
DROP TABLE IF EXISTS purchase_requirements CASCADE;

CREATE TABLE purchase_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_organization_id UUID NOT NULL,
    requirement_code VARCHAR(100) NOT NULL UNIQUE,
    commodity_category VARCHAR(100) NOT NULL CHECK (commodity_category IN ('Fresh Produce', 'Meat & Seafood', 'Dairy Lot')),
    sku_name VARCHAR(255) NOT NULL,
    target_volume_cases INT NOT NULL CHECK (target_volume_cases > 0),
    max_acceptable_temperature NUMERIC(5,2) NOT NULL,
    max_transit_duration_days NUMERIC(4,2) NOT NULL,
    bid_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_delivery_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'AWARDED', 'CANCELLED')),
    technical_specifications JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_req_buyer FOREIGN KEY (buyer_organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexing for procurement discovery
CREATE INDEX idx_req_buyer ON purchase_requirements(buyer_organization_id);
CREATE INDEX idx_req_code ON purchase_requirements(requirement_code);
CREATE INDEX idx_req_status_category ON purchase_requirements(status, commodity_category);

-- Update Trigger
CREATE TRIGGER update_purchase_requirements_modtime
    BEFORE UPDATE ON purchase_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | High-precision unique requirement ID. |
| `buyer_organization_id`| `UUID` | `NOT NULL`, `FOREIGN KEY` | Identifies which buyer organization published this requisition. |
| `requirement_code` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | User-facing identifier (e.g., `REQ-2026-003`). |
| `commodity_category` | `VARCHAR(100)` | `NOT NULL`, check constraint | Main department categorization. |
| `sku_name` | `VARCHAR(255)` | `NOT NULL` | Visual target item description (e.g., "Premium Whole Milk"). |
| `target_volume_cases` | `INT` | `NOT NULL > 0` | Physical container requirement size in custom units. |
| `max_acceptable_temperature` | `NUMERIC(5,2)`| `NOT NULL` | Strict thermal ceiling allowed under cold chain SLA (°C). |
| `max_transit_duration_days` | `NUMERIC(4,2)`| `NOT NULL` | Maximum shelf-life travel time allowed at fulfillment. |
| `bid_deadline` | `TIMESTAMP` | `NOT NULL` | Time cut-off when the bidding engine locks out incoming submissions. |
| `expected_delivery_date`| `TIMESTAMP` | `NOT NULL` | Delivery window deadline target date. |
| `status` | `VARCHAR(50)` | `NOT NULL DEFAULT 'OPEN'`| Lifecycle of open sourcing requisition. |
| `technical_specifications` | `JSONB` | `DEFAULT '{}'::jsonb`| Multi-spectral analysis thresholds or package specifications. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

### Table 4: `vendor_bids`
#### Architectural Explanation
The `vendor_bids` table represents commercial quotations submitted against active requirements by certified supplier corporate profiles. It captures pricing, logistics, security capability matrices, and split allocation selections.

#### DDL Schema
```sql
DROP TABLE IF EXISTS vendor_bids CASCADE;

CREATE TABLE vendor_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID NOT NULL,
    vendor_organization_id UUID NOT NULL,
    bid_reference_code VARCHAR(100) NOT NULL UNIQUE,
    case_rate_price NUMERIC(12,2) NOT NULL CHECK (case_rate_price > 0),
    max_cases_available INT NOT NULL CHECK (max_cases_available > 0),
    historical_quality_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    historical_otif_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    estimated_transit_days INT NOT NULL,
    selected_for_split BOOLEAN NOT NULL DEFAULT FALSE,
    allocated_cases INT DEFAULT 0,
    technical_compliance_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bid_requirement FOREIGN KEY (requirement_id)
        REFERENCES purchase_requirements(id) ON DELETE CASCADE,
    CONSTRAINT fk_bid_vendor FOREIGN KEY (vendor_organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexing for split-award algorithms
CREATE INDEX idx_bids_requirement ON vendor_bids(requirement_id);
CREATE INDEX idx_bids_vendor ON vendor_bids(vendor_organization_id);
CREATE INDEX idx_bids_split_selection ON vendor_bids(selected_for_split);

-- Update Trigger
CREATE TRIGGER update_vendor_bids_modtime
    BEFORE UPDATE ON vendor_bids
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | High-precision unique bid ID. |
| `requirement_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Reference linking back to requirement. |
| `vendor_organization_id`| `UUID` | `NOT NULL`, `FOREIGN KEY` | Identifies candidate supply partner. |
| `bid_reference_code` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | User-facing tracking label (e.g., `BID-506A-Z`). |
| `case_rate_price` | `NUMERIC(12,2)`| `NOT NULL > 0` | Dollar rate charged per physical case lot. |
| `max_cases_available` | `INT` | `NOT NULL > 0` | Absolute dispatch capacity cap of candidate supplier. |
| `historical_quality_score` | `NUMERIC(5,2)`| `NOT NULL` | Vendor historical AI QC pass rating (scaled 0-100). |
| `historical_otif_percentage` | `NUMERIC(5,2)`| `NOT NULL` | On-Time In-Full metrics. |
| `estimated_transit_days`| `INT` | `NOT NULL` | Predicted logistics timeline. |
| `selected_for_split` | `BOOLEAN` | `NOT NULL DEFAULT FALSE`| Split award binary indicator for multi-vendor sourcing. |
| `allocated_cases` | `INT` | `DEFAULT 0` | How many unit cases were awarded to this vendor. |
| `technical_compliance_metrics` | `JSONB` | `DEFAULT '{}'::jsonb`| Spectral verification, cold-carrier temperature test details. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

## 3. CONTRACTUAL & LEGAL LEVERAGE AREA

### Table 5: `sla_agreements`
#### Architectural Explanation
The `sla_agreements` table represents the binding legal performance contracts negotiated between buyers and suppliers. It models SLA boundaries, shipment quality tolerances, cold storage margins, and performance states.

#### DDL Schema
```sql
DROP TABLE IF EXISTS sla_agreements CASCADE;

CREATE TABLE sla_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID,
    vendor_organization_id UUID NOT NULL,
    buyer_organization_id UUID NOT NULL,
    contract_reference_code VARCHAR(100) NOT NULL UNIQUE,
    volume_commitment_bounds JSONB NOT NULL, -- e.g., {"min": 500, "max": 1200}
    compliance_baseline_window_hours INT NOT NULL,
    temperature_tolerance_celsius NUMERIC(4,2) NOT NULL,
    severity_chargeback_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.5,
    operational_state VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (operational_state IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'FULFILLED', 'TERMINATED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sla_requirement FOREIGN KEY (requirement_id)
        REFERENCES purchase_requirements(id) ON DELETE SET NULL,
    CONSTRAINT fk_sla_vendor FOREIGN KEY (vendor_organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_sla_buyer FOREIGN KEY (buyer_organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexing for active tracking
CREATE INDEX idx_sla_vendor ON sla_agreements(vendor_organization_id);
CREATE INDEX idx_sla_buyer ON sla_agreements(buyer_organization_id);
CREATE INDEX idx_sla_ref ON sla_agreements(contract_reference_code);
CREATE INDEX idx_sla_state ON sla_agreements(operational_state);

-- Update Trigger
CREATE TRIGGER update_sla_agreements_modtime
    BEFORE UPDATE ON sla_agreements
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Core SLA contract database identifier. |
| `requirement_id` | `UUID` | Nullable, `FOREIGN KEY` | Sourcing requirement source, if generated via bidding. |
| `vendor_organization_id`| `UUID` | `NOT NULL`, `FOREIGN KEY` | Sourcing execution provider. |
| `buyer_organization_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Sourcing execution recipient. |
| `contract_reference_code` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Legal contract ID (e.g., `CTR-2026-101`). |
| `volume_commitment_bounds` | `JSONB` | `NOT NULL` | Minimum and maximum scale quantities expected. |
| `compliance_baseline_window_hours`| `INT` | `NOT NULL` | Recovery window length to replace cargo breaches. |
| `temperature_tolerance_celsius`| `NUMERIC(4,2)`| `NOT NULL` | Margin of allowable thermal deviation. |
| `severity_chargeback_multiplier`| `NUMERIC(4,2)`| `NOT NULL DEFAULT 1.5` | Penalty multiple factor mapped to SKU price for breaches. |
| `operational_state` | `VARCHAR(50)` | `NOT NULL DEFAULT 'ACTIVE'`| Current legal and active state of contract. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

### Table 6: `purchase_orders`
#### Architectural Explanation
The `purchase_orders` table models active transactional orders placed against SLAs. It tracks shipments as they pass from dispatch to receipt, recording unit tracking variables and status.

#### DDL Schema
```sql
DROP TABLE IF EXISTS purchase_orders CASCADE;

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sla_agreement_id UUID NOT NULL,
    buyer_organization_id UUID NOT NULL,
    vendor_organization_id UUID NOT NULL,
    po_reference_number VARCHAR(100) NOT NULL UNIQUE,
    total_cases_shipped INT NOT NULL CHECK (total_cases_shipped > 0),
    agreed_case_rate NUMERIC(12,2) NOT NULL,
    scheduled_dispatch_date TIMESTAMPTZ NOT NULL,
    required_delivery_date TIMESTAMPTZ NOT NULL,
    actual_delivery_date TIMESTAMPTZ,
    lifecycle_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (lifecycle_status IN ('DRAFT', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'FULFILLED', 'REJECTED')),
    destination_dc_label VARCHAR(150) NOT NULL,
    carrier_organization_id UUID,
    tracking_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_po_sla FOREIGN KEY (sla_agreement_id)
        REFERENCES sla_agreements(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_buyer FOREIGN KEY (buyer_organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_carrier FOREIGN KEY (carrier_organization_id)
        REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexing for telemetry, carrier and transit tracking
CREATE INDEX idx_po_sla ON purchase_orders(sla_agreement_id);
CREATE INDEX idx_po_number ON purchase_orders(po_reference_number);
CREATE INDEX idx_po_status ON purchase_orders(lifecycle_status);
CREATE INDEX idx_po_dates ON purchase_orders(required_delivery_date, actual_delivery_date);

-- Update Trigger
CREATE TRIGGER update_purchase_orders_modtime
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Unique transaction ID. |
| `sla_agreement_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Reference back to SLA. |
| `buyer_organization_id`| `UUID` | `NOT NULL`, `FOREIGN KEY` | Target buying organization. |
| `vendor_organization_id`| `UUID` | `NOT NULL`, `FOREIGN KEY` | Dispatch organization shipping product. |
| `po_reference_number` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Human-readable PO number (e.g., `PO-2026-784A`). |
| `total_cases_shipped` | `INT` | `NOT NULL > 0` | Physical box count packed at vendor site. |
| `agreed_case_rate` | `NUMERIC(12,2)`| `NOT NULL` | Case rate unit price. |
| `scheduled_dispatch_date`| `TIMESTAMP`| `NOT NULL` | Projected dispatch time. |
| `required_delivery_date` | `TIMESTAMP`| `NOT NULL` | Deadline for arrival at distribution node. |
| `actual_delivery_date` | `TIMESTAMP`| Nullable | Timestamp logged when delivery gate scans complete at buyer site. |
| `lifecycle_status` | `VARCHAR(50)` | `NOT NULL DEFAULT 'DRAFT'` | Operational state of the physical PO lot. |
| `destination_dc_label` | `VARCHAR(150)` | `NOT NULL` | Visual address label representing receiving hub. |
| `carrier_organization_id`| `UUID` | Nullable, `FOREIGN KEY` | Associated cold storage transport fleet. |
| `tracking_metadata` | `JSONB`| `DEFAULT '{}'::jsonb` | Carrier tracking links, BOL (Bill of Lading) digests. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

## 4. TRACKING & IOT TELEMETRY RECONCILIATION AREA

### Table 7: `shipment_telemetry_logs`
#### Architectural Explanation
The `shipment_telemetry_logs` table represents a high-frequency sensor and beacon stream. It records physical telemetry coordinates, interior micro-climates, container metrics, and outdoor external environments dynamically to verify cold-chain compliance.

#### DDL Schema
```sql
DROP TABLE IF EXISTS shipment_telemetry_logs CASCADE;

CREATE TABLE shipment_telemetry_logs (
    id BIGSERIAL PRIMARY KEY,
    purchase_order_id UUID NOT NULL,
    container_identifier VARCHAR(100) NOT NULL,
    beacon_hardware_id VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cargo_internal_temperature_celsius NUMERIC(5,2) NOT NULL,
    ambient_external_temperature_celsius NUMERIC(5,2) NOT NULL,
    relative_humidity_percentage NUMERIC(5,2) NOT NULL CHECK (relative_humidity_percentage >= 0 AND relative_humidity_percentage <= 100),
    lux_visible_light_levels NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    vibration_g_forces NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    geo_latitude NUMERIC(10,7) NOT NULL CHECK (geo_latitude >= -90.0000000 AND geo_latitude <= 90.0000000),
    geo_longitude NUMERIC(10,7) NOT NULL CHECK (geo_longitude >= -180.0000000 AND geo_longitude <= 180.0000000),
    is_anomaly_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    sensor_telemetry_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_telemetry_po FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id) ON DELETE CASCADE
);

-- Critical High-Frequency Indexes for timeseries retrieval & geospatial routing
CREATE INDEX idx_telemetry_po ON shipment_telemetry_logs(purchase_order_id);
CREATE INDEX idx_telemetry_beacon ON shipment_telemetry_logs(beacon_hardware_id);
CREATE INDEX idx_telemetry_time ON shipment_telemetry_logs(recorded_at DESC);
CREATE INDEX idx_telemetry_anomaly ON shipment_telemetry_logs(is_anomaly_flagged);
CREATE INDEX idx_telemetry_po_time ON shipment_telemetry_logs(purchase_order_id, recorded_at DESC);
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | High-scale 64-bit autoincrement ID for streaming sensors. |
| `purchase_order_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Reference connecting packet to its corresponding PO. |
| `container_identifier` | `VARCHAR(100)` | `NOT NULL` | Shipping container number. |
| `beacon_hardware_id` | `VARCHAR(100)` | `NOT NULL` | IoT physical logger hardware ID. |
| `recorded_at` | `TIMESTAMP` | `NOT NULL` | Device timestamp. |
| `cargo_internal_temperature_celsius`| `NUMERIC(5,2)`| `NOT NULL` | Inside temperature tracking (°C). |
| `ambient_external_temperature_celsius`| `NUMERIC(5,2)`| `NOT NULL` | Outside environment exposure tracking (°C). |
| `relative_humidity_percentage`| `NUMERIC(5,2)`| `NOT NULL` | Interior humidity level %. |
| `lux_visible_light_levels` | `NUMERIC(6,2)`| `NOT NULL DEFAULT 0.0` | Light levels (used to detect unauthorized door openings). |
| `vibration_g_forces` | `NUMERIC(5,2)`| `NOT NULL DEFAULT 0.0` | Impact tracking. |
| `geo_latitude` | `NUMERIC(10,7)`| `NOT NULL` | Coordinates GPS latitude. |
| `geo_longitude` | `NUMERIC(10,7)`| `NOT NULL` | Coordinates GPS longitude. |
| `is_anomaly_flagged` | `BOOLEAN` | `NOT NULL DEFAULT FALSE`| Flag confirming a temperature threshold breach. |
| `sensor_telemetry_payload`| `JSONB` | `DEFAULT '{}'::jsonb`| Extensible telemetry debug metadata. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | DB ingestion timestamp. |

---

## 5. INTELLIGENCE INSPECTION & MITIGATION AREA

### Table 8: `ai_qc_inspections`
#### Architectural Explanation
The `ai_qc_inspections` table captures computer vision, multi-spectral imaging, and olfactory sensor checks run during receiving. It records quality, shelf-life, and anomaly logs.

#### DDL Schema
```sql
DROP TABLE IF EXISTS ai_qc_inspections CASCADE;

CREATE TABLE ai_qc_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL,
    inspector_user_id UUID NOT NULL,
    inspection_code VARCHAR(100) NOT NULL UNIQUE,
    spectral_freshness_index NUMERIC(5,2) NOT NULL, -- Scale 0.0 to 100.0
    estimated_remaining_shelflife_days NUMERIC(4,2) NOT NULL,
    optical_blemish_percentage NUMERIC(5,2) DEFAULT 0.00,
    overall_score NUMERIC(5,2) NOT NULL CHECK (overall_score >= 0.00 AND overall_score <= 100.00),
    is_rejected BOOLEAN NOT NULL DEFAULT FALSE,
    neural_network_reasoning TEXT,
    ocr_detected_batch_labels TEXT[],
    inspection_data_payload JSONB DEFAULT '{}'::jsonb,
    inspected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_qc_po FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_inspector FOREIGN KEY (inspector_user_id)
        REFERENCES users(id) ON DELETE RESTRICT
);

-- Indexing for shelf-life routing and quality assurance audits
CREATE INDEX idx_qc_po ON ai_qc_inspections(purchase_order_id);
CREATE INDEX idx_qc_score ON ai_qc_inspections(overall_score);
CREATE INDEX idx_qc_decision ON ai_qc_inspections(is_rejected);
CREATE INDEX idx_qc_shelflife ON ai_qc_inspections(estimated_remaining_shelflife_days);

-- Update Trigger
-- This table is write-once typically, but we configure it for safety
CREATE TRIGGER update_ai_qc_inspections_modtime
    BEFORE UPDATE ON ai_qc_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | High-precision unique inspection ID. |
| `purchase_order_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Target PO being evaluated. |
| `inspector_user_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Human trigger agent or camera station ID. |
| `inspection_code` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | User-facing index (e.g., `QC-2026-X8`). |
| `spectral_freshness_index` | `NUMERIC(5,2)`| `NOT NULL` | Computed freshness index. |
| `estimated_remaining_shelflife_days`| `NUMERIC(4,2)`| `NOT NULL` | AI estimated shelf life. |
| `optical_blemish_percentage` | `NUMERIC(5,2)`| `DEFAULT 0.00` | Computer vision surface check surface score % metrics. |
| `overall_score` | `NUMERIC(5,2)`| `NOT NULL` | Quality score out of 100.00. |
| `is_rejected` | `BOOLEAN` | `NOT NULL DEFAULT FALSE`| Flag indicating cargo rejection due to quality bounds. |
| `neural_network_reasoning` | `TEXT` | Nullable | Detail listing bounding anomalies and features. |
| `ocr_detected_batch_labels` | `TEXT[]` | Nullable | Batch and serial numbers scanned from box barcodes. |
| `inspection_data_payload` | `JSONB` | `DEFAULT '{}'::jsonb`| Spectral coordinates, temperature, camera link records. |
| `inspected_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Verification timestamp. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Database record entry timestamp. |

---

### Table 9: `batch_split_routings`
#### Architectural Explanation
The `batch_split_routings` table models dynamic routing actions. If a PO's cargo shows mixed quality or varying temperature readings, inspectors split it dynamically (e.g., dividing 10 boxes into 8 for 'Store Inventory' and 2 for 'Claims Vetting').

#### DDL Schema
```sql
DROP TABLE IF EXISTS batch_split_routings CASCADE;

CREATE TABLE batch_split_routings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_qc_inspection_id UUID NOT NULL,
    route_batch_code VARCHAR(100) NOT NULL UNIQUE,
    destination_routing_strategy VARCHAR(100) NOT NULL CHECK (destination_routing_strategy IN ('STORE_INVENTORY', 'MARKDOWN_DISCOUNT_DEAL', 'CLAIMS_VETTING', 'IMMEDIATE_COMPOST_DISPOSAL')),
    cases_allocated INT NOT NULL CHECK (cases_allocated >= 0),
    financial_price_adjustment_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (financial_price_adjustment_pct >= 0.00),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    disposition_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_split_inspection FOREIGN KEY (ai_qc_inspection_id)
        REFERENCES ai_qc_inspections(id) ON DELETE CASCADE
);

-- Indexing for warehouse routing actions
CREATE INDEX idx_split_inspection ON batch_split_routings(ai_qc_inspection_id);
CREATE INDEX idx_split_strategy ON batch_split_routings(destination_routing_strategy);
CREATE INDEX idx_split_complete ON batch_split_routings(is_completed);

-- Update Trigger
CREATE TRIGGER update_batch_split_routings_modtime
    BEFORE UPDATE ON batch_split_routings
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Core child split tracking ID. |
| `ai_qc_inspection_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Associated QC verification audit code link. |
| `route_batch_code` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Physical barcode routing label. |
| `destination_routing_strategy`| `VARCHAR(100)` | `NOT NULL`, check constraint | Active logistical storage/clearance destination route. |
| `cases_allocated` | `INT` | `NOT NULL >= 0` | How many unit cases follow this path. |
| `financial_price_adjustment_pct`| `NUMERIC(5,2)`| `NOT NULL DEFAULT 100` | Pricing coefficient on receiving (Markdown indicator). |
| `is_completed` | `BOOLEAN` | `NOT NULL DEFAULT FALSE`| True when physical sorting has finished in the bay. |
| `disposition_notes` | `TEXT` | Nullable | Manual handler log. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

### Table 10: `vendor_claims_disputes`
#### Architectural Explanation
The `vendor_claims_disputes` table links quality breaches back to claims. Using telemetry anomaly records and inspection results, it calculates penalties, logs evidence, and tracks the dispute lifecycle.

#### DDL Schema
```sql
DROP TABLE IF EXISTS vendor_claims_disputes CASCADE;

CREATE TABLE vendor_claims_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL,
    ai_qc_inspection_id UUID,
    claim_dispute_code VARCHAR(100) NOT NULL UNIQUE,
    dispatched_damaged_sku VARCHAR(255) NOT NULL,
    damaged_cases_count INT NOT NULL CHECK (damaged_cases_count > 0),
    total_dollar_loss_calculated NUMERIC(12,2) NOT NULL CHECK (total_dollar_loss_calculated >= 0.00),
    auto_evidence_validation_code VARCHAR(100) NOT NULL, -- e.g., 'TEMP_BREACH_TELEMETRY' or 'OPTICAL_FAIL'
    current_review_state VARCHAR(50) NOT NULL DEFAULT 'PENDING_VENDOR_RESPONSE' CHECK (current_review_state IN ('PENDING_VENDOR_RESPONSE', 'UNDER_MEDIATION', 'CLAIM_ACCEPTED', 'CLAIM_REJECTED', 'CREDIT_ISSUED')),
    claim_form_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_po FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_claim_inspection FOREIGN KEY (ai_qc_inspection_id)
        REFERENCES ai_qc_inspections(id) ON DELETE SET NULL
);

-- Indexing for dispute arbitration and accounts receivable tracking
CREATE INDEX idx_claims_po ON vendor_claims_disputes(purchase_order_id);
CREATE INDEX idx_claims_inspection ON vendor_claims_disputes(ai_qc_inspection_id);
CREATE INDEX idx_claims_status ON vendor_claims_disputes(current_review_state);
CREATE INDEX idx_claims_code ON vendor_claims_disputes(claim_dispute_code);

-- Update Trigger
CREATE TRIGGER update_vendor_claims_disputes_modtime
    BEFORE UPDATE ON vendor_claims_disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
```

#### Table Column Dictionary
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Core ledger ID for the dispute and chargeback process. |
| `purchase_order_id` | `UUID` | `NOT NULL`, `FOREIGN KEY` | Reference linking back to base purchase order. |
| `ai_qc_inspection_id` | `UUID` | Nullable, `FOREIGN KEY` | Associated QC verification evaluation. |
| `claim_dispute_code` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Visual index ID (e.g., `DISP-2026-9042`). |
| `dispatched_damaged_sku`| `VARCHAR(255)` | `NOT NULL` | Target damaged inventory item identifier. |
| `damaged_cases_count` | `INT` | `NOT NULL > 0` | Damage quantity. |
| `total_dollar_loss_calculated`| `NUMERIC(12,2)`| `NOT NULL` | Total chargeback penalty calculation. |
| `auto_evidence_validation_code`| `VARCHAR(100)`| `NOT NULL` | Evidence proof code (e.g., `TEMP_BREACH_TELEMETRY`). |
| `current_review_state` | `VARCHAR(50)` | `NOT NULL DEFAULT ...` | Processing state of this specific commercial dispute. |
| `claim_form_payload` | `JSONB` | `DEFAULT '{}'::jsonb`| Uploaded bills, photographic proof, dispute logs. |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record entry timestamp. |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Record update timestamp. |

---

## ADVANCED SYSTEM INTEGRITY FEATURES

### 1. Cascade Deletion Logic
To prevent orphaned foreign key records, cascade deletes are enforced. If an `organization` is removed, its child `users`, `purchase_requirements`, `vendor_bids`, `sla_agreements`, and corresponding `purchase_orders` are cascade deleted:
```sql
ALTER TABLE users ADD CONSTRAINT fk_user_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
```

### 2. Time-Series Telemetry Hyper-Indexing
To ensure low latency for real-time dashboards under sustained ingestion, `shipment_telemetry_logs` uses compound indexing. A composite B-tree index is constructed across `purchase_order_id` and `recorded_at DESC`:
```sql
CREATE INDEX idx_telemetry_po_time ON shipment_telemetry_logs(purchase_order_id, recorded_at DESC);
```
This enables the platform to retrieve a shipment's latest coordinates and thermal logs instantly (O(log N)).

### 3. Dynamic Enumerated Domain Enforcement
To ensure data cleanlines, PostgreSQL domain checks prevent invalid categories:
```sql
ALTER TABLE purchase_requirements ADD CONSTRAINT check_commodity_category CHECK (commodity_category IN ('Fresh Produce', 'Meat & Seafood', 'Dairy Lot'));
```
This guarantees consistent categorizations across sourcing requirements, bidding calculations, and AI-driven quality inspection pipelines.
