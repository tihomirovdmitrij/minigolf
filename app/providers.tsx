"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { MiniAppProvider } from "./providers/MiniAppProvider";
import { MiniGolfUserProvider } from "./providers/MiniGolfUserProvider";

const isDevelopmentEnvironment =
	typeof process !== "undefined" &&
	typeof process.env !== "undefined" &&
	process.env.NODE_ENV !== "production";

const config = createConfig({
	chains: [base],
	transports: { [base.id]: http() },
	connectors: isDevelopmentEnvironment
		? [
				coinbaseWallet({
					appName: process.env.NEXT_PUBLIC_PROJECT_NAME ?? "Base Putt",
				}),
				injected({ shimDisconnect: true }),
			]
		: [
				coinbaseWallet({
					appName: process.env.NEXT_PUBLIC_PROJECT_NAME ?? "Base Putt",
				}),
			],
});

export function Providers({ children }: { children: ReactNode }) {
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
