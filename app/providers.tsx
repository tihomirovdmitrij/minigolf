"use client";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { MiniAppProvider } from "./providers/MiniAppProvider";

const config = createConfig({
	chains: [base],
	transports: { [base.id]: http() },
	connectors: [farcasterMiniApp()],
});

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<MiniAppProvider>
			<WagmiProvider config={config}>
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			</WagmiProvider>
		</MiniAppProvider>
	);
}
