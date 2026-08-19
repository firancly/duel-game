// Static definitions for every skin that can exist in the game.
// Lives in shared: server validates/reads slot, client reads image/rarity for UI.
// An ItemInstance only stores { UUID, id }, everything static is looked up here by id.
//
// Weapons are FIXED: every player always has a Rifle, Revolver, and Knife.
// You don't own or equip weapons, you own SKINS and pick one per weapon slot.

export enum WeaponSlot {
	Rifle = "Rifle",
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
	// Knife skins
	[
		"default_knife",
		{
			id: "default_knife",
			name: "Default Knife",
			image: "rbxassetid://128593550552601",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Common,
			tradeable: false,
		},
	],
	[
		"After Paint",
		{
			id: "after_paint",
			name: "After Paint",
			image: "rbxassetid://102311672292659",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"hunter",
		{
			id: "hunter",
			name: "Hunter",
			image: "rbxassetid://109033863000917",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"camo",
		{
			id: "camo",
			name: "Camo",
			image: "rbxassetid://97118502194583",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"frost",
		{
			id: "frost",
			name: "Frost",
			image: "rbxassetid://107445377639643",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"energy_spec",
		{
			id: "energy_spec",
			name: "Energy Spec",
			image: "rbxassetid://112927799235387",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Epic,
			tradeable: true,
		},
	],
	[
		"golden_fang",
		{
			id: "golden_fang",
			name: "Golden Fang",
			image: "rbxassetid://102013605234332",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Legendary,
			tradeable: true,
		},
	],
	[
		"shadow_reaper",
		{
			id: "shadow_reaper",
			name: "Shadow Reaper",
			image: "rbxassetid://112608484033246",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Mythic,
			tradeable: true,
		},
	],
	[
		"lava_blade",
		{
			id: "lava_blade",
			name: "Lava Blade",
			image: "rbxassetid://80741745477535",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Mythic,
			tradeable: true,
		},
	],
	[
		"neon_spec",
		{
			id: "neon_spec",
			name: "Neon Spec",
			image: "rbxassetid://134148467678584",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Epic,
			tradeable: true,
		},
	],

	// Revolver skins
	[
		"default_revolver",
		{
			id: "default_revolver",
			name: "Default Revolver",
			image: "rbxassetid://74539419336401",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: false,
		},
	],
	[
		"matte_black",
		{
			id: "matte_black",
			name: "Matte Black",
			image: "rbxassetid://98381616565628",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"ivory",
		{
			id: "ivory",
			name: "Ivory",
			image: "rbxassetid://122902209697301",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"bronze",
		{
			id: "bronze",
			name: "Bronze",
			image: "rbxassetid://90486449186047",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"urban",
		{
			id: "urban",
			name: "Urban",
			image: "rbxassetid://122183102635057",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"redline",
		{
			id: "redline",
			name: "Redline",
			image: "rbxassetid://97760541553962",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"nightshade",
		{
			id: "nightshade",
			name: "Nightshade",
			image: "rbxassetid://126601167950830",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"voltage",
		{
			id: "voltage",
			name: "Voltage",
			image: "rbxassetid://89607826425416",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Epic,
			tradeable: true,
		},
	],
	[
		"cyber",
		{
			id: "cyber",
			name: "Cyber",
			image: "rbxassetid://77196193804597",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Epic,
			tradeable: true,
		},
	],
	[
		"golden",
		{
			id: "golden",
			name: "Golden",
			image: "rbxassetid://130092227345310",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Legendary,
			tradeable: true,
		},
	],
	[
		"void_walker",
		{
			id: "void_walker",
			name: "Void Walker",
			image: "rbxassetid://121534737883774",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Mythic,
			tradeable: true,
		},
	],
	[
		"hellfire",
		{
			id: "hellfire",
			name: "Hellfire",
			image: "rbxassetid://132248169212673",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Mythic,
			tradeable: true,
		},
	],

	// Rifle skins
	[
		"default_rifle",
		{
			id: "default_rifle",
			name: "Default Rifle",
			image: "rbxassetid://91577678174658",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Common,
			tradeable: false,
		},
	],
	[
		"black_ops",
		{
			id: "black_ops",
			name: "Black Ops",
			image: "rbxassetid://73004033764434",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"arctic",
		{
			id: "arctic",
			name: "Arctic",
			image: "rbxassetid://75523202973032",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"woodland",
		{
			id: "woodland",
			name: "Woodland",
			image: "rbxassetid://80069804020274",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"desert",
		{
			id: "desert",
			name: "Desert",
			image: "rbxassetid://80060960618690",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Common,
			tradeable: true,
		},
	],
	[
		"urban_hex",
		{
			id: "urban_hex",
			name: "Urban Hex",
			image: "rbxassetid://121634156573911",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"redline_rifle",
		{
			id: "redline_rifle",
			name: "Redline",
			image: "rbxassetid://108783290902787",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"tact_blue",
		{
			id: "tact_blue",
			name: "TactBlue",
			image: "rbxassetid://136847837561436",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Rare,
			tradeable: true,
		},
	],
	[
		"electro_core",
		{
			id: "electro_core",
			name: "Electro Core",
			image: "rbxassetid://86313337752058",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Epic,
			tradeable: true,
		},
	],
	[
		"neon_hunter",
		{
			id: "neon_hunter",
			name: "Neon Hunter",
			image: "rbxassetid://114829117150455",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Epic,
			tradeable: true,
		},
	],
	[
		"silent_strike",
		{
			id: "silent_strike",
			name: "Silent Strike",
			image: "rbxassetid://126287560768917",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Legendary,
			tradeable: true,
		},
	],
	[
		"void_harbinger",
		{
			id: "void_harbinger",
			name: "Void Harbinger",
			image: "rbxassetid://123385095317354",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Mythic,
			tradeable: true,
		},
	],
	[
		"inferno",
		{
			id: "inferno",
			name: "Inferno",
			image: "rbxassetid://135182359495478",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Mythic,
			tradeable: true,
		},
	],
]);

export const DEFAULT_SKINS = new Map<WeaponSlot, string>([
	[WeaponSlot.Rifle, "default_rifle"],
	[WeaponSlot.Revolver, "default_revolver"],
	[WeaponSlot.Knife, "default_knife"],
]);

// Convenience: undefined = id not a real skin (use for validation on add/equip).
export function getDef(id: string): SkinDef | undefined {
	return Catalog.get(id);
}
