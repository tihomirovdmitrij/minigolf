CREATE TYPE "public"."env_scope" AS ENUM('development', 'production');--> statement-breakpoint
CREATE TYPE "public"."user_auth_source" AS ENUM('miniapp', 'dev_browser');--> statement-breakpoint
CREATE TABLE "mini_golf_users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"env_scope" "env_scope" NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text NOT NULL,
	"auth_source" "user_auth_source" NOT NULL,
	"farcaster_fid" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mini_golf_users_env_scope_external_id_idx" ON "mini_golf_users" USING btree ("env_scope","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mini_golf_users_env_scope_fid_idx" ON "mini_golf_users" USING btree ("env_scope","farcaster_fid");