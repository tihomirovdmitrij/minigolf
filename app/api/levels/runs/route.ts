import type { NextRequest } from "next/server";
import { postRecordRun } from "../../../../lib/levels/levels.controller";

export async function POST(request: NextRequest) {
	return postRecordRun(request);
}
