import { findMiniGolfUserByEnvAndExternalId, upsertMiniGolfUser } from "./users.repository";
import type { EnvScope, UpsertMiniGolfUserInput } from "./users.types";

type RegisterMiniAppUserInput = {
	envScope: EnvScope;
	fid: number;
	displayName: string;
};

type RegisterDevBrowserUserInput = {
	envScope: EnvScope;
	generatedId: string;
	displayName: string;
	walletAddress?: string;
};

export async function registerMiniAppUser(input: RegisterMiniAppUserInput) {
	return upsertMiniGolfUser({
		envScope: input.envScope,
		externalId: `fid-${input.fid}`,
		displayName: input.displayName,
		authSource: "miniapp",
		farcasterFid: input.fid,
	});
}

export async function registerDevBrowserUser(input: RegisterDevBrowserUserInput) {
	const normalizedWalletAddress = input.walletAddress?.toLowerCase();
	const payload: UpsertMiniGolfUserInput = {
		envScope: input.envScope,
		externalId: input.generatedId,
		displayName: input.displayName,
		authSource: normalizedWalletAddress ? "dev_wallet" : "dev_browser",
		walletAddress: normalizedWalletAddress,
	};

	return upsertMiniGolfUser(payload);
}

export async function getStoredUser(envScope: EnvScope, externalId: string) {
	return findMiniGolfUserByEnvAndExternalId(envScope, externalId);
}

type SyncClientUserInput = {
	envScope: EnvScope;
	externalId: string;
	displayName: string;
	walletAddress?: string;
};

function buildUpsertPayloadFromExternalId(
	input: SyncClientUserInput,
	existingWalletAddress?: string | null,
): UpsertMiniGolfUserInput {
	const normalizedWalletAddress = input.walletAddress?.toLowerCase();
	const fidMatch = /^fid-(\d+)$/.exec(input.externalId);
	if (fidMatch) {
		const fid = Number(fidMatch[1]);
		if (Number.isInteger(fid) && fid > 0) {
			return {
				envScope: input.envScope,
				externalId: input.externalId,
				displayName: input.displayName,
				authSource: "miniapp",
				farcasterFid: fid,
				walletAddress: normalizedWalletAddress ?? existingWalletAddress ?? undefined,
			};
		}
	}

	const walletMatch = /^wallet:(0x[a-fA-F0-9]{40})$/.exec(input.externalId);
	if (walletMatch) {
		const walletFromExternalId = walletMatch[1]?.toLowerCase();
		return {
			envScope: input.envScope,
			externalId: input.externalId,
			displayName: input.displayName,
			authSource: "dev_wallet",
			walletAddress:
				normalizedWalletAddress ??
				walletFromExternalId ??
				existingWalletAddress ??
				undefined,
		};
	}

	return {
		envScope: input.envScope,
		externalId: input.externalId,
		displayName: input.displayName,
		authSource: normalizedWalletAddress ? "dev_wallet" : "dev_browser",
		walletAddress: normalizedWalletAddress ?? existingWalletAddress ?? undefined,
	};
}

export async function syncClientUser(input: SyncClientUserInput) {
	const existing = await findMiniGolfUserByEnvAndExternalId(input.envScope, input.externalId);
	const payload = buildUpsertPayloadFromExternalId(input, existing?.walletAddress);
	return upsertMiniGolfUser(payload);
}

export async function ensureStoredUser(
	envScope: EnvScope,
	externalId: string,
	displayName: string,
	walletAddress?: string,
) {
	const existing = await findMiniGolfUserByEnvAndExternalId(envScope, externalId);
	const normalizedWalletAddress = walletAddress?.toLowerCase();
	if (
		existing &&
		existing.displayName === displayName &&
		(existing.walletAddress ?? undefined) === normalizedWalletAddress
	) {
		return existing;
	}
	return syncClientUser({
		envScope,
		externalId,
		displayName,
		walletAddress: normalizedWalletAddress,
	});
}
