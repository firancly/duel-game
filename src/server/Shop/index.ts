import { remote } from "shared/Remotes";
import { CaseDef, Cases } from "shared/Cases";
import { Catalog, getDef, Rarity } from "shared/Catalog";
import * as CurrencyService from "server/Currency";
import * as InventoryService from "server/Inventory";
import * as GamepassService from "server/Gamepass";
import * as MissionService from "server/Missions";
import { MissionStat } from "shared/Missions";
import { CaseResultPayload } from "shared/types/Shop";

const openCase = remote("OpenCase", "RemoteEvent"); // C->S: caseId
const caseResult = remote("CaseResult", "RemoteEvent"); // S->C: message text + CaseResultPayload

// weighted random rarity
function rollRarity(weights: { [rarity: string]: number }): string {
	let total = 0;
	for (const [, w] of pairs(weights)) total += w;

	let roll = math.random() * total;
	for (const [rarity, w] of pairs(weights)) {
		roll -= w;
		if (roll <= 0) return rarity as string;
	}
	return Rarity.Common; // fallback
}

function belongsToCase(caseId: string, skinCaseId: string | string[] | undefined): boolean {
	if (skinCaseId === undefined) return false;
	return typeIs(skinCaseId, "string") ? skinCaseId === caseId : skinCaseId.includes(caseId);
}

// tradeable skins of the given rarity that belong to this case
// (defaults are tradeable:false excluded; skins not assigned a caseId can't drop from any crate)
function skinPool(rarity: string, caseId: string): string[] {
	const pool: string[] = [];
	for (const [id, def] of Catalog) {
		if (def.rarity === rarity && def.tradeable && belongsToCase(caseId, def.caseId)) pool.push(id);
	}
	return pool;
}

function randomSkinOfRarity(rarity: string, caseId: string): string | undefined {
	const pool = skinPool(rarity, caseId);
	if (pool.size() === 0) return undefined;
	return pool[math.random(0, pool.size() - 1)];
}

// The case's weights minus rarities it has no skin for. A case that only holds, say, Rare /
// Epic / Mythic skins then keeps the same relative odds between those instead of failing
// (and refunding) every roll that lands on an empty rarity.
function availableWeights(def: CaseDef): { [rarity: string]: number } {
	const weights: { [rarity: string]: number } = {};
	for (const [rarity, weight] of pairs(def.weights)) {
		if (skinPool(rarity as string, def.id).size() > 0) weights[rarity as string] = weight;
	}
	return weights;
}

function currencyOf(def: CaseDef): "coins" | "potions" {
	return def.currency ?? "coins";
}

// take the price in the case's currency (server-authoritative; false if they can't afford it)
function charge(player: Player, def: CaseDef): boolean {
	const result =
		currencyOf(def) === "potions"
			? CurrencyService.spendPotions(player, def.price)
			: CurrencyService.spend(player, def.price);
	return result.success;
}

function refund(player: Player, def: CaseDef) {
	if (currencyOf(def) === "potions") CurrencyService.earnPotions(player, def.price);
	else CurrencyService.earn(player, def.price);
}

function sendFailure(player: Player, caseId: string, text: string) {
	const payload: CaseResultPayload = { ok: false, caseId };
	caseResult.FireClient(player, text, payload);
}

type RollOutcome = { ok: true } | { ok: false; rarity: string };

// Rolls a skin for the case, grants it and tells the client what to reveal. Pricing is
// the caller's job. Fails (granting nothing) when no skin of the rolled rarity exists.
function rollAndGrant(player: Player, def: CaseDef): RollOutcome {
	const rarity = rollRarity(availableWeights(def));
	const skinId = randomSkinOfRarity(rarity, def.id);
	if (skinId === undefined) return { ok: false, rarity };

	InventoryService.addItem(player, skinId);
	MissionService.report(player, MissionStat.OpenCrates);
	const skinDef = getDef(skinId)!;

	// The client holds this until the player has clicked the crate open.
	const payload: CaseResultPayload = { ok: true, caseId: def.id, skinId, rarity };
	caseResult.FireClient(player, `You unboxed ${skinDef.name} [${skinDef.rarity}] from the ${def.name}!`, payload);
	print(`[Shop] ${player.Name} opened ${def.name} → ${skinId} (${rarity})`);
	return { ok: true };
}

// Type shop in chat to open/close the shop gui
function handleOpen(player: Player, caseId: string) {
	const def = Cases.get(caseId);
	if (def === undefined) return;

	if (def.requiredGamepass !== undefined && !GamepassService.hasGamepass(player, def.requiredGamepass)) {
		sendFailure(player, caseId, `You need the ${def.requiredGamepass} gamepass to open ${def.name}.`);
		return;
	}

	if (!charge(player, def)) {
		sendFailure(player, caseId, `Not enough ${currencyOf(def)} for ${def.name}.`);
		return;
	}

	const outcome = rollAndGrant(player, def);
	if (!outcome.ok) {
		refund(player, def); // no skin of that rarity exists
		sendFailure(player, caseId, `No ${outcome.rarity} skin available — refunded.`);
		return;
	}

	if (currencyOf(def) === "coins") MissionService.report(player, MissionStat.SpendCoins, def.price);
}

// Robux purchase of a case (developer product receipt): already paid, so just roll and
// grant. Returns false when nothing could be granted so the receipt is retried, not lost.
export function openPaidCase(player: Player, caseId: string): boolean {
	const def = Cases.get(caseId);
	if (def === undefined) return false;

	const outcome = rollAndGrant(player, def);
	if (!outcome.ok) {
		warn(`[Shop] ${def.name} bought with Robux but no ${outcome.rarity} skin exists - receipt will retry`);
		return false;
	}
	return true;
}

export function init() {
	openCase.OnServerEvent.Connect((player, caseId) => {
		if (typeIs(caseId, "string")) handleOpen(player, caseId);
	});
	print("[ShopService] Initialized");
}
