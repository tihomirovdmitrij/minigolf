import { getPaymentConfig } from "../../../../lib/payments/payments.controller";

export async function GET() {
	return getPaymentConfig();
}
