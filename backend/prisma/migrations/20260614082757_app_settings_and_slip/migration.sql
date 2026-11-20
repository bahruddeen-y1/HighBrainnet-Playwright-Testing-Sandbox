-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "QrSource" AS ENUM ('PROMPTPAY', 'GBP');

-- CreateEnum
CREATE TYPE "PromptPayIdType" AS ENUM ('PHONE', 'CITIZEN', 'EWALLET');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "slip_verify_result" JSONB;

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "payment_mode" "PaymentMode" NOT NULL DEFAULT 'MANUAL',
    "qr_source" "QrSource" NOT NULL DEFAULT 'PROMPTPAY',
    "promptpay_id" TEXT,
    "promptpay_type" "PromptPayIdType" NOT NULL DEFAULT 'PHONE',
    "promptpay_name" TEXT,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "bank_account_name" TEXT,
    "slip_provider" TEXT,
    "slip_api_key" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
