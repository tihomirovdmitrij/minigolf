import { createClient, Errors } from "@farcaster/quick-auth";
import { type NextRequest, NextResponse } from "next/server";
import { registerMiniAppUser } from "../users/users.service";
import { resolveEnvScope } from "../users/users.types";

const client = createClient();

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

function getPayloadDisplayName(payload: object, fid: number): string {
	const source = payload as Record<string, unknown>;
	const candidates = [source.displayName, source.display_name, source.username, source.name];
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim().length > 0) {
			return candidate.trim();
		}
	}
	return `Farcaster ${fid}`;
}

export async function getAuth(request: NextRequest) {
	const authorization = request.headers.get("Authorization");
	if (!authorization || !authorization.startsWith("Bearer ")) {
		return NextResponse.json({ message: "Missing token" }, { status: 401 });
	}

	try {
		const payload = await client.verifyJwt({
			token: authorization.split(" ")[1] as string,
			domain: getUrlHost(request),
		});

		const userFid = Number(payload.sub);
		if (!Number.isInteger(userFid) || userFid <= 0) {
			return NextResponse.json({ message: "Invalid token payload" }, { status: 401 });
		}

		const envScope = resolveEnvScope();
		const displayName = getPayloadDisplayName(payload, userFid);
		const storedUser = await registerMiniAppUser({
			envScope,
			fid: userFid,
			displayName,
		});

		return NextResponse.json({
			success: true,
			user: {
				fid: userFid,
				displayName,
				issuedAt: payload.iat,
				expiresAt: payload.exp,
				envScope,
				storedUserId: storedUser.id,
			},
		});
	} catch (e) {
		if (e instanceof Errors.InvalidTokenError) {
			return NextResponse.json({ message: "Invalid token" }, { status: 401 });
		}
		if (e instanceof Error) {
			return NextResponse.json({ message: e.message }, { status: 500 });
		}
		throw e;
	}
}
