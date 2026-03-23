export type EnvScope = "development" | "production";

export type UserAuthSource = "dev_browser" | "dev_wallet";

export type UpsertMiniGolfUserInput = {
	envScope: EnvScope;
	externalId: string;
	displayName: string;
	authSource: UserAuthSource;
	farcasterFid?: number;
	walletAddress?: string;
};

export function resolveEnvScope(): EnvScope {
	return process.env.NODE_ENV === "production" ? "production" : "development";
}
