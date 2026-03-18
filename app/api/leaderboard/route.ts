import type { NextRequest } from "next/server";
import { getLeaderboard } from "../../../lib/levels/levels.controller";

export async function GET(request: NextRequest) {
	return getLeaderboard(request);
}
