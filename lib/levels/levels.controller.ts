import { type NextRequest, NextResponse } from "next/server";
import { LEVEL_PRICE_USDC } from "../minigolf/level-data";
import { PaymentVerificationError } from "../payments/payments.service";
import { resolveEnvScope } from "../users/users.types";
import {
	getLevelLeaderboard,
	getUserRunHistory,
	recordLevelPurchase,
	recordLevelRun,
} from "./levels.service";

type PurchaseLevelPayload = {
	userExternalId: string;
	userDisplayName: string;
	levelCode: string;
	txHash: string;
	amountUsdc?: number;
};

type RecordRunPayload = {
	userExternalId: string;
	userDisplayName: string;
	levelCode: string;
	strokes: number;
};

function isTransactionHash(value: string): boolean {
	return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isPurchaseLevelPayload(value: unknown): value is PurchaseLevelPayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const payload = value as Record<string, unknown>;
	return (
		typeof payload.userExternalId === "string" &&
		payload.userExternalId.trim().length > 0 &&
		typeof payload.userDisplayName === "string" &&
		payload.userDisplayName.trim().length > 0 &&
		typeof payload.levelCode === "string" &&
		payload.levelCode.trim().length > 0 &&
		typeof payload.txHash === "string" &&
		isTransactionHash(payload.txHash.trim()) &&
		(payload.amountUsdc == null ||
			(typeof payload.amountUsdc === "number" && Number.isFinite(payload.amountUsdc)))
	);
}

function isRecordRunPayload(value: unknown): value is RecordRunPayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const payload = value as Record<string, unknown>;
	return (
		typeof payload.userExternalId === "string" &&
		payload.userExternalId.trim().length > 0 &&
		typeof payload.userDisplayName === "string" &&
		payload.userDisplayName.trim().length > 0 &&
		typeof payload.levelCode === "string" &&
		payload.levelCode.trim().length > 0 &&
		typeof payload.strokes === "number" &&
		Number.isInteger(payload.strokes) &&
		payload.strokes > 0
	);
}

export async function postPurchaseLevel(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
	}

	if (!isPurchaseLevelPayload(body)) {
		return NextResponse.json(
			{
				message:
					"userExternalId, userDisplayName, levelCode and a valid txHash are required",
			},
			{ status: 400 },
		);
	}

	try {
		const envScope = resolveEnvScope();
		const amountUsdc = body.amountUsdc ?? LEVEL_PRICE_USDC;
		const result = await recordLevelPurchase({
			envScope,
			userExternalId: body.userExternalId.trim(),
			userDisplayName: body.userDisplayName.trim(),
			levelCode: body.levelCode.trim(),
			txHash: body.txHash.trim(),
			amountUsdc,
		});

		return NextResponse.json({
			success: true,
			purchase: {
				status: result.status,
				levelCode: result.levelCode,
				txHash: result.txHash,
				purchasedAt: result.purchasedAt,
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Unknown level") {
			return NextResponse.json({ message: "Level not found" }, { status: 404 });
		}
		if (error instanceof PaymentVerificationError) {
			return NextResponse.json({ message: error.message }, { status: error.statusCode });
		}
		if (
			error instanceof Error &&
			error.message.includes("mini_golf_level_purchases_env_scope_user_tx_hash_idx")
		) {
			return NextResponse.json(
				{ message: "This transaction hash has already been used by this user" },
				{ status: 409 },
			);
		}
		if (error instanceof Error) {
			return NextResponse.json({ message: error.message }, { status: 500 });
		}
		throw error;
	}
}

export async function postRecordRun(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
	}

	if (!isRecordRunPayload(body)) {
		return NextResponse.json(
			{
				message:
					"userExternalId, userDisplayName, levelCode and positive strokes are required",
			},
			{ status: 400 },
		);
	}

	try {
		const envScope = resolveEnvScope();
		const result = await recordLevelRun({
			envScope,
			userExternalId: body.userExternalId.trim(),
			userDisplayName: body.userDisplayName.trim(),
			levelCode: body.levelCode.trim(),
			strokes: body.strokes,
		});

		return NextResponse.json({
			success: true,
			run: {
				levelCode: result.levelCode,
				strokes: result.strokes,
				completedAt: result.completedAt,
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Unknown level") {
			return NextResponse.json({ message: "Level not found" }, { status: 404 });
		}
		if (error instanceof Error) {
			return NextResponse.json({ message: error.message }, { status: 500 });
		}
		throw error;
	}
}

export async function getLeaderboard(request: NextRequest) {
	const levelCode = request.nextUrl.searchParams.get("levelCode");
	if (!levelCode || levelCode.trim().length === 0) {
		return NextResponse.json({ message: "levelCode is required" }, { status: 400 });
	}

	try {
		const envScope = resolveEnvScope();
		const rows = await getLevelLeaderboard(envScope, levelCode.trim());
		return NextResponse.json({
			success: true,
			levelCode: levelCode.trim(),
			rows,
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Unknown level") {
			return NextResponse.json({ message: "Level not found" }, { status: 404 });
		}
		if (error instanceof Error) {
			return NextResponse.json({ message: error.message }, { status: 500 });
		}
		throw error;
	}
}

export async function getRunsHistory(request: NextRequest) {
	const userExternalId = request.nextUrl.searchParams.get("userExternalId");
	if (!userExternalId || userExternalId.trim().length === 0) {
		return NextResponse.json({ message: "userExternalId is required" }, { status: 400 });
	}

	const limitRaw = request.nextUrl.searchParams.get("limit");
	const parsedLimit = limitRaw == null ? 30 : Number(limitRaw);
	const limit =
		Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 30;

	try {
		const envScope = resolveEnvScope();
		const rows = await getUserRunHistory(envScope, userExternalId.trim(), limit);
		return NextResponse.json({
			success: true,
			rows,
		});
	} catch (error) {
		if (error instanceof Error) {
			return NextResponse.json({ message: error.message }, { status: 500 });
		}
		throw error;
	}
}
