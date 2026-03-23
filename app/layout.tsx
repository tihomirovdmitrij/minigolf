import type { Metadata, Viewport } from "next";
import { farcasterConfig } from "../farcaster.config";
import { SafeArea } from "./components/SafeArea";
import { Providers } from "./providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: farcasterConfig.miniapp.name,
		description: farcasterConfig.miniapp.description,
		appleWebApp: {
			capable: true,
			statusBarStyle: "default",
			title: farcasterConfig.miniapp.name,
		},
		other: {
			"fc:frame": JSON.stringify({
				version: farcasterConfig.miniapp.version,
				imageUrl: farcasterConfig.miniapp.heroImageUrl,
				button: {
					title: `Join the ${farcasterConfig.miniapp.name} Waitlist`,
					action: {
						name: `Launch ${farcasterConfig.miniapp.name}`,
						type: "launch_frame",
					},
				},
			}),
			"base:app_id": "69c136c90cb572f81afbfdb8",
		},
	};
}

export const viewport: Viewport = {
	themeColor: "#effcf3",
	colorScheme: "light",
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" style={{ backgroundColor: "#effcf3" }}>
			<body style={{ backgroundColor: "#effcf3", minHeight: "100dvh" }}>
				<Providers>
					<SafeArea>{children}</SafeArea>
				</Providers>
			</body>
		</html>
	);
}
