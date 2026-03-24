"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { DEFAULT_USER, FREE_LEVELS } from "../../lib/minigolf/level-data";
import type { UserState } from "../../lib/minigolf/types";
import { useMiniApp } from "./MiniAppProvider";

const isTestMode =
	typeof process !== "undefined" &&
	typeof process.env !== "undefined" &&
	process.env.NEXT_PUBLIC_TEST_MODE === "true";

const isDevelopmentEnvironment =
	typeof process !== "undefined" &&
	typeof process.env !== "undefined" &&
	process.env.NODE_ENV !== "production";

type MiniGolfUserContextValue = {
	user: UserState;
};

const MiniGolfUserContext = createContext<MiniGolfUserContextValue | null>(null);

export function useMiniGolfUser(): MiniGolfUserContextValue {
	const ctx = useContext(MiniGolfUserContext);
	if (!ctx) {
		throw new Error("useMiniGolfUser must be used within MiniGolfUserProvider");
	}
	return ctx;
}

function makeDeterministicGradient(seed: number): string {
	const hue = (seed * 37) % 360;
	const hue2 = (hue + 40) % 360;
	return `linear-gradient(135deg,hsl(${hue},70%,55%) 0%,hsl(${hue2},70%,45%) 100%)`;
}

function hashString(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return Math.abs(hash >>> 0);
}

function getBrowserSeed(): number {
	if (typeof window === "undefined") {
		return 1;
	}

	const browserFingerprint = [
		window.navigator.userAgent,
		window.navigator.language,
		window.navigator.platform,
		window.navigator.hardwareConcurrency?.toString() ?? "",
		window.screen.width.toString(),
		window.screen.height.toString(),
		window.screen.colorDepth.toString(),
		window.devicePixelRatio.toString(),
		Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
	].join("|");

	const hash = hashString(browserFingerprint);
	return hash || 1;
}

function makeGeneratedDevUser(base: UserState, seed: number): UserState {
	const userNumber = ((seed % 9000) + 1000).toString();
	return {
		...base,
		id: `dev-${seed.toString(16)}`,
		name: `Dev Player ${userNumber}`,
		isGuest: false,
		walletConnected: false,
		walletAddress: base.walletAddress,
		avatarGradient: makeDeterministicGradient(seed),
		purchasedLevelIds: [...base.purchasedLevelIds],
	};
}

function makeWalletDisplayName(address: string): string {
	return `Wallet ${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function MiniGolfUserProvider({ children }: { children: React.ReactNode }) {
	const { context } = useMiniApp();
	const { address, isConnected } = useAccount();
	const [browserSeed, setBrowserSeed] = useState<number | null>(null);
	const [lastSyncedUserKey, setLastSyncedUserKey] = useState<string | null>(null);

	useEffect(() => {
		if (!isDevelopmentEnvironment) {
			return;
		}
		setBrowserSeed(getBrowserSeed());
	}, []);

	const value = useMemo<MiniGolfUserContextValue>(() => {
		const base = DEFAULT_USER;

		const fid = context?.user?.fid ?? 0;
		const displayName = context?.user?.displayName ?? "Guest Player";

		const seededGradient = makeDeterministicGradient(fid || 1);

		let user: UserState = {
			...base,
			id: fid ? `fid-${fid}` : "guest-1",
			name: displayName,
			isGuest: !fid,
			walletConnected: false,
			walletAddress: base.walletAddress,
			avatarGradient: seededGradient,
			purchasedLevelIds: [...base.purchasedLevelIds],
		};

		if (!fid && isDevelopmentEnvironment && browserSeed !== null) {
			user = makeGeneratedDevUser(base, browserSeed);
		}

		if (!fid && isDevelopmentEnvironment && isConnected && address) {
			const normalizedAddress = address.toLowerCase();
			user = {
				...base,
				id: `wallet:${normalizedAddress}`,
				name: makeWalletDisplayName(normalizedAddress),
				isGuest: false,
				walletConnected: true,
				walletAddress: normalizedAddress,
				avatarGradient: makeDeterministicGradient(hashString(normalizedAddress)),
				purchasedLevelIds: [...base.purchasedLevelIds],
			};
		}

		// Keep wallet status sourced from wagmi even when profile comes from Farcaster context.
		if (isConnected && address) {
			user = {
				...user,
				walletConnected: true,
				walletAddress: address.toLowerCase(),
			};
		}

		if (isDevelopmentEnvironment && isTestMode) {
			user = {
				...user,
				usdcBalance: 100,
				purchasedLevelIds: [...base.purchasedLevelIds, ...FREE_LEVELS.map((lvl) => lvl.id)],
			};
		}

		return { user };
	}, [address, browserSeed, context, isConnected]);
	const currentFid = context?.user?.fid ?? 0;
	const currentUser = value.user;

	useEffect(() => {
		if (currentUser.isGuest || currentUser.id === "guest-1") {
			return;
		}
		const syncKey = `${currentUser.id}:${currentUser.name}:${currentUser.walletAddress ?? ""}`;
		if (lastSyncedUserKey === syncKey) {
			return;
		}

		let isCancelled = false;

		const syncUser = async () => {
			try {
				const response = await fetch("/api/users/sync", {
					method: "POST",
					headers: {
						"content-type": "application/json",
					},
					body: JSON.stringify({
						userExternalId: currentUser.id,
						userDisplayName: currentUser.name,
						walletAddress: currentUser.walletAddress,
					}),
				});
				if (!response.ok) {
					const responseText = await response.text();
					console.warn("Failed to sync user", response.status, responseText);
					return;
				}
				if (!isCancelled) {
					setLastSyncedUserKey(syncKey);
				}
			} catch (error) {
				console.warn("Failed to sync user", error);
			}
		};

		void syncUser();

		return () => {
			isCancelled = true;
		};
	}, [
		currentUser.id,
		currentUser.isGuest,
		currentUser.name,
		currentUser.walletAddress,
		lastSyncedUserKey,
	]);

	return <MiniGolfUserContext.Provider value={value}>{children}</MiniGolfUserContext.Provider>;
}
