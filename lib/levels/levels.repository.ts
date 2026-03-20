import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, min } from "drizzle-orm";
import { getDb } from "../db/client";
import {
	miniGolfLevelPurchases,
	miniGolfLevelRuns,
	miniGolfLevels,
	miniGolfUsers,
} from "../db/schema";
import {
	findLocalLevelLeaderboardByLevelCode,
	findLocalLevelPurchaseByUserAndLevel,
	findLocalMiniGolfLevelByCode,
	findLocalMiniGolfUserByEnvAndExternalId,
	findLocalUserRunHistoryByExternalId,
	insertLocalLevelPurchase,
	insertLocalLevelRun,
	isDatabaseConfigured,
	upsertLocalMiniGolfLevels,
} from "../dev/local-store";
import type { EnvScope } from "../users/users.types";

export type MiniGolfLevelRecord = InferSelectModel<typeof miniGolfLevels>;
export type MiniGolfLevelPurchaseRecord = InferSelectModel<typeof miniGolfLevelPurchases>;
export type MiniGolfLevelRunRecord = InferSelectModel<typeof miniGolfLevelRuns>;
export type MiniGolfUserRecord = InferSelectModel<typeof miniGolfUsers>;

export type UpsertMiniGolfLevelInput = {
	levelCode: string;
	name: string;
	tier: MiniGolfLevelRecord["tier"];
	par: number;
	priceUsdc: number;
};

export type RecordLevelPurchaseInput = {
	envScope: EnvScope;
	userId: number;
	levelId: number;
	txHash: string;
	amountUsdc: number;
};

export type RecordLevelRunInput = {
	envScope: EnvScope;
	userId: number;
	levelId: number;
	strokes: number;
};

export type LevelLeaderboardRow = {
	userId: number;
	displayName: string;
	externalId: string;
	bestStrokes: number;
	firstCompletedAt: Date;
};

export type UserRunHistoryRow = {
	runId: number;
	levelCode: string;
	levelName: string;
	strokes: number;
	completedAt: Date;
};

export async function upsertMiniGolfLevels(levels: UpsertMiniGolfLevelInput[]): Promise<void> {
	if (levels.length === 0) {
		return;
	}
	if (!isDatabaseConfigured()) {
		upsertLocalMiniGolfLevels(levels);
		return;
	}

	const db = getDb();
	const now = new Date();

	await db
		.insert(miniGolfLevels)
		.values(
			levels.map((level) => ({
				levelCode: level.levelCode,
				name: level.name,
				tier: level.tier,
				par: level.par,
				priceUsdc: level.priceUsdc,
				updatedAt: now,
			})),
		)
		.onConflictDoNothing();
}

export async function findMiniGolfLevelByCode(
	levelCode: string,
): Promise<MiniGolfLevelRecord | null> {
	if (!isDatabaseConfigured()) {
		return findLocalMiniGolfLevelByCode(levelCode);
	}

	const db = getDb();
	const [row] = await db
		.select()
		.from(miniGolfLevels)
		.where(eq(miniGolfLevels.levelCode, levelCode))
		.limit(1);
	return row ?? null;
}

export async function findMiniGolfUserByEnvAndExternalId(
	envScope: EnvScope,
	externalId: string,
): Promise<MiniGolfUserRecord | null> {
	if (!isDatabaseConfigured()) {
		return findLocalMiniGolfUserByEnvAndExternalId(envScope, externalId);
	}

	const db = getDb();
	const [row] = await db
		.select()
		.from(miniGolfUsers)
		.where(and(eq(miniGolfUsers.envScope, envScope), eq(miniGolfUsers.externalId, externalId)))
		.limit(1);
	return row ?? null;
}

export async function findLevelPurchaseByUserAndLevel(
	envScope: EnvScope,
	userId: number,
	levelId: number,
): Promise<MiniGolfLevelPurchaseRecord | null> {
	if (!isDatabaseConfigured()) {
		return findLocalLevelPurchaseByUserAndLevel(envScope, userId, levelId);
	}

	const db = getDb();
	const [row] = await db
		.select()
		.from(miniGolfLevelPurchases)
		.where(
			and(
				eq(miniGolfLevelPurchases.envScope, envScope),
				eq(miniGolfLevelPurchases.userId, userId),
				eq(miniGolfLevelPurchases.levelId, levelId),
			),
		)
		.limit(1);
	return row ?? null;
}

export async function insertLevelPurchase(
	input: RecordLevelPurchaseInput,
): Promise<MiniGolfLevelPurchaseRecord> {
	if (!isDatabaseConfigured()) {
		return insertLocalLevelPurchase(input);
	}

	const db = getDb();
	const [row] = await db
		.insert(miniGolfLevelPurchases)
		.values({
			envScope: input.envScope,
			userId: input.userId,
			levelId: input.levelId,
			txHash: input.txHash,
			amountUsdc: input.amountUsdc,
		})
		.returning();

	if (!row) {
		throw new Error("Failed to store level purchase");
	}
	return row;
}

export async function insertLevelRun(input: RecordLevelRunInput): Promise<MiniGolfLevelRunRecord> {
	if (!isDatabaseConfigured()) {
		return insertLocalLevelRun(input);
	}

	const db = getDb();
	const [row] = await db
		.insert(miniGolfLevelRuns)
		.values({
			envScope: input.envScope,
			userId: input.userId,
			levelId: input.levelId,
			strokes: input.strokes,
		})
		.returning();

	if (!row) {
		throw new Error("Failed to store level run");
	}
	return row;
}

export async function findLevelLeaderboardByLevelCode(
	envScope: EnvScope,
	levelCode: string,
): Promise<LevelLeaderboardRow[]> {
	if (!isDatabaseConfigured()) {
		return findLocalLevelLeaderboardByLevelCode(envScope, levelCode);
	}

	const db = getDb();
	const bestStrokes = min(miniGolfLevelRuns.strokes).as("bestStrokes");
	const firstCompletedAt = min(miniGolfLevelRuns.completedAt).as("firstCompletedAt");

	const rows = await db
		.select({
			userId: miniGolfUsers.id,
			displayName: miniGolfUsers.displayName,
			externalId: miniGolfUsers.externalId,
			bestStrokes,
			firstCompletedAt,
		})
		.from(miniGolfLevelRuns)
		.innerJoin(miniGolfLevels, eq(miniGolfLevels.id, miniGolfLevelRuns.levelId))
		.innerJoin(miniGolfUsers, eq(miniGolfUsers.id, miniGolfLevelRuns.userId))
		.where(
			and(eq(miniGolfLevelRuns.envScope, envScope), eq(miniGolfLevels.levelCode, levelCode)),
		)
		.groupBy(miniGolfUsers.id, miniGolfUsers.displayName, miniGolfUsers.externalId)
		.orderBy(asc(bestStrokes), asc(firstCompletedAt), asc(miniGolfUsers.id))
		.limit(10);

	return rows
		.filter(
			(row): row is Omit<LevelLeaderboardRow, "displayName"> & { displayName: string } => {
				return row.bestStrokes != null && row.firstCompletedAt != null;
			},
		)
		.map((row) => ({
			userId: row.userId,
			displayName: row.displayName,
			externalId: row.externalId,
			bestStrokes: row.bestStrokes,
			firstCompletedAt: row.firstCompletedAt,
		}));
}

export async function findUserRunHistoryByExternalId(
	envScope: EnvScope,
	userExternalId: string,
	limit: number,
): Promise<UserRunHistoryRow[]> {
	if (!isDatabaseConfigured()) {
		return findLocalUserRunHistoryByExternalId(envScope, userExternalId, limit);
	}

	const db = getDb();
	const rows = await db
		.select({
			runId: miniGolfLevelRuns.id,
			levelCode: miniGolfLevels.levelCode,
			levelName: miniGolfLevels.name,
			strokes: miniGolfLevelRuns.strokes,
			completedAt: miniGolfLevelRuns.completedAt,
		})
		.from(miniGolfLevelRuns)
		.innerJoin(miniGolfUsers, eq(miniGolfUsers.id, miniGolfLevelRuns.userId))
		.innerJoin(miniGolfLevels, eq(miniGolfLevels.id, miniGolfLevelRuns.levelId))
		.where(
			and(
				eq(miniGolfLevelRuns.envScope, envScope),
				eq(miniGolfUsers.envScope, envScope),
				eq(miniGolfUsers.externalId, userExternalId),
			),
		)
		.orderBy(desc(miniGolfLevelRuns.completedAt), desc(miniGolfLevelRuns.id))
		.limit(limit);

	return rows;
}
