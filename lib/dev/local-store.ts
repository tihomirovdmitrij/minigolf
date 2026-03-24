import type { EnvScope, UserAuthSource } from "../users/users.types";

type LocalMiniGolfUserRecord = {
	id: number;
	envScope: EnvScope;
	externalId: string;
	displayName: string;
	authSource: UserAuthSource;
	farcasterFid: number | null;
	walletAddress: string | null;
	createdAt: Date;
	updatedAt: Date;
};

type LocalMiniGolfLevelRecord = {
	id: number;
	levelCode: string;
	name: string;
	tier: "free" | "premium";
	par: number;
	priceUsdc: number;
	createdAt: Date;
	updatedAt: Date;
};

type LocalMiniGolfLevelPurchaseRecord = {
	id: number;
	envScope: EnvScope;
	userId: number;
	levelId: number;
	txHash: string;
	amountUsdc: number;
	purchasedAt: Date;
};

type LocalMiniGolfLevelRunRecord = {
	id: number;
	envScope: EnvScope;
	userId: number;
	levelId: number;
	strokes: number;
	completedAt: Date;
};

type LocalUpsertMiniGolfUserInput = {
	envScope: EnvScope;
	externalId: string;
	displayName: string;
	authSource: UserAuthSource;
	farcasterFid?: number;
	walletAddress?: string;
};

type LocalUpsertMiniGolfLevelInput = {
	levelCode: string;
	name: string;
	tier: "free" | "premium";
	par: number;
	priceUsdc: number;
};

const localStore = {
	nextUserId: 1,
	nextLevelId: 1,
	nextPurchaseId: 1,
	nextRunId: 1,
	users: [] as LocalMiniGolfUserRecord[],
	levels: [] as LocalMiniGolfLevelRecord[],
	purchases: [] as LocalMiniGolfLevelPurchaseRecord[],
	runs: [] as LocalMiniGolfLevelRunRecord[],
};

export function isDatabaseConfigured(): boolean {
	return Boolean(process.env.DATABASE_URL?.trim());
}

export function upsertLocalMiniGolfUser(
	input: LocalUpsertMiniGolfUserInput,
): LocalMiniGolfUserRecord {
	const now = new Date();
	const matchingFidUser =
		input.farcasterFid == null
			? null
			: (localStore.users.find(
					(user) =>
						user.envScope === input.envScope &&
						user.farcasterFid === input.farcasterFid,
				) ?? null);
	const existing =
		matchingFidUser ??
		localStore.users.find(
			(user) => user.envScope === input.envScope && user.externalId === input.externalId,
		) ??
		null;

	if (existing) {
		existing.externalId = input.externalId;
		existing.displayName = input.displayName;
		existing.authSource = input.authSource;
		existing.farcasterFid = input.farcasterFid ?? null;
		existing.walletAddress = input.walletAddress ?? null;
		existing.updatedAt = now;
		return existing;
	}

	const record: LocalMiniGolfUserRecord = {
		id: localStore.nextUserId,
		envScope: input.envScope,
		externalId: input.externalId,
		displayName: input.displayName,
		authSource: input.authSource,
		farcasterFid: input.farcasterFid ?? null,
		walletAddress: input.walletAddress ?? null,
		createdAt: now,
		updatedAt: now,
	};
	localStore.nextUserId += 1;
	localStore.users.push(record);
	return record;
}

export function findLocalMiniGolfUserByEnvAndExternalId(
	envScope: EnvScope,
	externalId: string,
): LocalMiniGolfUserRecord | null {
	return (
		localStore.users.find(
			(user) => user.envScope === envScope && user.externalId === externalId,
		) ?? null
	);
}

export function upsertLocalMiniGolfLevels(levels: LocalUpsertMiniGolfLevelInput[]): void {
	const now = new Date();

	for (const level of levels) {
		const existing = localStore.levels.find((row) => row.levelCode === level.levelCode) ?? null;
		if (existing) {
			existing.name = level.name;
			existing.tier = level.tier;
			existing.par = level.par;
			existing.priceUsdc = level.priceUsdc;
			existing.updatedAt = now;
			continue;
		}

		localStore.levels.push({
			id: localStore.nextLevelId,
			levelCode: level.levelCode,
			name: level.name,
			tier: level.tier,
			par: level.par,
			priceUsdc: level.priceUsdc,
			createdAt: now,
			updatedAt: now,
		});
		localStore.nextLevelId += 1;
	}
}

export function findLocalMiniGolfLevelByCode(levelCode: string): LocalMiniGolfLevelRecord | null {
	return localStore.levels.find((level) => level.levelCode === levelCode) ?? null;
}

export function findLocalLevelPurchaseByUserAndLevel(
	envScope: EnvScope,
	userId: number,
	levelId: number,
): LocalMiniGolfLevelPurchaseRecord | null {
	return (
		localStore.purchases.find(
			(purchase) =>
				purchase.envScope === envScope &&
				purchase.userId === userId &&
				purchase.levelId === levelId,
		) ?? null
	);
}

export function insertLocalLevelPurchase(input: {
	envScope: EnvScope;
	userId: number;
	levelId: number;
	txHash: string;
	amountUsdc: number;
}): LocalMiniGolfLevelPurchaseRecord {
	const duplicateHash = localStore.purchases.find(
		(purchase) =>
			purchase.envScope === input.envScope &&
			purchase.userId === input.userId &&
			purchase.txHash === input.txHash,
	);
	if (duplicateHash) {
		throw new Error("mini_golf_level_purchases_env_scope_user_tx_hash_idx");
	}

	const record: LocalMiniGolfLevelPurchaseRecord = {
		id: localStore.nextPurchaseId,
		envScope: input.envScope,
		userId: input.userId,
		levelId: input.levelId,
		txHash: input.txHash,
		amountUsdc: input.amountUsdc,
		purchasedAt: new Date(),
	};
	localStore.nextPurchaseId += 1;
	localStore.purchases.push(record);
	return record;
}

export function insertLocalLevelRun(input: {
	envScope: EnvScope;
	userId: number;
	levelId: number;
	strokes: number;
}): LocalMiniGolfLevelRunRecord {
	const record: LocalMiniGolfLevelRunRecord = {
		id: localStore.nextRunId,
		envScope: input.envScope,
		userId: input.userId,
		levelId: input.levelId,
		strokes: input.strokes,
		completedAt: new Date(),
	};
	localStore.nextRunId += 1;
	localStore.runs.push(record);
	return record;
}

export function findLocalLevelLeaderboardByLevelCode(
	envScope: EnvScope,
	levelCode: string,
): Array<{
	userId: number;
	displayName: string;
	externalId: string;
	bestStrokes: number;
	firstCompletedAt: Date;
}> {
	const level = findLocalMiniGolfLevelByCode(levelCode);
	if (!level) {
		return [];
	}

	const leaderboard = new Map<
		number,
		{
			userId: number;
			displayName: string;
			externalId: string;
			bestStrokes: number;
			firstCompletedAt: Date;
		}
	>();

	for (const run of localStore.runs) {
		if (run.envScope !== envScope || run.levelId !== level.id) {
			continue;
		}
		const user = localStore.users.find((candidate) => candidate.id === run.userId);
		if (!user) {
			continue;
		}

		const existing = leaderboard.get(user.id);
		if (!existing) {
			leaderboard.set(user.id, {
				userId: user.id,
				displayName: user.displayName,
				externalId: user.externalId,
				bestStrokes: run.strokes,
				firstCompletedAt: run.completedAt,
			});
			continue;
		}

		if (
			run.strokes < existing.bestStrokes ||
			(run.strokes === existing.bestStrokes &&
				run.completedAt.getTime() < existing.firstCompletedAt.getTime())
		) {
			existing.bestStrokes = run.strokes;
			existing.firstCompletedAt = run.completedAt;
		}
	}

	return Array.from(leaderboard.values())
		.sort((left, right) => {
			if (left.bestStrokes !== right.bestStrokes) {
				return left.bestStrokes - right.bestStrokes;
			}
			if (left.firstCompletedAt.getTime() !== right.firstCompletedAt.getTime()) {
				return left.firstCompletedAt.getTime() - right.firstCompletedAt.getTime();
			}
			return left.userId - right.userId;
		})
		.slice(0, 10);
}

export function findLocalUserRunHistoryByExternalId(
	envScope: EnvScope,
	userExternalId: string,
	limit: number,
): Array<{
	runId: number;
	levelCode: string;
	levelName: string;
	strokes: number;
	completedAt: Date;
}> {
	const user = findLocalMiniGolfUserByEnvAndExternalId(envScope, userExternalId);
	if (!user) {
		return [];
	}

	return localStore.runs
		.filter((run) => run.envScope === envScope && run.userId === user.id)
		.map((run) => {
			const level = localStore.levels.find((candidate) => candidate.id === run.levelId);
			return {
				runId: run.id,
				levelCode: level?.levelCode ?? "unknown",
				levelName: level?.name ?? "Unknown level",
				strokes: run.strokes,
				completedAt: run.completedAt,
			};
		})
		.sort((left, right) => {
			if (left.completedAt.getTime() !== right.completedAt.getTime()) {
				return right.completedAt.getTime() - left.completedAt.getTime();
			}
			return right.runId - left.runId;
		})
		.slice(0, limit);
}

export function findLocalPurchasedLevelCodesByUserExternalId(
	envScope: EnvScope,
	userExternalId: string,
): string[] {
	const user = findLocalMiniGolfUserByEnvAndExternalId(envScope, userExternalId);
	if (!user) {
		return [];
	}

	const codes = new Set<string>();
	for (const purchase of localStore.purchases) {
		if (purchase.envScope !== envScope || purchase.userId !== user.id) {
			continue;
		}
		const level = localStore.levels.find((candidate) => candidate.id === purchase.levelId);
		if (level) {
			codes.add(level.levelCode);
		}
	}

	return Array.from(codes.values());
}
