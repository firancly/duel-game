import { remote } from "shared/Remotes";
import { Cases } from "shared/Cases";
import { Catalog, getDef, Rarity } from "shared/Catalog";
import * as CurrencyService from "server/Currency";
import * as InventoryService from "server/Inventory";
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

// pick a random tradeable skin of the given rarity (defaults are tradeable:false excluded)
function randomSkinOfRarity(rarity: string): string | undefined {
	const pool: string[] = [];
	for (const [id, def] of Catalog) {
		if (def.rarity === rarity && def.tradeable) pool.push(id);
	}
	if (pool.size() === 0) return undefined;
	return pool[math.random(0, pool.size() - 1)];
}

// Type shop in chat to open/close the shop gui
function handleOpen(player: Player, caseId: string) {
	const def = Cases.get(caseId);
	if (def === undefined) return;

	// take the money first (server-authoritative; fails if broke)
	const spent = CurrencyService.spend(player, def.price);
	if (!spent.success) {
		const payload: CaseResultPayload = { ok: false, caseId };
		caseResult.FireClient(player, `Not enough coins for ${def.name}.`, payload);
		return;
	}

	const rarity = rollRarity(def.weights);
	const skinId = randomSkinOfRarity(rarity);
	if (skinId === undefined) {
		CurrencyService.earn(player, def.price); // refund — no skin of that rarity exists
		const payload: CaseResultPayload = { ok: false, caseId };
		caseResult.FireClient(player, `No ${rarity} skin available — refunded.`, payload);
		return;
	}

	InventoryService.addItem(player, skinId);
	const skinDef = getDef(skinId)!;
	// The client holds this until the player has clicked the crate open.
	const payload: CaseResultPayload = { ok: true, caseId, skinId, rarity };
	caseResult.FireClient(player, `You unboxed ${skinDef.name} [${skinDef.rarity}] from the ${def.name}!`, payload);
	print(`[Shop] ${player.Name} opened ${def.name} → ${skinId} (${rarity})`);
}

export function init() {
	openCase.OnServerEvent.Connect((player, caseId) => {
		if (typeIs(caseId, "string")) handleOpen(player, caseId);
	});
	print("[ShopService] Initialized");
}
