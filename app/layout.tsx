import type { Metadata, Viewport } from "next";
import { SafeArea } from "./components/SafeArea";
import { Providers } from "./providers";
import "./globals.css";

const APP_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "Base Putt";
const APP_DESCRIPTION = "Sink putts, beat tricky levels, and play mini-golf right on your phone.";

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: APP_NAME,
		description: APP_DESCRIPTION,
		appleWebApp: {
			capable: true,
			statusBarStyle: "default",
			title: APP_NAME,
		},
		other: {
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
