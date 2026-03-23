import { type NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { registerWalletUser } from "../users/users.service";
import { resolveEnvScope } from "../users/users.types";

function getUrlHost(request: NextRequest): string {
	const origin = request.headers.get("origin");
	if (origin) {
		try {
			const url = new URL(origin);
			return url.host;
		} catch (error) {
			console.warn("Invalid origin header:", origin, error);
		}
	}

	const host = request.headers.get("host");
	if (host) {
		return host;
	}

	let urlValue: string;
	if (process.env.VERCEL_ENV === "production") {
		urlValue = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
	} else if (process.env.VERCEL_URL) {
		urlValue = `https://${process.env.VERCEL_URL}`;
	} else {
		urlValue = "http://localhost:3000";
	}

	const url = new URL(urlValue);
	return url.host;
}

type SiweAuthPayload = {
	message: string;
	signature: string;
	displayName?: string;
	nickname?: string;
};

function isSiweAuthPayload(value: unknown): value is SiweAuthPayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const payload = value as Record<string, unknown>;
	return (
		typeof payload.message === "string" &&
		payload.message.trim().length > 0 &&
		typeof payload.signature === "string" &&
		payload.signature.trim().length > 0 &&
		(payload.displayName == null || typeof payload.displayName === "string") &&
		(payload.nickname == null || typeof payload.nickname === "string")
	);
}

function getWalletDisplayName(
	walletAddress: string,
	requestedNickname?: string,
	requestedDisplayName?: string,
): string {
	const preferredName = requestedNickname?.trim() || requestedDisplayName?.trim();
	if (preferredName) {
		return preferredName;
	}
	return `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}

export async function postAuth(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
	}

	if (!isSiweAuthPayload(body)) {
		return NextResponse.json(
			{ message: "message and signature are required" },
			{ status: 400 },
		);
	}

	try {
		const siweMessage = new SiweMessage(body.message);
		const verification = await siweMessage.verify({
			signature: body.signature,
			domain: getUrlHost(request),
		});
		if (!verification.success || !verification.data.address) {
			return NextResponse.json({ message: "Invalid SIWE signature" }, { status: 401 });
		}

		const walletAddress = verification.data.address.toLowerCase();

		const envScope = resolveEnvScope();
		const displayName = getWalletDisplayName(walletAddress, body.nickname, body.displayName);
		const storedUser = await registerWalletUser({
			envScope,
			walletAddress,
			displayName,
		});

		return NextResponse.json({
			success: true,
			user: {
				address: walletAddress,
				displayName,
				envScope,
				storedUserId: storedUser.id,
			},
		});
	} catch (e) {
		if (e instanceof Error) {
			return NextResponse.json({ message: e.message }, { status: 500 });
		}
		throw e;
	}
}
