import { InventoryStateType } from "server/Inventory/core/InventoryState";
import { SlotManager } from "server/Inventory/core/SlotManager";
import { EquipOperation } from "./EquipOperation";
import { RemoveOperation, RemoveOptions } from "./RemoveOperation";
import { ItemSpawner } from "server/Inventory/world/ItemSpawner";

export interface DropResult {
	success: boolean;
	reason?: string;
	droppedItem?: { id: string; amount: number; metadata?: Map<string, unknown> };
	remaining?: number;
	UUID?: string;
	hotbarCompacted?: boolean;
}

export class DropOperation {
	static execute(
		state: InventoryStateType,
		player: Player,
		slotType: string,
		slot: number,
		amount?: number,
		options?: RemoveOptions,
	): DropResult {
		const uuid = SlotManager.getUUIDFromSlot(state, slotType, slot);
		if (uuid === undefined) {
			return { success: false, reason: "SLOT_EMPTY" };
		}

		const item = state.items.get(uuid);
		if (item === undefined) {
			return { success: false, reason: "ITEM_NOT_FOUND" };
		}

		if (!state.settings.droppable) {
			return { success: false, reason: "INVENTORY_NOT_Droppable" };
		}

		// Value can be either true, false, undefined so we use !== true
		if (item.metadata?.get("Droppable") !== true) {
			return { success: false, reason: "ITEM_NOT_Droppable" };
		}

		// Cache item data before removal
		const itemId = item.id;
		const itemAmount = item.amount;
		const itemMetadata = item.metadata;
		let dropAmount = amount ?? itemAmount;

		if (dropAmount > itemAmount) dropAmount = itemAmount;
		if (dropAmount <= 0) return { success: false, reason: "INVALID_AMOUNT" };

		// If equipped, unequip first (per spec: equipped items go through unequip flow)
		// Only unequip if we are dropping the WHOLE item (or at least, the amount that exists)
		if (state.equippedItemUUID === uuid && itemAmount - dropAmount <= 0) {
			EquipOperation.unequip(state, player);
		}

		// Remove from inventory
		const removeResult = RemoveOperation.execute(state, uuid, dropAmount, options);
		if (!removeResult.success) return { success: false, reason: removeResult.reason };

		ItemSpawner.dropTool(player, itemId, dropAmount, itemMetadata);

		return {
			success: true,
			droppedItem: {
				id: itemId,
				amount: dropAmount,
				metadata: itemMetadata,
			},
			remaining: removeResult.remaining,
			UUID: uuid,
			hotbarCompacted: removeResult.hotbarCompacted,
		};
	}
}
