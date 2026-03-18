ALTER TYPE "public"."user_auth_source" ADD VALUE 'dev_wallet';--> statement-breakpoint
ALTER TABLE "mini_golf_users" ADD COLUMN "wallet_address" text;