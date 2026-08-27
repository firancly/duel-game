import { MarketplaceService, Players } from "@rbxts/services";
import { CoinProducts, findProductById } from "shared/Monetization";
import * as CurrencyService from "server/Currency";

const processed = new Set<string>();

function processReceipt(receipt: ReceiptInfo): Enum.ProductPurchaseDecision {
	if (processed.has(receipt.PurchaseId)) return Enum.ProductPurchaseDecision.PurchaseGranted;

	const player = Players.GetPlayerByUserId(receipt.PlayerId);
	if (player === undefined) return Enum.ProductPurchaseDecision.NotProcessedYet; // retry once they're back

	const offer = findProductById(receipt.ProductId);
	if (offer === undefined) {
		warn(`[Monetization] receipt for unknown product id ${receipt.ProductId} — check shared/Monetization.ts`);
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}

	const result = CurrencyService.earn(player, offer.coins);
	if (!result.success) return Enum.ProductPurchaseDecision.NotProcessedYet;

	processed.add(receipt.PurchaseId);
	print(`[Monetization] ${player.Name} bought ${offer.coins} coins (product ${receipt.ProductId})`);
	return Enum.ProductPurchaseDecision.PurchaseGranted;
}

export function init() {
	if (CoinProducts.some((p) => p.id === 0)) {
		warn("[Monetization] shared/Monetization.ts still has placeholder id: 0 entries — those offers won't charge.");
	}

	MarketplaceService.ProcessReceipt = processReceipt;
	print("[Monetization] Initialized");
}
