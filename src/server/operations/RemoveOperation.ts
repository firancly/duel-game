import { InventoryStateType } from "server/core/InventoryState";
import { LimitChecker } from "server/core/LimitChecker";
import { SlotManager } from "server/core/SlotManager";

export interface RemoveResult {
	success: boolean;
	reason?: string;
	slotType?: string;
	slot?: number;
	remaining?: number;
	hotbarCompacted?: boolean;
}

export interface RemoveOptions {
	skipHotbarCompaction?: boolean;
}

function destroyItem(
	state: InventoryStateType,
	uuid: string,
	itemId: string,
	itemAmount: number,
	options?: RemoveOptions,
): RemoveResult {
	// Find which slot contains this item
	const found = SlotManager.findSlotByUUID(state, uuid);
	const slotType = found?.[0];
	const slot = found?.[1];

	// Unequip if currently equipped
	if (state.equippedItemUUID === uuid) state.equippedItemUUID = undefined;

	// Remove weight
	LimitChecker.removeWeight(state, itemAmount);

	// Remove from Items map
	state.items.delete(uuid);

	// Remove from ItemsByID lookup
	const uuids = state.itemsByID.get(itemId);
	if (uuids) {
		const i = uuids.indexOf(uuid);
		if (i !== -1) uuids.remove(i);

		if (uuids.size() === 0) {
			state.itemsByID.delete(itemId);
		}
	}

	// Remove from slot
	let hotbarCompacted = false;
	if (slotType === "Hotbar" && slot !== undefined) {
		SlotManager.clearHotbarSlot(state, slot); // Preserves hole (Static)
		if (!options?.skipHotbarCompaction) {
			hotbarCompacted = SlotManager.compactHotbar(state);
		}
	} else if (slotType === "Storage" && slot !== undefined) {
		SlotManager.removeStorageAt(state, slot); // Shifts items (Dynamic)
	}

	return { success: true, slotType: slotType, slot: slot, remaining: 0, hotbarCompacted: hotbarCompacted };
}

export class RemoveOperation {
	static execute(state: InventoryStateType, uuid: string, amount?: number, options?: RemoveOptions): RemoveResult {
		const item = state.items.get(uuid);
		if (!item) {
			return { success: false, reason: "ITEM_NOT_FOUND" };
		}

		// Default: remove all if no amount specified
		let _amount = amount ?? item.amount;

		// Validate amount
		if (_amount <= 0) {
			return { success: false, reason: "INVALID_AMOUNT" };
		}

		// Cap to item amount (per spec: if more than stack, remove all)
		if (_amount > item.amount) {
			_amount = item.amount;
		}

		// Reduce or Destroy
		if (item.amount > _amount) {
			item.amount -= _amount;
			LimitChecker.removeWeight(state, _amount);
			const found = SlotManager.findSlotByUUID(state, uuid);
			const slotType = found?.[0];
			const slot = found?.[1];
			return { success: true, slotType: slotType, slot: slot, remaining: item.amount, hotbarCompacted: false };
		} else {
			// Full removal
			return destroyItem(state, uuid, item.id, item.amount, options);
		}
	}

	static executeBySlot(
		state: InventoryStateType,
		slotType: string,
		slot: number,
		amount?: number,
		options?: RemoveOptions,
	): RemoveResult {
		const uuid = SlotManager.getUUIDFromSlot(state, slotType, slot);
		if (uuid === undefined) {
			return { success: false, reason: "SLOT_EMPTY" };
		}
		return RemoveOperation.execute(state, uuid, amount, options);
	}
}
