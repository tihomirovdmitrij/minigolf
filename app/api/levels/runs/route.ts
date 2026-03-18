import type { NextRequest } from "next/server";
import { getRunsHistory, postRecordRun } from "../../../../lib/levels/levels.controller";

export async function GET(request: NextRequest) {
	return getRunsHistory(request);
}

export async function POST(request: NextRequest) {
	return postRecordRun(request);
}
