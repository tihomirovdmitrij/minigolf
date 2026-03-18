CREATE TYPE "public"."level_tier" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TABLE "mini_golf_level_purchases" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"env_scope" "env_scope" NOT NULL,
	"user_id" bigint NOT NULL,
	"level_id" bigint NOT NULL,
	"tx_hash" text NOT NULL,
	"amount_usdc" double precision NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mini_golf_levels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"level_code" text NOT NULL,
	"name" text NOT NULL,
	"tier" "level_tier" NOT NULL,
	"par" integer NOT NULL,
	"price_usdc" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mini_golf_level_purchases" ADD CONSTRAINT "mini_golf_level_purchases_user_id_mini_golf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mini_golf_users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mini_golf_level_purchases" ADD CONSTRAINT "mini_golf_level_purchases_level_id_mini_golf_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."mini_golf_levels"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "mini_golf_level_purchases_env_scope_user_level_idx" ON "mini_golf_level_purchases" USING btree ("env_scope","user_id","level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mini_golf_level_purchases_env_scope_tx_hash_idx" ON "mini_golf_level_purchases" USING btree ("env_scope","tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "mini_golf_levels_level_code_idx" ON "mini_golf_levels" USING btree ("level_code");