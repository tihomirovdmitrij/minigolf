import { NextResponse } from "next/server";
import { getPublicPaymentConfigFromEnv, PaymentVerificationError } from "./payments.service";

export async function getPaymentConfig() {
	try {
		const config = getPublicPaymentConfigFromEnv();
		return NextResponse.json({
			success: true,
			config,
		});
	} catch (error) {
		if (error instanceof PaymentVerificationError) {
			return NextResponse.json({ message: error.message }, { status: error.statusCode });
		}
		if (error instanceof Error) {
			return NextResponse.json({ message: error.message }, { status: 500 });
		}
		throw error;
	}
}
