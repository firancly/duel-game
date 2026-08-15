import { WeaponSlot } from "shared/Catalog";

export interface ItemInstance {
	uuid: string; // unique id used for trading
	serial?: number; // later
	obtainedAt?: number; // later
}
export interface InventoryStateType {
	player: Player;
	items: Map<string, ItemInstance[]>; // id -> ItemInstance
	equipped: Map<WeaponSlot, string>; // slot -> equipped skin
}

export class InventoryState implements InventoryStateType {
	player: Player;
	items = new Map<string, ItemInstance[]>();
	equipped = new Map<WeaponSlot, string>(); // slot -> equipped skin

	died = false;

	constructor(player: Player) {
		this.player = player;
	}
}
