import { WeaponSlot } from "shared/Catalog";
import { InventoryStateType, ItemInstance } from "../Data/InventoryState";

// 1. The vocabulary: every message type the client can receive
export enum InvAction {
	INIT = "Init", // full snapshot (on join)
	ADD = "Add", // one skin added
	REMOVE = "Remove", // one skin removed
	EQUIP = "Equip", // a slot changed
	UNEQUIP = "Unequip", // a slot reverted to default
}

// 2. Helpers: `items`/`equipped` are already plain records
function ownedToRecord(items: Record<string, ItemInstance[]>): { [id: string]: number } {
	const out: { [id: string]: number } = {};
	for (const [id, copies] of pairs(items)) out[id] = copies.size(); // count only, no uuids
	return out;
}

function equippedToRecord(equipped: Partial<Record<WeaponSlot, string>>): { [slot: string]: string } {
	const out: { [slot: string]: string } = {};
	for (const [slot, id] of pairs(equipped)) out[slot] = id;
	return out;
}

// 3. The builders: each returns the payload shape for one message, no sending.
export class Actions {
	static init(state: InventoryStateType) {
		return {
			owned: ownedToRecord(state.items),
			equipped: equippedToRecord(state.equipped),
		};
	}

	static add(id: string, count: number) {
		return { id, count }; // count = new total for that id
	}

	static remove(id: string, count: number) {
		return { id, count };
	}

	static equip(slot: WeaponSlot, id: string) {
		return { slot, id };
	}

	static unequip(slot: WeaponSlot, id: string) {
		return { slot, id };
	}
}
