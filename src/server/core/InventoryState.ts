export interface ItemInstance {
	UUID: string,
	id: number,
	amount: number,
	metadata?: {};
}

export interface PlayerSettings {
	limit: number,             // Weight limit (0 = infinite)
	canStack: boolean,         // Allow stacking
	maxStackSize: number,      // Max items per stack
	maxHotbarSlots: number,    // Number of hotbar slots
	droppable: boolean,        // Allow dropping
	uiType: string, 		   // Interface version to load (default, admin, mod, developer, content, spec, etc)
}

export interface InventoryStateType {
	player: Player;
	items: Map<string, ItemInstance>;        // UUID -> Item
	itemsByID: Map<string, string[]>;         // ItemId -> array of UUIDs (stacking lookup)
	hotbar: Array<string | undefined>;        // slot index -> UUID (holes allowed via undefined)
	storage: string[];                        // packed array of UUIDs (no holes)
	equippedItemUUID: string | undefined;     // UUID of equipped item, or undefined
	weight: number;                           // sum of all stack amounts
	settings: PlayerSettings;                 // per-player settings (mutable)
}