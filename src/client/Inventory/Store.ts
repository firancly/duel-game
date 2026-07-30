import { WeaponSlot } from "shared/Catalog";

class InventoryStore {
	owned = new Map<string, number>(); // id -> count
	equipped = new Map<WeaponSlot, string>(); // slot -> id

	private listeners: Array<() => void> = [];

	// UI subscribes to re-render on any change
	subscribe(fn: () => void) {
		this.listeners.push(fn);
	}

	private changed() {
		for (const fn of this.listeners) fn();
	}

	init(snapshot: { owned: { [id: string]: number }; equipped: { [slot: string]: string } }) {
		this.owned.clear();
		this.equipped.clear();
		for (const [id, count] of pairs(snapshot.owned)) this.owned.set(id as string, count);
		for (const [slot, id] of pairs(snapshot.equipped)) this.equipped.set(slot as WeaponSlot, id);
		this.changed();
	}

	applyAdd(id: string, count: number) {
		this.owned.set(id, count); // count = new total
		this.changed();
	}
	applyRemove(id: string, count: number) {
		if (count <= 0) this.owned.delete(id);
		else this.owned.set(id, count);
		this.changed();
	}
	applyEquip(slot: string, id: string) {
		this.equipped.set(slot as WeaponSlot, id);
		this.changed();
	}
	applyUnequip(slot: string, id: string) {
		this.equipped.set(slot as WeaponSlot, id);
		this.changed();
	}
}

export const Store = new InventoryStore(); // one shared instance
