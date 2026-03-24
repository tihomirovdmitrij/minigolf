import { type NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { registerDevBrowserUser, syncClientUser } from "./users.service";
import { resolveEnvScope } from "./users.types";

type DevUserPayload = {
	generatedId: string;
	displayName: string;
	walletAddress?: string;
};

type SyncUserPayload = {
	userExternalId: string;
	userDisplayName: string;
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

function isSyncUserPayload(value: unknown): value is SyncUserPayload {
	if (!value || typeof value !== "object") {
		return false;
	}

	const payload = value as Record<string, unknown>;
	return (
		typeof payload.userExternalId === "string" &&
		payload.userExternalId.trim().length > 0 &&
		typeof payload.userDisplayName === "string" &&
		payload.userDisplayName.trim().length > 0 &&
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

export async function postSyncUser(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
	}

	if (!isSyncUserPayload(body)) {
		return NextResponse.json(
			{ message: "userExternalId and userDisplayName are required" },
			{ status: 400 },
		);
	}

	const envScope = resolveEnvScope();
	const storedUser = await syncClientUser({
		envScope,
		externalId: body.userExternalId.trim(),
		displayName: body.userDisplayName.trim(),
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
