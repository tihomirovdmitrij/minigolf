"use client";

import { createContext, useContext, useMemo } from "react";

import { useMiniApp } from "./MiniAppProvider";
import type { UserState } from "../../lib/minigolf/types";
import { DEFAULT_USER, FREE_LEVELS } from "../../lib/minigolf/level-data";

const isTestMode =
	typeof process !== "undefined" &&
	typeof process.env !== "undefined" &&
	process.env.NEXT_PUBLIC_TEST_MODE === "true";

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

export function MiniGolfUserProvider({ children }: { children: React.ReactNode }) {
	const { context } = useMiniApp();

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

		if (isTestMode) {
			user = {
				...user,
				usdcBalance: 100,
				purchasedLevelIds: [...base.purchasedLevelIds, ...FREE_LEVELS.map((lvl) => lvl.id)],
			};
		}

		return { user };
	}, [context]);

	return <MiniGolfUserContext.Provider value={value}>{children}</MiniGolfUserContext.Provider>;
}

