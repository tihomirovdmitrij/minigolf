DROP INDEX "mini_golf_level_purchases_env_scope_tx_hash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "mini_golf_level_purchases_env_scope_user_tx_hash_idx" ON "mini_golf_level_purchases" USING btree ("env_scope","user_id","tx_hash");
