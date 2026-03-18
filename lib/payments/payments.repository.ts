import { createPublicClient, type Hash, http } from "viem";
import { base } from "viem/chains";

const baseMainnetClient = createPublicClient({
	chain: base,
	transport: http(),
});

export async function getBaseMainnetTransactionReceipt(txHash: Hash) {
	return baseMainnetClient.getTransactionReceipt({ hash: txHash });
}

export async function getBaseMainnetTransaction(txHash: Hash) {
	return baseMainnetClient.getTransaction({ hash: txHash });
}
