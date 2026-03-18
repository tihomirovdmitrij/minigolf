import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { miniGolfUsers } from "../db/schema";
import type { UpsertMiniGolfUserInput } from "./users.types";

export type MiniGolfUserRecord = InferSelectModel<typeof miniGolfUsers>;

export async function upsertMiniGolfUser(
	input: UpsertMiniGolfUserInput,
): Promise<MiniGolfUserRecord> {
	const db = getDb();
	const now = new Date();

	const [row] = await db
		.insert(miniGolfUsers)
		.values({
			envScope: input.envScope,
			externalId: input.externalId,
			displayName: input.displayName,
			authSource: input.authSource,
			farcasterFid: input.farcasterFid ?? null,
			walletAddress: input.walletAddress ?? null,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [miniGolfUsers.envScope, miniGolfUsers.externalId],
			set: {
				displayName: input.displayName,
				authSource: input.authSource,
				farcasterFid: input.farcasterFid ?? null,
				walletAddress: input.walletAddress ?? null,
				updatedAt: now,
			},
		})
		.returning();

	if (!row) {
		throw new Error("Failed to upsert mini golf user");
	}

	return row;
}

export async function findMiniGolfUserByEnvAndExternalId(
	envScope: MiniGolfUserRecord["envScope"],
	externalId: string,
): Promise<MiniGolfUserRecord | null> {
	const db = getDb();

	const [row] = await db
		.select()
		.from(miniGolfUsers)
		.where(and(eq(miniGolfUsers.envScope, envScope), eq(miniGolfUsers.externalId, externalId)))
		.limit(1);

	return row ?? null;
}
