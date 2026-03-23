"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { MiniAppProvider } from "./providers/MiniAppProvider";
import { MiniGolfUserProvider } from "./providers/MiniGolfUserProvider";

const config = createConfig({
	chains: [base],
	transports: { [base.id]: http() },
	connectors: [injected({ shimDisconnect: true })],
});

export function RootProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<MiniAppProvider>
			<WagmiProvider config={config}>
				<QueryClientProvider client={queryClient}>
					<MiniGolfUserProvider>{children}</MiniGolfUserProvider>
				</QueryClientProvider>
			</WagmiProvider>
		</MiniAppProvider>
	);
}
