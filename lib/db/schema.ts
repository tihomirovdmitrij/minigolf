import {
	bigint,
	bigserial,
	doublePrecision,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const envScopeEnum = pgEnum("env_scope", ["development", "production"]);
export const userAuthSourceEnum = pgEnum("user_auth_source", [
	"miniapp",
	"dev_browser",
	"dev_wallet",
]);
export const levelTierEnum = pgEnum("level_tier", ["free", "premium"]);

export const miniGolfUsers = pgTable(
	"mini_golf_users",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		envScope: envScopeEnum("env_scope").notNull(),
		externalId: text("external_id").notNull(),
		displayName: text("display_name").notNull(),
		authSource: userAuthSourceEnum("auth_source").notNull(),
		farcasterFid: integer("farcaster_fid"),
		walletAddress: text("wallet_address"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("mini_golf_users_env_scope_external_id_idx").on(
			table.envScope,
			table.externalId,
		),
		uniqueIndex("mini_golf_users_env_scope_fid_idx").on(table.envScope, table.farcasterFid),
	],
);

export const miniGolfLevels = pgTable(
	"mini_golf_levels",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		levelCode: text("level_code").notNull(),
		name: text("name").notNull(),
		tier: levelTierEnum("tier").notNull(),
		par: integer("par").notNull(),
		priceUsdc: doublePrecision("price_usdc").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("mini_golf_levels_level_code_idx").on(table.levelCode)],
);

export const miniGolfLevelPurchases = pgTable(
	"mini_golf_level_purchases",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		envScope: envScopeEnum("env_scope").notNull(),
		userId: bigint("user_id", { mode: "number" })
			.notNull()
			.references(() => miniGolfUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
		levelId: bigint("level_id", { mode: "number" })
			.notNull()
			.references(() => miniGolfLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
		txHash: text("tx_hash").notNull(),
		amountUsdc: doublePrecision("amount_usdc").notNull(),
		purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("mini_golf_level_purchases_env_scope_user_level_idx").on(
			table.envScope,
			table.userId,
			table.levelId,
		),
		uniqueIndex("mini_golf_level_purchases_env_scope_tx_hash_idx").on(
			table.envScope,
			table.txHash,
		),
	],
);

export const miniGolfLevelRuns = pgTable(
	"mini_golf_level_runs",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		envScope: envScopeEnum("env_scope").notNull(),
		userId: bigint("user_id", { mode: "number" })
			.notNull()
			.references(() => miniGolfUsers.id, { onDelete: "restrict", onUpdate: "cascade" }),
		levelId: bigint("level_id", { mode: "number" })
			.notNull()
			.references(() => miniGolfLevels.id, { onDelete: "restrict", onUpdate: "cascade" }),
		strokes: integer("strokes").notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("mini_golf_level_runs_env_scope_user_id_idx").on(table.envScope, table.userId),
		index("mini_golf_level_runs_env_scope_level_id_idx").on(table.envScope, table.levelId),
	],
);
