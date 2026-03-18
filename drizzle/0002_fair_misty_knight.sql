CREATE TABLE "mini_golf_level_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"env_scope" "env_scope" NOT NULL,
	"user_id" bigint NOT NULL,
	"level_id" bigint NOT NULL,
	"strokes" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mini_golf_level_runs" ADD CONSTRAINT "mini_golf_level_runs_user_id_mini_golf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mini_golf_users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mini_golf_level_runs" ADD CONSTRAINT "mini_golf_level_runs_level_id_mini_golf_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."mini_golf_levels"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "mini_golf_level_runs_env_scope_user_id_idx" ON "mini_golf_level_runs" USING btree ("env_scope","user_id");--> statement-breakpoint
CREATE INDEX "mini_golf_level_runs_env_scope_level_id_idx" ON "mini_golf_level_runs" USING btree ("env_scope","level_id");