import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	async rewrites() {
		return [
			{ source: "/.well-known/farcaster.json", destination: "/well-known/farcaster.json" },
		];
	},
	turbopack: {},
	webpack: (config) => {
		config.externals.push("pino-pretty", "lokijs", "encoding");
		return config;
	},
};

export default nextConfig;
