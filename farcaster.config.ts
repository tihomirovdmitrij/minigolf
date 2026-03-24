const ROOT_URL =
	process.env.NEXT_PUBLIC_URL ||
	(process.env.VERCEL_PROJECT_PRODUCTION_URL
		? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
		: "http://localhost:3000");

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const farcasterConfig = {
	accountAssociation: {
		header: "",
		payload: "",
		signature: "",
	},
	miniapp: {
		version: "1",
		name: "Base Putt",
		subtitle: "Arcade Mini-Golf on Base",
		description: "Sink putts, beat tricky levels, and play mini-golf right on your phone.",
		screenshotUrls: [`${ROOT_URL}/logo.png`],
		iconUrl: `${ROOT_URL}/logo.png`,
		splashImageUrl: `${ROOT_URL}/logo.png`,
		splashBackgroundColor: "#effcf3",
		homeUrl: ROOT_URL,
		webhookUrl: `${ROOT_URL}/api/webhook`,
		primaryCategory: "games",
		tags: ["golf", "mini-golf", "arcade", "base", "game"],
		heroImageUrl: `${ROOT_URL}/logo.png`,
		tagline: "Sink putts. Climb higher.",
		ogTitle: "Base Putt",
		ogDescription: "Play arcade mini-golf on your phone. Sink putts and beat the course.",
		ogImageUrl: `${ROOT_URL}/logo.png`,
	},
} as const;
