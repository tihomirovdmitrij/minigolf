import type { NextRequest } from "next/server";
import { postPurchaseLevel } from "../../../../lib/levels/levels.controller";

export async function POST(request: NextRequest) {
	return postPurchaseLevel(request);
}
