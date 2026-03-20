import { LEVEL_PRICE_USDC, LEVELS } from "../minigolf/level-data";
import {
	PaymentVerificationError,
	verifyUsdcTransferOnBaseMainnet,
} from "../payments/payments.service";
import { ensureStoredUser } from "../users/users.service";
import type { EnvScope } from "../users/users.types";
import {
	findLevelLeaderboardByLevelCode,
	findLevelPurchaseByUserAndLevel,
	findMiniGolfLevelByCode,
	findUserRunHistoryByExternalId,
	insertLevelPurchase,
	insertLevelRun,
	upsertMiniGolfLevels,
} from "./levels.repository";

type RecordLevelPurchaseRequest = {
	envScope: EnvScope;
	userExternalId: string;
	userDisplayName: string;
	levelCode: string;
	txHash: string;
	amountUsdc: number;
};

type RecordLevelRunRequest = {
	envScope: EnvScope;
	userExternalId: string;
	userDisplayName: string;
	levelCode: string;
	strokes: number;
};

export type RecordLevelPurchaseResult = {
	status: "created" | "already_purchased";
	levelCode: string;
	txHash: string;
	purchasedAt: Date;
};

export type RecordLevelRunResult = {
	levelCode: string;
	strokes: number;
	completedAt: Date;
};

export type LevelLeaderboardResultRow = {
	rank: number;
	userId: number;
	displayName: string;
	externalId: string;
	bestStrokes: number;
};

export type UserRunHistoryResultRow = {
	id: string;
	levelCode: string;
	levelName: string;
	strokes: number;
	completedAt: string;
};

const DB_LEVELS = LEVELS.map((level) => ({
	levelCode: level.id,
	name: level.name,
	tier: level.tier,
	par: level.par,
	priceUsdc: level.tier === "premium" ? LEVEL_PRICE_USDC : 0,
}));

export async function syncGameLevelsToDatabase(): Promise<void> {
	await upsertMiniGolfLevels(DB_LEVELS);
}

export async function recordLevelPurchase(
	input: RecordLevelPurchaseRequest,
): Promise<RecordLevelPurchaseResult> {
	await syncGameLevelsToDatabase();

	const level = await findMiniGolfLevelByCode(input.levelCode);
	if (!level) {
		throw new Error("Unknown level");
	}

	const user = await ensureStoredUser(
		input.envScope,
		input.userExternalId,
		input.userDisplayName,
	);
	const existingPurchase = await findLevelPurchaseByUserAndLevel(
		input.envScope,
		user.id,
		level.id,
	);
	if (existingPurchase) {
		return {
			status: "already_purchased",
			levelCode: input.levelCode,
			txHash: existingPurchase.txHash,
			purchasedAt: existingPurchase.purchasedAt,
		};
	}
	if (!user.walletAddress) {
		throw new PaymentVerificationError("Wallet address is required for level purchase", 422);
	}
	if (Math.abs(input.amountUsdc - level.priceUsdc) > 0.000001) {
		throw new PaymentVerificationError("Submitted amount does not match level price", 422);
	}

	const normalizedTxHash = input.txHash.trim().toLowerCase();
	await verifyUsdcTransferOnBaseMainnet({
		txHash: normalizedTxHash,
		expectedFromAddress: user.walletAddress,
		expectedAmountUsdc: level.priceUsdc,
	});

	const purchase = await insertLevelPurchase({
		envScope: input.envScope,
		userId: user.id,
		levelId: level.id,
		txHash: normalizedTxHash,
		amountUsdc: level.priceUsdc,
	});

	return {
		status: "created",
		levelCode: input.levelCode,
		txHash: purchase.txHash,
		purchasedAt: purchase.purchasedAt,
	};
}

export async function recordLevelRun(input: RecordLevelRunRequest): Promise<RecordLevelRunResult> {
	await syncGameLevelsToDatabase();

	const level = await findMiniGolfLevelByCode(input.levelCode);
	if (!level) {
		throw new Error("Unknown level");
	}

	const user = await ensureStoredUser(
		input.envScope,
		input.userExternalId,
		input.userDisplayName,
	);

	const run = await insertLevelRun({
		envScope: input.envScope,
		userId: user.id,
		levelId: level.id,
		strokes: input.strokes,
	});

	return {
		levelCode: input.levelCode,
		strokes: run.strokes,
		completedAt: run.completedAt,
	};
}

export async function getLevelLeaderboard(
	envScope: EnvScope,
	levelCode: string,
): Promise<LevelLeaderboardResultRow[]> {
	await syncGameLevelsToDatabase();

	const level = await findMiniGolfLevelByCode(levelCode);
	if (!level) {
		throw new Error("Unknown level");
	}

	const rows = await findLevelLeaderboardByLevelCode(envScope, levelCode);
	return rows.map((row, index) => ({
		rank: index + 1,
		userId: row.userId,
		displayName: row.displayName || row.externalId,
		externalId: row.externalId,
		bestStrokes: row.bestStrokes,
	}));
}

export async function getUserRunHistory(
	envScope: EnvScope,
	userExternalId: string,
	limit: number,
): Promise<UserRunHistoryResultRow[]> {
	const rows = await findUserRunHistoryByExternalId(envScope, userExternalId, limit);
	return rows.map((row) => ({
		id: String(row.runId),
		levelCode: row.levelCode,
		levelName: row.levelName,
		strokes: row.strokes,
		completedAt: row.completedAt.toISOString(),
	}));
}
