"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

type MiniAppUserContext = {
	fid?: number;
	displayName?: string;
};

type MiniAppSafeAreaInsets = {
	top: number;
	bottom: number;
	left: number;
	right: number;
};

type MiniAppClientContext = {
	safeAreaInsets?: MiniAppSafeAreaInsets;
};

interface MiniAppContextValue {
	context: {
		user?: MiniAppUserContext;
		client?: MiniAppClientContext;
	} | null;
	isReady: boolean;
}

export const MiniAppContext = createContext<MiniAppContextValue | null>(null);

export function useMiniApp() {
	const context = useContext(MiniAppContext);
	if (!context) {
		throw new Error("useMiniApp must be used within MiniAppProvider");
	}
	return context;
}

export function MiniAppProvider({ children }: { children: ReactNode }) {
	const [context, setContext] = useState<MiniAppContextValue["context"]>(null);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		// Standard web app mode: no host runtime context is expected.
		setContext(null);
		setIsReady(true);
	}, []);

	return (
		<MiniAppContext.Provider value={{ context, isReady }}>{children}</MiniAppContext.Provider>
	);
}
