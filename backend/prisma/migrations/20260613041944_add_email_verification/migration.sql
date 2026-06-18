-- AlterTable
ALTER TABLE "app_users" ADD COLUMN     "email_verification_code" VARCHAR(10),
ADD COLUMN     "email_verification_expires" TIMESTAMPTZ,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false;
-- Grandfather existing accounts created before email verification
UPDATE "app_users" SET "email_verified" = true WHERE "email_verified" = false;
