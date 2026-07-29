import { InventoryStateType, ItemInstance } from "../Data/InventoryState";
import generate from "../Utils/uuid";

export interface AddResult {
	success: boolean;
	reason?: string;
	addedItems?: Array<{ uuid: string; id: string; amount: number }>;
	updatedItems?: Map<string, number>;
}

function createItem(state: InventoryStateType, itemId: string, amount: number) {
	const uuid = generate();

	const item: ItemInstance = {
		UUID: uuid,
		id: itemId,
		amount: amount,
	};

	state.items.set(uuid, item);

	// Update player state to add an item id into the table
	let uuids = state.itemsById.get(itemId);
	if (uuids === undefined) {
		uuids = [];
		state.itemsById.set(itemId, uuids);
	}
	uuids.push(uuid);

	return item;
}

export class AddOperation {
	static execute(state: InventoryStateType, itemId: string, amount?: number) {
		// Prepare metadata get images etc.

		const amountToAdd = amount ?? 1;
		if (amountToAdd <= 0) return { success: false, reason: "INVALID_AMOUNT" };

		const addedItems: Array<{ uuid: string; id: string; amount: number }> = [];
		const item = createItem(state, itemId, amountToAdd);

		addedItems.push({ uuid: item.UUID, id: itemId, amount: amountToAdd });

		const items = state.itemsById.get(itemId);
		const originalAmount = items?.size(); // fetch current item amount from the Inventory

		return {
			success: amountToAdd > 0,
			addedItems,
		};
	}
}
