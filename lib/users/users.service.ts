import { findMiniGolfUserByEnvAndExternalId, upsertMiniGolfUser } from "./users.repository";
import type { EnvScope, UpsertMiniGolfUserInput } from "./users.types";

type RegisterWalletUserInput = {
	envScope: EnvScope;
	walletAddress: string;
	displayName: string;
};

type RegisterDevBrowserUserInput = {
	envScope: EnvScope;
	generatedId: string;
	displayName: string;
	walletAddress?: string;
};

export async function registerWalletUser(input: RegisterWalletUserInput) {
	const walletAddress = input.walletAddress.toLowerCase();
	return upsertMiniGolfUser({
		envScope: input.envScope,
		externalId: `wallet:${walletAddress}`,
		displayName: input.displayName,
		authSource: "dev_wallet",
		walletAddress,
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

export async function ensureStoredUser(
	envScope: EnvScope,
	externalId: string,
	displayName: string,
) {
	const existing = await findMiniGolfUserByEnvAndExternalId(envScope, externalId);
	if (existing) {
		return existing;
	}

	const walletMatch = /^wallet:(0x[a-fA-F0-9]{40})$/.exec(externalId);
	if (walletMatch) {
		const walletAddress = walletMatch[1]?.toLowerCase();
		return upsertMiniGolfUser({
			envScope,
			externalId,
			displayName,
			authSource: "dev_wallet",
			walletAddress,
		});
	}

	return upsertMiniGolfUser({
		envScope,
		externalId,
		displayName,
		authSource: "dev_browser",
	});
}
