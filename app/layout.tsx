import type { Metadata, Viewport } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
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
			statusBarStyle: "black-translucent",
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
		},
	};
}

export const viewport: Viewport = {
	themeColor: "#070b10",
	colorScheme: "dark",
	viewportFit: "cover",
};

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

const sourceCodePro = Source_Code_Pro({
	variable: "--font-source-code-pro",
	subsets: ["latin"],
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" style={{ backgroundColor: "#070b10" }}>
			<body
				className={`${inter.variable} ${sourceCodePro.variable}`}
				style={{ backgroundColor: "#070b10", minHeight: "100dvh" }}
			>
				<Providers>
					<SafeArea>{children}</SafeArea>
				</Providers>
			</body>
		</html>
	);
}
