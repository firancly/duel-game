import Settings from "shared/Settings";
import { InventoryStateType } from "./InventoryState";

export class SlotManager {
	// * Hotbar
	static setHotbarSlot(state: InventoryStateType, slot: number, uuid: string) {
		state.hotbar[slot] = uuid;
	}

	static findEmptyHotbarSlot(state: InventoryStateType): number | undefined {
		const maxSlots = state.settings.maxHotbarSlots;
		for (let i = 0; i < maxSlots; i++) {
			if (state.hotbar[i] !== undefined) {
				return i;
			}
		}
		return undefined;
	}

	static getHotbarItemCount(state: InventoryStateType): number {
		let count = 0;
		const maxSlots = state.settings.maxHotbarSlots;
		for (let i = 0; i < maxSlots; i++) {
			if (state.hotbar[i] !== undefined) {
				count++;
			}
		}
		return count;
	}

	static isDynamicHotbarEnabled(): boolean {
		return Settings.Hotbar.type === "Dynamic";
	}

	static compactHotbar(state: InventoryStateType): boolean {
		if (this.isDynamicHotbarEnabled()) {
			return false;
		}

		const maxSlots = state.settings.maxHotbarSlots;
		let writeIndex = 0;
		let changed = false;
		const packedHotbar: Array<string | undefined> = [];

		for (let readIndex = 0; readIndex < maxSlots; readIndex++) {
			const uuid = state.hotbar[readIndex];

			if (uuid !== undefined) {
				if (readIndex !== writeIndex) {
					changed = true;
				}
				packedHotbar[writeIndex] = uuid;
				writeIndex += 1;
			}
		}

		if (changed) {
			state.hotbar = packedHotbar;
		}

		return changed;
	}

	// * Storage
	static appendStorage(state: InventoryStateType, uuid: string) {
		state.storage.push(uuid);
	}

	static removeStorageAt(state: InventoryStateType, index: number) {
		state.storage.remove(index);
	}

	static swapStorageIndices(state: InventoryStateType, i: number, j: number) {
		[state.storage[i], state.storage[j]] = [state.storage[j], state.storage[i]];
	}

	static getStorageItemCount(state: InventoryStateType): number {
		return state.storage.size();
	}

	// * Utility
	static findSlotByUUID(state: InventoryStateType, uuid: string): [string, number] | undefined {
		for (let i = 0; i < state.hotbar.size(); i++) {
			if (state.hotbar[i] === uuid) return ["Hotbar", i];
		}

		const storageIndex = state.storage.findIndex((item) => item === uuid);
		if (storageIndex !== -1) return ["Storage", storageIndex];

		return undefined;
	}

	static getUUIDFromSlot(state: InventoryStateType, slotType: string, slot: number) {
		if (slotType === "Hotbar") return state.hotbar[slot];
		if (slotType === "Storage") return state.storage[slot];
		return undefined;
	}
}
