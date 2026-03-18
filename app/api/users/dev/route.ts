import type { NextRequest } from "next/server";
import { postDevUser } from "../../../../lib/users/users.controller";

export async function POST(request: NextRequest) {
	return postDevUser(request);
}
