import { getDef, DEFAULT_SKINS } from "shared/Catalog";
import { InventoryStateType, ItemInstance } from "../Data/InventoryState";
import generate from "../Utils/uuid";

// export interface OperationResult {
// 	success: boolean;
// 	reason?: string;
// 	changedItem?: { id: string; uuid: string };
// }

// Union type to make sure that if success is true, changedItem is present, and if success is false, reason is present. This makes it easier to handle the result of operations without having to check for undefined values.
export type OperationResult =
	{ success: true; changedItem: { id: string; uuid: string } } | { success: false; reason: string };

function createItem(state: InventoryStateType, itemId: string): ItemInstance {
	const uuid = generate();

	// TODO add serial and obtainedAt to ItemInstance

	const item: ItemInstance = {
		uuid: uuid,
	};

	let items = state.items[itemId];
	if (items === undefined) {
		items = [];
		state.items[itemId] = items;
	}
	items.push(item);

	return item;
}

export class Operations {
	static add(state: InventoryStateType, itemId: string): OperationResult {
		const def = getDef(itemId);
		if (def === undefined) return { success: false, reason: "NOT_IN_CATALOG" };

		const item = createItem(state, itemId);
		return {
			success: true,
			changedItem: { id: itemId, uuid: item.uuid },
		};
	}

	static equip(state: InventoryStateType, itemId: string): OperationResult {
		// const uuids = state.itemsById.get(itemId);
		// if (uuids === undefined || uuids.size() === 0) return { success: false, reason: "NO_ITEM_IN_INVENTORY" };

		// const uuid = uuids[0];
		const items = state.items[itemId];
		if (items === undefined || items.size() === 0) return { success: false, reason: "NOT_OWNED" };

		const def = getDef(itemId);
		if (def === undefined) return { success: false, reason: "NOT_IN_CATALOG" };

		state.equipped[def.slot] = itemId; // slot from catalog; assigning replaces the old skin
		warn(`Added ${itemId} to ${def.slot}`);
		return { success: true, changedItem: { id: itemId, uuid: items[0].uuid } };
	}

	// remove one copy of itemId if it was the last copy and equipped, revert to default
	static remove(state: InventoryStateType, itemId: string): OperationResult {
		const items = state.items[itemId];
		if (items === undefined || items.size() === 0) return { success: false, reason: "NOT_OWNED" };

		const removed = items.pop()!;
		if (items.size() === 0) {
			delete state.items[itemId];
			const def = getDef(itemId);
			if (def !== undefined && state.equipped[def.slot] === itemId) {
				const fallback = DEFAULT_SKINS.get(def.slot);
				if (fallback !== undefined) state.equipped[def.slot] = fallback;
			}
		}
		return { success: true, changedItem: { id: itemId, uuid: removed.uuid } };
	}

	static unequip() {}
}
