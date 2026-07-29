export interface ItemInstance {
	UUID: string;
	id: string;
	amount: number;
	metadata?: Map<string, unknown>;
}

export interface InventoryStateType {
	player: Player;
	items: Map<string, ItemInstance>;
	itemsById: Map<string, string[]>;
	equippedItemsUUID?: string[];
}

export class InventoryState implements InventoryStateType {
	player: Player;
	items = new Map<string, ItemInstance>();
	itemsById = new Map<string, string[]>();
	equippedItemsUUID?: string[] | undefined;

	died = false;

	constructor(player: Player) {
		this.player = player;
	}
}
