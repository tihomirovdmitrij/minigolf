import type { NextRequest } from "next/server";
import { postAuth } from "../../../lib/auth/auth.controller";

export async function POST(request: NextRequest) {
	return postAuth(request);
}
