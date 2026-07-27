import Settings from "shared/Settings";

export interface ItemInstance {
	UUID: string;
	id: string;
	amount: number;
	metadata?: Map<string, unknown>;
}

export interface PlayerSettings {
	limit: number; // Weight limit (0 = infinite)
	canStack: boolean; // Allow stacking
	maxStackSize: number; // Max items per stack
	maxHotbarSlots: number; // Number of hotbar slots
	droppable: boolean; // Allow dropping
	uiType: string; // Interface version to load (default, admin, mod, developer, content, spec, etc)
}

export interface InventoryStateType {
	player: Player;
	items: Map<string, ItemInstance>; // UUID -> Item
	itemsByID: Map<string, string[]>; // ItemId -> array of UUIDs (stacking lookup)
	hotbar: Array<string | undefined>; // slot index -> UUID (holes allowed via undefined)
	storage: string[]; // packed array of UUIDs (no holes)
	equippedItemUUID?: string; // UUID of equipped item, or undefined
	weight: number; // sum of all stack amounts
	settings: PlayerSettings; // per-player settings (mutable)
}

export class InventoryState implements InventoryStateType {
	player: Player;
	items = new Map<string, ItemInstance>();
	itemsByID = new Map<string, string[]>();
	hotbar: Array<string | undefined> = [];
	storage: string[] = [];
	equippedItemUUID?: string;
	weight = 0;
	settings: PlayerSettings;
	died = false;

	constructor(player: Player) {
		this.player = player;

		this.settings = {
			droppable: Settings.Gameplay.droppable,
			limit: Settings.Storage.limit,
			canStack: Settings.Storage.canStack,
			maxStackSize: Settings.Storage.maxStackSize,
			maxHotbarSlots: Settings.Hotbar.maxSlots,
			uiType: "default",
		};
	}

	getItem(uuid: string): ItemInstance | undefined {
		return this.items.get(uuid);
	}

	getHotbarUUID(slot: number): string | undefined {
		return this.hotbar[slot];
	}

	getStorageUUID(index: number): string {
		return this.storage[index];
	}

	isEquipped(uuid: string): boolean {
		return this.equippedItemUUID === uuid;
	}
}
