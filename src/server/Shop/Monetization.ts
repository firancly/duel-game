import { MarketplaceService, Players } from "@rbxts/services";
import { CoinProducts, findProductById } from "shared/Monetization";
import { Gamepasses, findGamepassByGiftProductId } from "shared/Gamepasses";
import * as CurrencyService from "server/Currency";
import * as GamepassService from "server/Gamepass";

const processed = new Set<string>();

function processCoinReceipt(player: Player, receipt: ReceiptInfo): Enum.ProductPurchaseDecision | undefined {
	const offer = findProductById(receipt.ProductId);
	if (offer === undefined) return undefined; // not a coin product, let another handler look at it

	const result = CurrencyService.earn(player, offer.coins);
	if (!result.success) return Enum.ProductPurchaseDecision.NotProcessedYet;

	print(`[Monetization] ${player.Name} bought ${offer.coins} coins (product ${receipt.ProductId})`);
	return Enum.ProductPurchaseDecision.PurchaseGranted;
}

// Gifting a GamePass has no native Roblox flow — buyer pays this dev product, and we deliver
// ownership to whoever they picked in the gift UI (server/Gamepass.requestGift recorded it).
function processGiftReceipt(player: Player, receipt: ReceiptInfo): Enum.ProductPurchaseDecision | undefined {
	const gp = findGamepassByGiftProductId(receipt.ProductId);
	if (gp === undefined) return undefined; // not a gift product either

	const recipientUserId = GamepassService.fulfillGiftReceipt(player.UserId, receipt.ProductId);
	if (recipientUserId === undefined) {
		// No recorded intent (e.g. bought straight off the product's page) — can't refund Robux
		// via API, so give it to the buyer rather than let the purchase vanish.
		warn(`[Monetization] gift receipt for ${gp.name} with no pending intent — granting to buyer instead`);
		GamepassService.deliverGift(player.UserId, gp.key);
	}

	print(`[Monetization] ${player.Name} gifted ${gp.name} (product ${receipt.ProductId})`);
	return Enum.ProductPurchaseDecision.PurchaseGranted;
}

function processReceipt(receipt: ReceiptInfo): Enum.ProductPurchaseDecision {
	if (processed.has(receipt.PurchaseId)) return Enum.ProductPurchaseDecision.PurchaseGranted;

	const player = Players.GetPlayerByUserId(receipt.PlayerId);
	if (player === undefined) return Enum.ProductPurchaseDecision.NotProcessedYet; // retry once they're back

	const decision = processCoinReceipt(player, receipt) ?? processGiftReceipt(player, receipt);
	if (decision === undefined) {
		warn(`[Monetization] receipt for unknown product id ${receipt.ProductId} — check shared/Monetization.ts`);
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}
	if (decision === Enum.ProductPurchaseDecision.PurchaseGranted) processed.add(receipt.PurchaseId);
	return decision;
}

export function init() {
	if (CoinProducts.some((p) => p.id === 0)) {
		warn("[Monetization] shared/Monetization.ts still has placeholder id: 0 entries — those offers won't charge.");
	}
	if (Gamepasses.some((gp) => gp.giftProductId === undefined || gp.giftProductId === 0)) {
		warn(
			"[Monetization] shared/Gamepasses.ts still has passes with no giftProductId — their Gift button won't work.",
		);
	}

	MarketplaceService.ProcessReceipt = processReceipt;
	print("[Monetization] Initialized");
}
