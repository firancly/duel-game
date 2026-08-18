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

	let items = state.items.get(itemId);
	if (items === undefined) {
		items = [];
		state.items.set(itemId, items);
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

	// TODO Used by admins to remove items from players inventories
	// static remove(state: InventoryStateType, itemId: string): OperationResult {
	// 	const uuids = state.itemsById.get(itemId);
	// 	if (uuids === undefined || uuids.size() === 0) return { success: false, reason: "NO_ITEM_IN_INVENTORY" };

	// 	const uuid = uuids[0];
	// 	const item = state.items.get(uuid);

	// 	state.items.delete(uuid);
	// 	uuids.remove(0);
	// 	if (uuids.size() === 0) state.itemsById.delete(itemId);

	// 	return {
	// 		success: true,
	// 		changedItem: { uuid: item!.UUID, id: item!.id },
	// 	};
	// }

	static equip(state: InventoryStateType, itemId: string): OperationResult {
		// const uuids = state.itemsById.get(itemId);
		// if (uuids === undefined || uuids.size() === 0) return { success: false, reason: "NO_ITEM_IN_INVENTORY" };

		// const uuid = uuids[0];
		const items = state.items.get(itemId);
		if (items === undefined || items.size() === 0) return { success: false, reason: "NOT_OWNED" };

		const def = getDef(itemId);
		if (def === undefined) return { success: false, reason: "NOT_IN_CATALOG" };

		state.equipped.set(def.slot, itemId); // slot from catalog; set auto-replaces old skin
		warn(`Added ${itemId} to ${def.slot}`);
		return { success: true, changedItem: { id: itemId, uuid: items[0].uuid } };
	}

	// remove one copy of itemId if it was the last copy and equipped, revert to default
	static removeOne(state: InventoryStateType, itemId: string): OperationResult {
		const items = state.items.get(itemId);
		if (items === undefined || items.size() === 0) return { success: false, reason: "NOT_OWNED" };

		const removed = items.pop()!;
		if (items.size() === 0) {
			state.items.delete(itemId);
			const def = getDef(itemId);
			if (def !== undefined && state.equipped.get(def.slot) === itemId) {
				const fallback = DEFAULT_SKINS.get(def.slot);
				if (fallback !== undefined) state.equipped.set(def.slot, fallback);
			}
		}
		return { success: true, changedItem: { id: itemId, uuid: removed.uuid } };
	}

	static unequip() {}
}
