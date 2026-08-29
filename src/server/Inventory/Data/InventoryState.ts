import { WeaponSlot } from "shared/Catalog";

export interface ItemInstance {
	uuid: string; // unique id used for trading
	serial?: number; // later
	obtainedAt?: number; // later
}

export interface InventoryStateType {
	items: Record<string, ItemInstance[]>; // id -> ItemInstance[]
	equipped: Partial<Record<WeaponSlot, string>>; // slot -> equipped skin
}
