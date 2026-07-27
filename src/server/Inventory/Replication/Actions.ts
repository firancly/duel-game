import { InventoryStateType, ItemInstance, PlayerSettings } from "server/Inventory/core/InventoryState";

export enum ActionType {
	INIT = "Init", // Full state sync (join/respawn)
	ADD = "Add", // Item added
	REMOVE = "Remove", // Item removed
	SWAP = "Swap", // Slots swapped
	EQUIP = "Equip", // Equipped item changed
	UPDATE_META = "UpdateMeta", // Item metadata updated
	UPDATE_SETTINGS = "UpdateSettings", // Settings updated
	RELOAD = "Reload", // Reload client interface/config
}

export class Actions {
	static init(state: InventoryStateType) {
		return {
			items: state.items,
			hotbar: state.hotbar,
			storage: state.storage,
			equippedUUID: state.equippedItemUUID,
			weight: state.weight,
			settings: state.settings,
		};
	}

	static updateSettings(settings: PlayerSettings) {
		return settings;
	}

	static reload(uiType: string, data?: unknown) {
		return { uiType, data };
	}

	static add(addedItems: Array<{ uuid: string; slotType: string; slot: number }>, items: Map<string, ItemInstance>) {
		const slots = addedItems.map((added) => ({
			uuid: added.uuid,
			slotType: added.slotType,
			slot: added.slot,
			item: items.get(added.uuid),
		}));
		return { slots };
	}

	static remove(slotType: string, slot: number, uuid: string) {
		return { uuid, slotType, slot };
	}

	static swap(fromType: string, fromSlot: number, toType: string, toSlot: number) {
		return {
			from: { type: fromType, slot: fromSlot },
			to: { type: toType, slot: toSlot },
		};
	}

	static equip(uuid?: string) {
		return { uuid };
	}

	static updateMeta(uuid: string, updates: Map<string, unknown>, newWeight: number) {
		return { uuid, updates, newWeight };
	}
}
