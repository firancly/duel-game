import { InventoryStateType, ItemInstance } from "server/core/InventoryState";
import { LimitChecker } from "server/core/LimitChecker";
import Settings from "shared/Settings";

export class StackChecker {
	static canStack(item1: ItemInstance, item2: ItemInstance): boolean {
		if (item1.id !== item2.id) return false;

		const meta1: Map<string, unknown> = item1.metadata ?? new Map();
		const meta2: Map<string, unknown> = item2.metadata ?? new Map();

		for (const field of Settings.Stacking.requiredFields) {
			if (meta1.get(field) !== meta2.get(field)) return false;
		}

		const rarity = meta1.get("Rarity");
		if (rarity !== undefined && Settings.Stacking.blacklist[rarity as string]) {
			return false;
		}

		for (const [k, v] of meta1) {
			if (meta2.get(k) !== v) return false;
		}
		for (const [k, v] of meta2) {
			if (meta1.get(k) !== v) return false;
		}

		return true;
	}

	static tryStack(
		state: InventoryStateType,
		itemId: string,
		amount: number,
		metadata?: Map<string, unknown>,
	): [number, Map<string, number>] {
		if (!state.settings.canStack) return [0, new Map()];

		let totalStacked = 0;
		const updatedItems = new Map<string, number>();
		const existingUUIDs = state.itemsByID.get(itemId);

		if (existingUUIDs === undefined) return [0, new Map()];

		const newItemProxy: ItemInstance = { UUID: "", id: itemId, amount: 0, metadata: metadata ?? new Map() };
		const maxStackSize = state.settings.maxStackSize;

		for (const uuid of existingUUIDs) {
			if (amount <= 0) break;

			const existingItem = state.items.get(uuid);
			if (existingItem && this.canStack(newItemProxy, existingItem)) {
				const space = maxStackSize - existingItem.amount;
				if (space > 0) {
					const toAdd = math.min(amount, space);
					existingItem.amount += toAdd;
					amount -= toAdd;
					totalStacked += toAdd;
					updatedItems.set(uuid, existingItem.amount);

					// Update weight for stacked amount
					LimitChecker.addWeight(state, toAdd);
				}
			}
		}

		return [totalStacked, updatedItems];
	}
}
