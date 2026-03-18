import { type NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { registerDevBrowserUser } from "./users.service";
import { resolveEnvScope } from "./users.types";

type DevUserPayload = {
	generatedId: string;
	displayName: string;
	walletAddress?: string;
};

function isDevUserPayload(value: unknown): value is DevUserPayload {
	if (!value || typeof value !== "object") {
		return false;
	}

	const payload = value as Record<string, unknown>;
	return (
		typeof payload.generatedId === "string" &&
		payload.generatedId.trim().length > 0 &&
		typeof payload.displayName === "string" &&
		payload.displayName.trim().length > 0 &&
		(payload.walletAddress == null ||
			(typeof payload.walletAddress === "string" && isAddress(payload.walletAddress)))
	);
}

export async function postDevUser(request: NextRequest) {
	const envScope = resolveEnvScope();
	if (envScope === "production") {
		return NextResponse.json(
			{ message: "Dev user endpoint is disabled in production" },
			{ status: 403 },
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
	}

	if (!isDevUserPayload(body)) {
		return NextResponse.json(
			{ message: "generatedId and displayName are required" },
			{ status: 400 },
		);
	}

	const storedUser = await registerDevBrowserUser({
		envScope,
		generatedId: body.generatedId.trim(),
		displayName: body.displayName.trim(),
		walletAddress: body.walletAddress?.toLowerCase(),
	});

	return NextResponse.json({
		success: true,
		user: {
			id: storedUser.id,
			envScope: storedUser.envScope,
			externalId: storedUser.externalId,
			displayName: storedUser.displayName,
			authSource: storedUser.authSource,
			walletAddress: storedUser.walletAddress,
		},
	});
}
