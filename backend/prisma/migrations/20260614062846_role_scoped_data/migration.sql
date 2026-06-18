-- AlterTable
ALTER TABLE "app_users" ADD COLUMN     "vendor_org_id" VARCHAR(50);

-- AlterTable
ALTER TABLE "negotiation_messages" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "purchase_requirements" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "sla_agreements" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "vendor_claims_disputes" ADD COLUMN     "owner_user_id" UUID,
ADD COLUMN     "vendor_org_id" VARCHAR(50);
