export type HotbarType = "Static" | "Dynamic";

export type UiPreset = {
	folderName: string;
	guiName: string;
	hookPresetName: string;
};

const Settings = {
	Hotbar: {
		type: "Static" as HotbarType, // Static: fixed slots with holes, Dynamic: packed array (perplayer setting)
		maxSlots: 10, // (perplayer setting)
	},

	// Storage/Backpack Settings (Always Dynamic)
	Storage: {
		limit: 15, // Total weight limit (Hotbar + Storage combined) (perplayer setting)
		canStack: true, // (perplayer setting)
		sorting: true, // (global setting)
		maxStackSize: 5, // (perplayer setting)
		backpackEnabled: true, // (global setting) can disable all backpack functions
		sortOrder: "None", // Name, Rarity, ItemType, None (global setting)
	},

	// Stacking Rules
	Stacking: {
		// Fields that MUST match for items to stack
		requiredFields: ["Rarity", "Type"] as string[], // (global setting)
		// Rarities that can NEVER stack
		blacklist: {
			Legendary: true,
			Mythic: true,
			Special: true,
		} as Record<string, boolean>, // (global setting)

		rarity: true, // (global setting) turned the rarity frame invisible (does not stop stacking with rarities/or sorting with rarities)
	},

	// Gameplay Settings (global settings)
	Gameplay: {
		droppable: true,
		dropDistance: 10,
		mouseScroll: true, // must hover mouse over hotbar
	},

	DifferentUIs: {
		Default: {
			folderName: "StowayGui",
			guiName: "Stoway",
			hookPresetName: "DefaultHooks",
		},
		Admin: {
			folderName: "StowayAdmin",
			guiName: "AdminGui",
			hookPresetName: "AdminHooks",
		},
		Grass: {
			folderName: "StowayGrass",
			guiName: "GrassUi",
			hookPresetName: "GrassHooks",
		},
		Metal: {
			folderName: "StowayMetal",
			guiName: "MetalGUI",
			hookPresetName: "MetalHooks",
		},
	} as Record<string, UiPreset>,
};

export default Settings;
