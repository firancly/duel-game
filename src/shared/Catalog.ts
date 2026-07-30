// Static definitions for every skin that can exist in the game.
// Lives in shared: server validates/reads slot, client reads image/rarity for UI.
// An ItemInstance only stores { UUID, id } — everything static is looked up here by id.
//
// Weapons are FIXED: every player always has a Sniper, Revolver, and Knife.
// You don't own or equip weapons — you own SKINS and pick one per weapon slot.

export enum WeaponSlot {
	Sniper = "Sniper",
	Revolver = "Revolver",
	Knife = "Knife",
}

export enum Rarity {
	Common = "Common",
	Rare = "Rare",
	Epic = "Epic",
	Legendary = "Legendary",
	Mythic = "Mythic",
}

export interface SkinDef {
	id: string; // unique key, matches ItemInstance.id
	name: string; // display name
	image: string; // rbxassetid for UI
	slot: WeaponSlot; // which of the 3 weapons this skin goes on
	rarity: Rarity;
	tradeable: boolean; // gate for the future trade system
}

// id -> definition. Add every new skin here.
export const Catalog = new Map<string, SkinDef>([
	// ── Knife skins ─────────────────────────────────────────────
	[
		"default_knife",
		{
			id: "default_knife",
			name: "Default Knife",
			image: "rbxassetid://0000000003",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Common,
			tradeable: false,
		},
	],
	[
		"seer",
		{
			id: "seer",
			name: "Seer",
			image: "rbxassetid://0000000001",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Mythic,
			tradeable: true,
		},
	],
	[
		"tides",
		{
			id: "tides",
			name: "Tides",
			image: "rbxassetid://0000000002",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],

	// ── Revolver skins ──────────────────────────────────────────
	[
		"default_revolver",
		{
			id: "default_revolver",
			name: "Default Revolver",
			image: "rbxassetid://0000000005",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: false,
		},
	],
	[
		"heat",
		{
			id: "heat",
			name: "Heat",
			image: "rbxassetid://0000000004",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Legendary,
			tradeable: true,
		},
	],

	// ── Sniper skins ────────────────────────────────────────────
	[
		"frost_scope",
		{
			id: "frost_scope",
			name: "Frost Scope",
			image: "rbxassetid://0000000006",
			slot: WeaponSlot.Sniper,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"default_sniper",
		{
			id: "default_sniper",
			name: "Default Sniper",
			image: "rbxassetid://0000000007",
			slot: WeaponSlot.Sniper,
			rarity: Rarity.Common,
			tradeable: false,
		},
	],
]);

export const DEFAULT_SKINS = new Map<WeaponSlot, string>([
	[WeaponSlot.Sniper, "default_sniper"],
	[WeaponSlot.Revolver, "default_revolver"],
	[WeaponSlot.Knife, "default_knife"],
]);

// Convenience: undefined = id not a real skin (use for validation on add/equip).
export function getDef(id: string): SkinDef | undefined {
	return Catalog.get(id);
}
