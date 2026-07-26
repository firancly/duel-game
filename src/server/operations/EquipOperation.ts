import { InventoryStateType } from "server/core/InventoryState";
import { SlotManager } from "server/core/SlotManager";
import { ItemSpawner } from "server/world/ItemSpawner";

export interface EquipResult {
	success: boolean;
	reason?: string;
	previousUUID?: string;
	currentUUID?: string;
}

export class EquipOperation {
	static equip(state: InventoryStateType, player: Player, uuid: string): EquipResult {
		const item = state.items.get(uuid);
		if (item === undefined) return { success: false, reason: "ITEM_NOT_FOUND" };

		const previousUUID = state.equippedItemUUID;

		if (previousUUID === uuid) return { success: true, reason: "Item is already equipped" };

		if (previousUUID !== undefined && previousUUID !== uuid) this.unequip(state, player);

		state.equippedItemUUID = uuid;

		// TODO v
		// ItemSpawner.spawnTool(player, item.id, item.metadata);

		return { success: true, previousUUID: previousUUID, currentUUID: uuid };
	}

	static equipBySlot(state: InventoryStateType, player: Player, slotType: string, slot: number): EquipResult {
		const uuid = SlotManager.getUUIDFromSlot(state, slotType, slot);
		if (uuid === undefined) return { success: false, reason: "SLOT_EMPTY" };

		return this.equip(state, player, uuid);
	}

	static unequip(state: InventoryStateType, player: Player): EquipResult {
		if (state.equippedItemUUID === undefined) return { success: false, reason: "NOTHING_EQUIPPED" };

		const previousUUID = state.equippedItemUUID;

		state.equippedItemUUID = undefined;

		const character: Model = player.Character ?? player.CharacterAdded.Wait()[0];
		if (character !== undefined) {
			const children = character.GetChildren();
			children.forEach((child) => {
				// TODO: v
				if (child.IsA("Tool")) ItemSpawner.despawnTool(player, child);
			});
		}

		return { success: true, previousUUID: previousUUID, currentUUID: undefined };
	}
	static validateEquipped(state: InventoryStateType, player: Player): boolean {
		if (state.equippedItemUUID === undefined) return true;

		const item = state.items.get(state.equippedItemUUID);
		if (item === undefined) {
			state.equippedItemUUID = undefined;

			const character = player.Character;
			if (character !== undefined) {
				const tool = character.FindFirstChildOfClass("Tool");
				if (tool !== undefined) tool.Destroy();
			}
			return false;
		}

		return true;
	}
}
