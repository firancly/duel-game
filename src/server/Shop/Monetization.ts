import { MarketplaceService, Players } from "@rbxts/services";
import {
	CoinProducts,
	Limiteds,
	findProductById,
	findLimitedById,
	findLimitedByKey,
	findLimitedByGiftProductId,
} from "shared/Monetization";
import { Gamepasses, findGamepassByGiftProductId } from "shared/Gamepasses";
import { remote } from "shared/Remotes";
import * as CurrencyService from "server/Currency";
import * as GamepassService from "server/Gamepass";
import * as InventoryService from "server/Inventory";

const processed = new Set<string>();

// A Limited gifted through its own `giftProductId` (priced 10% under the plain `id`) — buyer
// pays that product, we deliver the bundle's skins to whoever they picked. Same pattern as
// server/Gamepass's pendingGifts, scoped to Limiteds.
interface LimitedGiftIntent {
	recipientUserId: number;
}
const pendingLimitedGifts = new Map<string, LimitedGiftIntent[]>();

function limitedGiftIntentKey(buyerUserId: number, giftProductId: number): string {
	return `${buyerUserId}_${giftProductId}`;
}

const requestLimitedGift = remote("RequestLimitedGift", "RemoteFunction");

// C->S: buyer picked a recipient + bundle in the gift UI, right before prompting the purchase.
function requestLimitedGiftHandler(
	buyer: Player,
	recipientUserId: number,
	key: string,
): { ok: true } | { ok: false; reason: string } {
	const offer = findLimitedByKey(key);
	if (offer === undefined || offer.giftProductId === undefined || offer.giftProductId === 0) {
		return { ok: false, reason: "NOT_GIFTABLE" };
	}
	if (recipientUserId === buyer.UserId) return { ok: false, reason: "SELF" };

	const intentKey = limitedGiftIntentKey(buyer.UserId, offer.giftProductId);
	const queue = pendingLimitedGifts.get(intentKey) ?? [];
	queue.push({ recipientUserId });
	pendingLimitedGifts.set(intentKey, queue);

	return { ok: true };
}

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

// A limited bundle bought plain (not gifted) — adds its fixed skin set straight to the buyer.
function processLimitedReceipt(player: Player, receipt: ReceiptInfo): Enum.ProductPurchaseDecision | undefined {
	const offer = findLimitedById(receipt.ProductId);
	if (offer === undefined) return undefined; // not a limited bundle either

	for (const skinId of offer.skinIds) InventoryService.addItem(player, skinId);

	print(`[Monetization] ${player.Name} bought ${offer.name} (product ${receipt.ProductId})`);
	return Enum.ProductPurchaseDecision.PurchaseGranted;
}

// A limited bundle bought through its separate giftProductId — deliver to whoever the buyer
// picked in the gift UI (requestLimitedGiftHandler recorded it just before this was prompted).
function processLimitedGiftReceipt(player: Player, receipt: ReceiptInfo): Enum.ProductPurchaseDecision | undefined {
	const offer = findLimitedByGiftProductId(receipt.ProductId);
	if (offer === undefined) return undefined; // not a limited gift product either

	const intentKey = limitedGiftIntentKey(player.UserId, receipt.ProductId);
	const queue = pendingLimitedGifts.get(intentKey);
	const intent = queue?.shift();
	if (queue !== undefined && queue.size() === 0) pendingLimitedGifts.delete(intentKey);

	let recipient = player;
	if (intent !== undefined) {
		const recipientPlayer = Players.GetPlayerByUserId(intent.recipientUserId);
		if (recipientPlayer !== undefined) {
			recipient = recipientPlayer;
		} else {
			// Recipient left mid-purchase — Robux already spent, can't refund via API, so give
			// it to the buyer rather than let the purchase vanish.
			warn(`[Monetization] gift recipient for ${offer.name} left the server — granting to buyer instead`);
		}
	} else {
		// No recorded intent (e.g. bought straight off the product's page) — same fallback.
		warn(`[Monetization] gift receipt for ${offer.name} with no pending intent — granting to buyer instead`);
	}

	for (const skinId of offer.skinIds) InventoryService.addItem(recipient, skinId);

	print(`[Monetization] ${player.Name} gifted ${offer.name} to ${recipient.Name} (product ${receipt.ProductId})`);
	return Enum.ProductPurchaseDecision.PurchaseGranted;
}

function processReceipt(receipt: ReceiptInfo): Enum.ProductPurchaseDecision {
	if (processed.has(receipt.PurchaseId)) return Enum.ProductPurchaseDecision.PurchaseGranted;

	const player = Players.GetPlayerByUserId(receipt.PlayerId);
	if (player === undefined) return Enum.ProductPurchaseDecision.NotProcessedYet; // retry once they're back

	const decision =
		processCoinReceipt(player, receipt) ??
		processGiftReceipt(player, receipt) ??
		processLimitedGiftReceipt(player, receipt) ??
		processLimitedReceipt(player, receipt);
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
	if (Limiteds.some((offer) => offer.skinIds.size() === 0)) {
		warn("[Monetization] shared/Monetization.ts has a Limited with no skinIds — buying it grants nothing.");
	}
	if (Limiteds.some((offer) => offer.giftProductId === undefined || offer.giftProductId === 0)) {
		warn(
			"[Monetization] shared/Monetization.ts has a Limited with no giftProductId — its Gift button won't work.",
		);
	}

	MarketplaceService.ProcessReceipt = processReceipt;

	requestLimitedGift.OnServerInvoke = (player, ...args) =>
		requestLimitedGiftHandler(player, args[0] as number, args[1] as string);

	print("[Monetization] Initialized");
}
