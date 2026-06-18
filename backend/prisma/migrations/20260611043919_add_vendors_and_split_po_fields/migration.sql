-- DropForeignKey
ALTER TABLE "sla_agreements" DROP CONSTRAINT "sla_agreements_bid_id_fkey";

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "adjusted_eta" VARCHAR(50),
ADD COLUMN     "allocated_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "allocation_percentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "container_id" VARCHAR(100),
ADD COLUMN     "iot_beacon_id" VARCHAR(100),
ADD COLUMN     "vendor_id" VARCHAR(50),
ALTER COLUMN "fulfillment_status" SET DEFAULT 'packing';

-- AlterTable
ALTER TABLE "sla_agreements" ADD COLUMN     "requirement_id" VARCHAR(50),
ADD COLUMN     "total_contract_months" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "total_scheduled_batches" INTEGER NOT NULL DEFAULT 12,
ALTER COLUMN "bid_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "vendor_bids" ADD COLUMN     "post_harvest_age_hours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "vendor_id" VARCHAR(50) NOT NULL;

-- CreateTable
CREATE TABLE "vendors" (
    "vendor_id" VARCHAR(50) NOT NULL,
    "organization_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'VENDOR',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("vendor_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_organization_name_key" ON "vendors"("organization_name");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_bids_requirement_id_vendor_id_key" ON "vendor_bids"("requirement_id", "vendor_id");

-- AddForeignKey
ALTER TABLE "vendor_bids" ADD CONSTRAINT "vendor_bids_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("vendor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_agreements" ADD CONSTRAINT "sla_agreements_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "vendor_bids"("bid_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_agreements" ADD CONSTRAINT "sla_agreements_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "purchase_requirements"("requirement_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("vendor_id") ON DELETE SET NULL ON UPDATE CASCADE;
