-- DropForeignKey
ALTER TABLE "vendor_claims_disputes" DROP CONSTRAINT "vendor_claims_disputes_inspection_id_fkey";

-- AlterTable
ALTER TABLE "purchase_requirements" ADD COLUMN     "category" VARCHAR(100),
ADD COLUMN     "details_payload" JSONB;

-- AlterTable
ALTER TABLE "vendor_bids" ADD COLUMN     "quote_details" JSONB;

-- AlterTable
ALTER TABLE "vendor_claims_disputes" ADD COLUMN     "claim_payload" JSONB,
ADD COLUMN     "purchase_order_ref" VARCHAR(50),
ALTER COLUMN "inspection_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "negotiation_messages" (
    "message_id" UUID NOT NULL,
    "requirement_id" VARCHAR(50) NOT NULL,
    "sender" VARCHAR(100) NOT NULL,
    "avatar" VARCHAR(10),
    "text" TEXT NOT NULL,
    "is_self" BOOLEAN NOT NULL DEFAULT false,
    "sender_role" VARCHAR(20) NOT NULL DEFAULT 'BUYER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "negotiation_messages_requirement_id_idx" ON "negotiation_messages"("requirement_id");

-- AddForeignKey
ALTER TABLE "vendor_claims_disputes" ADD CONSTRAINT "vendor_claims_disputes_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "ai_qc_inspections"("inspection_id") ON DELETE SET NULL ON UPDATE CASCADE;
