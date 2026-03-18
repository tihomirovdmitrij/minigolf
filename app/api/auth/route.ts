import type { NextRequest } from "next/server";
import { getAuth } from "../../../lib/auth/auth.controller";

export async function GET(request: NextRequest) {
	return getAuth(request);
}
