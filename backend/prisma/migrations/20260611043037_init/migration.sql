-- CreateTable
CREATE TABLE "purchase_requirements" (
    "requirement_id" VARCHAR(50) NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "target_volume" INTEGER NOT NULL,
    "volume_unit" VARCHAR(50) NOT NULL DEFAULT 'Cases',
    "operational_status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requirements_pkey" PRIMARY KEY ("requirement_id")
);

-- CreateTable
CREATE TABLE "vendor_bids" (
    "bid_id" UUID NOT NULL,
    "requirement_id" VARCHAR(50) NOT NULL,
    "ai_qualification_score" INTEGER NOT NULL,
    "case_pricing" DECIMAL(10,2) NOT NULL,
    "max_volume_available" INTEGER NOT NULL,
    "selected_for_split" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_bids_pkey" PRIMARY KEY ("bid_id")
);

-- CreateTable
CREATE TABLE "sla_agreements" (
    "sla_id" VARCHAR(50) NOT NULL,
    "bid_id" UUID NOT NULL,
    "volume_commitment_value" DECIMAL(12,2) NOT NULL,
    "contract_start_date" DATE NOT NULL,
    "contract_end_date" DATE NOT NULL,
    "operational_status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_agreements_pkey" PRIMARY KEY ("sla_id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "po_number" VARCHAR(50) NOT NULL,
    "sla_id" VARCHAR(50) NOT NULL,
    "cargo_description" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "issue_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfillment_status" VARCHAR(50) NOT NULL DEFAULT 'IN TRANSIT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("po_number")
);

-- CreateTable
CREATE TABLE "ai_qc_inspections" (
    "inspection_id" UUID NOT NULL,
    "po_number" VARCHAR(50) NOT NULL,
    "ai_quality_score" INTEGER NOT NULL,
    "freshness_index" DECIMAL(3,1) NOT NULL,
    "estimated_shelf_life_days" DECIMAL(4,1) NOT NULL,
    "anomalies_flagged" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_qc_inspections_pkey" PRIMARY KEY ("inspection_id")
);

-- CreateTable
CREATE TABLE "batch_split_routings" (
    "split_id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "total_batch_volume" INTEGER NOT NULL DEFAULT 10,
    "store_fulfillment_count" INTEGER NOT NULL,
    "claims_mitigation_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_split_routings_pkey" PRIMARY KEY ("split_id")
);

-- CreateTable
CREATE TABLE "vendor_claims_disputes" (
    "dispute_id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "damaged_sku_name" VARCHAR(255) NOT NULL,
    "calculated_loss_amount" DECIMAL(10,2) NOT NULL,
    "evidence_validation_code" VARCHAR(100) NOT NULL,
    "buyer_comments" TEXT,
    "dispute_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_VENDOR_RESPONSE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_claims_disputes_pkey" PRIMARY KEY ("dispute_id")
);

-- AddForeignKey
ALTER TABLE "vendor_bids" ADD CONSTRAINT "vendor_bids_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "purchase_requirements"("requirement_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_agreements" ADD CONSTRAINT "sla_agreements_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "vendor_bids"("bid_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_sla_id_fkey" FOREIGN KEY ("sla_id") REFERENCES "sla_agreements"("sla_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_qc_inspections" ADD CONSTRAINT "ai_qc_inspections_po_number_fkey" FOREIGN KEY ("po_number") REFERENCES "purchase_orders"("po_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_split_routings" ADD CONSTRAINT "batch_split_routings_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "ai_qc_inspections"("inspection_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_claims_disputes" ADD CONSTRAINT "vendor_claims_disputes_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "ai_qc_inspections"("inspection_id") ON DELETE RESTRICT ON UPDATE CASCADE;
