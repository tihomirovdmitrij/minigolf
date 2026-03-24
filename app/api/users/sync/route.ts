import type { NextRequest } from "next/server";
import { postSyncUser } from "../../../../lib/users/users.controller";

export async function POST(request: NextRequest) {
	return postSyncUser(request);
}
