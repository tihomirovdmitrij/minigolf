import type { NextRequest } from "next/server";
import { getPurchasedLevels } from "../../../../lib/levels/levels.controller";

export async function GET(request: NextRequest) {
	return getPurchasedLevels(request);
}
