-- ============================================================================
-- FreshGuard Supply Platform: Enterprise Relational Database Schema
-- Optimized for: Google Cloud SQL (PostgreSQL Dialect)
-- Description: Complete executable migration script containing robust schema definitions,
--              automated indexes, cascading safety, and dynamic trigger mechanisms
--              covering Users, Procurement Bidding, SLA Contracts, IoT Telemetry,
--              and AI Quality Control Inspections.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. SHARED SCHEMA INITIALIZATION & TRIGGERS
-- ----------------------------------------------------------------------------

-- Trigger helper function to automatically maintain updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';


-- ----------------------------------------------------------------------------
-- 1. CORE SYSTEM MODERATION AREA
-- ----------------------------------------------------------------------------

-- A. Organizations Table
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

CREATE INDEX idx_organizations_type ON organizations(organization_type);
CREATE INDEX idx_organizations_tax_id ON organizations(tax_identifier);

CREATE TRIGGER update_organizations_modtime
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- B. Users Table
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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_role ON users(routing_role);

CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- ----------------------------------------------------------------------------
-- 2. SOURCING & PROCUREMENTS AREA
-- ----------------------------------------------------------------------------

-- A. Purchase Requirements Table
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
    expected_delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'AWARDED', 'CANCELLED')),
    technical_specifications JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_req_buyer FOREIGN KEY (buyer_organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_req_buyer ON purchase_requirements(buyer_organization_id);
CREATE INDEX idx_req_code ON purchase_requirements(requirement_code);
CREATE INDEX idx_req_status_category ON purchase_requirements(status, commodity_category);

CREATE TRIGGER update_purchase_requirements_modtime
    BEFORE UPDATE ON purchase_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- B. Vendor Bids Table
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

CREATE INDEX idx_bids_requirement ON vendor_bids(requirement_id);
CREATE INDEX idx_bids_vendor ON vendor_bids(vendor_organization_id);
CREATE INDEX idx_bids_split_selection ON vendor_bids(selected_for_split);

CREATE TRIGGER update_vendor_bids_modtime
    BEFORE UPDATE ON vendor_bids
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- ----------------------------------------------------------------------------
-- 3. CONTRACTUAL & LEGAL LEVERAGE AREA
-- ----------------------------------------------------------------------------

-- A. SLA Agreements Table
DROP TABLE IF EXISTS sla_agreements CASCADE;
CREATE TABLE sla_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID,
    vendor_organization_id UUID NOT NULL,
    buyer_organization_id UUID NOT NULL,
    contract_reference_code VARCHAR(100) NOT NULL UNIQUE,
    volume_commitment_bounds JSONB NOT NULL,
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

CREATE INDEX idx_sla_vendor ON sla_agreements(vendor_organization_id);
CREATE INDEX idx_sla_buyer ON sla_agreements(buyer_organization_id);
CREATE INDEX idx_sla_ref ON sla_agreements(contract_reference_code);
CREATE INDEX idx_sla_state ON sla_agreements(operational_state);

CREATE TRIGGER update_sla_agreements_modtime
    BEFORE UPDATE ON sla_agreements
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- B. Purchase Orders Table
DROP TABLE IF EXISTS purchase_orders CASCADE;
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sla_agreement_id UUID NOT NULL,
    buyer_organization_id UUID NOT NULL,
    vendor_organization_id UUID NOT NULL,
    po_reference_number VARCHAR(100) NOT NULL UNIQUE,
    total_cases_shipped INT NOT NULL CHECK (total_cases_shipped > 0),
    agreed_case_rate NUMERIC(12,2) NOT NULL,
    scheduled_dispatch_date TIMESTAMP WITH TIME ZONE NOT NULL,
    required_delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
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

CREATE INDEX idx_po_sla ON purchase_orders(sla_agreement_id);
CREATE INDEX idx_po_number ON purchase_orders(po_reference_number);
CREATE INDEX idx_po_status ON purchase_orders(lifecycle_status);
CREATE INDEX idx_po_dates ON purchase_orders(required_delivery_date, actual_delivery_date);

CREATE TRIGGER update_purchase_orders_modtime
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- ----------------------------------------------------------------------------
-- 4. TRACKING & IOT TELEMETRY RECONCILIATION AREA
-- ----------------------------------------------------------------------------

-- A. Shipment Telemetry Logs Table (High-frequency timeseries sensor logging)
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

CREATE INDEX idx_telemetry_po ON shipment_telemetry_logs(purchase_order_id);
CREATE INDEX idx_telemetry_beacon ON shipment_telemetry_logs(beacon_hardware_id);
CREATE INDEX idx_telemetry_time ON shipment_telemetry_logs(recorded_at DESC);
CREATE INDEX idx_telemetry_anomaly ON shipment_telemetry_logs(is_anomaly_flagged);
CREATE INDEX idx_telemetry_po_time ON shipment_telemetry_logs(purchase_order_id, recorded_at DESC);


-- ----------------------------------------------------------------------------
-- 5. INTELLIGENCE INSPECTION & MITIGATION AREA
-- ----------------------------------------------------------------------------

-- A. AI Quality Control Inspections Table
DROP TABLE IF EXISTS ai_qc_inspections CASCADE;
CREATE TABLE ai_qc_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL,
    inspector_user_id UUID NOT NULL,
    inspection_code VARCHAR(100) NOT NULL UNIQUE,
    spectral_freshness_index NUMERIC(5,2) NOT NULL,
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

CREATE INDEX idx_qc_po ON ai_qc_inspections(purchase_order_id);
CREATE INDEX idx_qc_score ON ai_qc_inspections(overall_score);
CREATE INDEX idx_qc_decision ON ai_qc_inspections(is_rejected);
CREATE INDEX idx_qc_shelflife ON ai_qc_inspections(estimated_remaining_shelflife_days);

CREATE TRIGGER update_ai_qc_inspections_modtime
    BEFORE UPDATE ON ai_qc_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- B. Batch Split Routings Table (For selective routing sorting processes)
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

CREATE INDEX idx_split_inspection ON batch_split_routings(ai_qc_inspection_id);
CREATE INDEX idx_split_strategy ON batch_split_routings(destination_routing_strategy);
CREATE INDEX idx_split_complete ON batch_split_routings(is_completed);

CREATE TRIGGER update_batch_split_routings_modtime
    BEFORE UPDATE ON batch_split_routings
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- C. Vendor Claims Disputes Table
DROP TABLE IF EXISTS vendor_claims_disputes CASCADE;
CREATE TABLE vendor_claims_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL,
    ai_qc_inspection_id UUID,
    claim_dispute_code VARCHAR(100) NOT NULL UNIQUE,
    dispatched_damaged_sku VARCHAR(255) NOT NULL,
    damaged_cases_count INT NOT NULL CHECK (damaged_cases_count > 0),
    total_dollar_loss_calculated NUMERIC(12,2) NOT NULL CHECK (total_dollar_loss_calculated >= 0.00),
    auto_evidence_validation_code VARCHAR(100) NOT NULL, -- e.g., 'TEMP_BREACH_TELEMETRY'
    current_review_state VARCHAR(50) NOT NULL DEFAULT 'PENDING_VENDOR_RESPONSE' CHECK (current_review_state IN ('PENDING_VENDOR_RESPONSE', 'UNDER_MEDIATION', 'CLAIM_ACCEPTED', 'CLAIM_REJECTED', 'CREDIT_ISSUED')),
    claim_form_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_po FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_claim_inspection FOREIGN KEY (ai_qc_inspection_id)
        REFERENCES ai_qc_inspections(id) ON DELETE SET NULL
);

CREATE INDEX idx_claims_po ON vendor_claims_disputes(purchase_order_id);
CREATE INDEX idx_claims_inspection ON vendor_claims_disputes(ai_qc_inspection_id);
CREATE INDEX idx_claims_status ON vendor_claims_disputes(current_review_state);
CREATE INDEX idx_claims_code ON vendor_claims_disputes(claim_dispute_code);

CREATE TRIGGER update_vendor_claims_disputes_modtime
    BEFORE UPDATE ON vendor_claims_disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- ----------------------------------------------------------------------------
-- 6. ENTERPRISE MOCK SEED INJECTIONS FOR DEPLOYMENT AUDIT
-- ----------------------------------------------------------------------------

-- Seed Organizations
INSERT INTO organizations (id, registered_name, tax_identifier, organization_type, headquarters_address, primary_contact_email) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Midwest Dairy Co-op', 'TAX-8849-B', 'VENDOR', '100 Green Pasture Rd, Wisconsin', 'contracts@midwestdairy.com'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'FreshGuard Retail Group', 'TAX-2104-F', 'BUYER', 'HQ DC - Chicago, IL', 'buyer-desk@freshguard.com'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Pacific Cold Logistics', 'TAX-4432-P', 'CARRIER', 'Pier 42, Oakland, CA', 'ops@pacificcold.com');

-- Seed Users
INSERT INTO users (id, organization_id, full_name, email, password_hash, routing_role) VALUES
('u0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Sarah Jenkins', 'sjenkins@freshguard.com', '$2b$12$e0MxgH.m8Q39M7aH2lR.SOm8k1K8vT9B5XF2fA3jN5H7lQ4rKEm8q', 'Buyer'),
('u0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Marcus Vance', 'mvance@midwestdairy.com', '$2b$12$d9NxhI.o9P40N8bI3mS.TPn9lM9wU0C6YG3gB4kO6I8mR5sLFn9r', 'Vendor');

-- Seed Purchase Requirements
INSERT INTO purchase_requirements (id, buyer_organization_id, requirement_code, commodity_category, sku_name, target_volume_cases, max_acceptable_temperature, max_transit_duration_days, bid_deadline, expected_delivery_date, status) VALUES
('r0eecc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'REQ-2026-003', 'Dairy Lot', 'Premium Whole Milk (Gallon)', 1200, 4.00, 3.00, '2026-06-10 17:00:00+00', '2026-06-15 08:00:00+00', 'OPEN');

-- Seed Vendor Bids
INSERT INTO vendor_bids (id, requirement_id, vendor_organization_id, bid_reference_code, case_rate_price, max_cases_available, historical_quality_score, historical_otif_percentage, estimated_transit_days, selected_for_split, allocated_cases) VALUES
('b0eecc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'r0eecc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'BID-2026-778', 14.50, 1500, 98.40, 99.10, 2, TRUE, 1200);

-- Seed SLA Contracts
INSERT INTO sla_agreements (id, requirement_id, vendor_organization_id, buyer_organization_id, contract_reference_code, volume_commitment_bounds, compliance_baseline_window_hours, temperature_tolerance_celsius, severity_chargeback_multiplier, operational_state) VALUES
('s0eedd99-9c0b-4ef8-bb6d-6bb9bd380e11', 'r0eecc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'CTR-2026-101', '{"min": 500, "max": 1500}', 6, 1.50, 1.75, 'ACTIVE');

-- Seed Purchase Orders
INSERT INTO purchase_orders (id, sla_agreement_id, buyer_organization_id, vendor_organization_id, po_reference_number, total_cases_shipped, agreed_case_rate, scheduled_dispatch_date, required_delivery_date, lifecycle_status, destination_dc_label, carrier_organization_id) VALUES
('p0eedd99-9c0b-4ef8-bb6d-6bb9bd380f11', 's0eedd99-9c0b-4ef8-bb6d-6bb9bd380e11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'PO-2026-784A', 1200, 14.50, '2026-06-05 06:00:00+00', '2026-06-08 12:00:00+00', 'IN_TRANSIT', 'Chicago Logistics DC East - Cold Terminal A', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');

-- Seed Telemetry Sensor Core Packets
INSERT INTO shipment_telemetry_logs (purchase_order_id, container_identifier, beacon_hardware_id, recorded_at, cargo_internal_temperature_celsius, ambient_external_temperature_celsius, relative_humidity_percentage, lux_visible_light_levels, vibration_g_forces, geo_latitude, geo_longitude, is_anomaly_flagged) VALUES
('p0eedd99-9c0b-4ef8-bb6d-6bb9bd380f11', 'CONT-MSKU7842', 'BEACON-99042', '2026-06-06 14:30:00+00', 3.20, 24.50, 68.20, 0.05, 0.12, 41.8781000, -87.6298000, FALSE),
('p0eedd99-9c0b-4ef8-bb6d-6bb9bd380f11', 'CONT-MSKU7842', 'BEACON-99042', '2026-06-06 15:30:00+00', 5.80, 26.80, 72.10, 0.08, 0.18, 42.0125000, -87.8920000, TRUE); -- Heat deviation anomaly

COMMIT;
-- ============================================================================
-- SQL SCRIPT MIGRATION COMPLETE
-- =================-----------------------------------------------------------
