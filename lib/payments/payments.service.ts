import {
	decodeEventLog,
	erc20Abi,
	type Hash,
	isAddress,
	parseUnits,
	type TransactionReceipt,
} from "viem";
import { getBaseMainnetTransactionReceipt } from "./payments.repository";

type VerifyUsdcTransferInput = {
	txHash: string;
	expectedFromAddress: string;
	expectedAmountUsdc: number;
};

export type PublicPaymentConfig = {
	usdcContractAddress: string;
	receiverWalletAddress: string;
};

export type VerifiedUsdcTransfer = {
	txHash: Hash;
	fromAddress: string;
	toAddress: string;
	amountUsdc: number;
	amountBaseUnits: bigint;
	blockNumber: bigint;
};

export class PaymentVerificationError extends Error {
	public readonly statusCode: number;

	constructor(message: string, statusCode = 422) {
		super(message);
		this.name = "PaymentVerificationError";
		this.statusCode = statusCode;
	}
}

function normalizeAndValidateTransactionHash(rawTxHash: string): Hash {
	const normalized = rawTxHash.trim().toLowerCase();
	if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
		throw new PaymentVerificationError("Invalid transaction hash");
	}
	return normalized as Hash;
}

function requireEnvAddress(envName: string): string {
	const value = process.env[envName];
	if (!value || !isAddress(value, { strict: false })) {
		throw new PaymentVerificationError(`${envName} is missing or invalid`, 500);
	}
	return value.toLowerCase();
}

export function getPublicPaymentConfigFromEnv(): PublicPaymentConfig {
	return {
		usdcContractAddress: requireEnvAddress("USDC_BASE_MAINNET_CONTRACT"),
		receiverWalletAddress: requireEnvAddress("USDC_RECEIVER_WALLET"),
	};
}

function toUsdcBaseUnits(amountUsdc: number): bigint {
	if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
		throw new PaymentVerificationError("Expected USDC amount must be positive", 500);
	}
	return parseUnits(amountUsdc.toFixed(6), 6);
}

function findMatchingUsdcTransferLog(
	receipt: TransactionReceipt,
	usdcContractAddress: string,
	expectedFromAddress: string,
	expectedToAddress: string,
	expectedAmount: bigint,
) {
	return receipt.logs.find((log) => {
		if (log.address.toLowerCase() !== usdcContractAddress) {
			return false;
		}

		try {
			const decoded = decodeEventLog({
				abi: erc20Abi,
				data: log.data,
				topics: log.topics,
				eventName: "Transfer",
			});
			const from = decoded.args.from?.toLowerCase();
			const to = decoded.args.to?.toLowerCase();
			const value = decoded.args.value;
			return (
				from === expectedFromAddress && to === expectedToAddress && value === expectedAmount
			);
		} catch {
			return false;
		}
	});
}

export async function verifyUsdcTransferOnBaseMainnet(
	input: VerifyUsdcTransferInput,
): Promise<VerifiedUsdcTransfer> {
	if (!isAddress(input.expectedFromAddress)) {
		throw new PaymentVerificationError("User wallet address is missing or invalid", 422);
	}

	const txHash = normalizeAndValidateTransactionHash(input.txHash);
	const expectedFromAddress = input.expectedFromAddress.toLowerCase();
	const expectedToAddress = requireEnvAddress("USDC_RECEIVER_WALLET");
	const usdcContractAddress = requireEnvAddress("USDC_BASE_MAINNET_CONTRACT");
	const expectedAmount = toUsdcBaseUnits(input.expectedAmountUsdc);

	const receipt = await getBaseMainnetTransactionReceipt(txHash).catch(() => {
		throw new PaymentVerificationError("Transaction receipt not found");
	});

	if (receipt.status !== "success") {
		throw new PaymentVerificationError("Transaction failed on-chain");
	}

	const transferLog = findMatchingUsdcTransferLog(
		receipt,
		usdcContractAddress,
		expectedFromAddress,
		expectedToAddress,
		expectedAmount,
	);
	if (!transferLog) {
		throw new PaymentVerificationError(
			"USDC transfer mismatch (from/to/amount do not match expected values)",
		);
	}

	return {
		txHash,
		fromAddress: expectedFromAddress,
		toAddress: expectedToAddress,
		amountUsdc: input.expectedAmountUsdc,
		amountBaseUnits: expectedAmount,
		blockNumber: receipt.blockNumber,
	};
}
