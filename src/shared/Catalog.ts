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
	DeathEffect = "DeathEffect",
}

export enum Rarity {
	Common = "Common",
	Rare = "Rare",
	Epic = "Epic",
	Legendary = "Legendary",
	Mythic = "Mythic",
	Exclusive = "Exclusive",
}

// Rarity -> colour, used by the crate reveal (light + billboard stroke).
// Lives here so any future UI colours rarity the same way.
export const RarityColor = new Map<Rarity, Color3>([
	[Rarity.Common, Color3.fromRGB(180, 185, 195)],
	[Rarity.Rare, Color3.fromRGB(70, 145, 255)],
	[Rarity.Epic, Color3.fromRGB(170, 85, 255)],
	[Rarity.Legendary, Color3.fromRGB(255, 165, 40)],
	[Rarity.Mythic, Color3.fromRGB(255, 65, 65)],
	[Rarity.Exclusive, Color3.fromRGB(0, 220, 220)],
]);

export interface SkinDef {
	id: string; // unique key, matches ItemInstance.id
	name: string; // display name
	image: string; // rbxassetid for UI
	slot: WeaponSlot; // which of the 3 weapons this skin goes on
	rarity: Rarity;
	tradeable: boolean; // gate for the future trade system
	model?: string; // child name under ReplicatedStorage/Assets/Weapons, for the crate reveal
	caseId?: string | string[]; // which Cases.ts entry(ies) can drop this skin; undefined = not obtainable from a crate (e.g. defaults)
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
			model: "default_knife",
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
			caseId: "YellowCase",
			model: "knifeafterpaint",
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
			caseId: "YellowCase",
			model: "knifeHunter",
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
			caseId: "YellowCase",
			model: "knifeArmyCamo",
		},
	],
	[
		"frost",
		{
			id: "frost",
			name: "Frost",
			image: "rbxassetid://107445377639643",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Legendary,
			tradeable: true,
			caseId: "GreenCase",
			model: "knifeFrost",
		},
	],
	[
		"energy_spec",
		{
			id: "energy_spec",
			name: "Energy Spec",
			image: "rbxassetid://112927799235387",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Mythic,
			tradeable: true,
			caseId: "BlueCase",
			model: "EnergySpecKnife",
		},
	],
	[
		"golden_fang",
		{
			id: "golden_fang",
			name: "Golden Fang",
			image: "rbxassetid://102013605234332",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Mythic,
			tradeable: true,
			caseId: "PurpleCase",
			model: "GoldenDagger",
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
			caseId: ["YellowCase", "PlusCase"],
			model: "ShadowReaper",
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
			caseId: ["YellowCase", "PlusCase"],
			model: "LavaBlade",
		},
	],
	[
		"knife_blood",
		{
			id: "knife_blood",
			name: "Blood",
			image: "rbxassetid://109744092152493",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Mythic,
			tradeable: true,
			caseId: "GreenCase",
			model: "knifeBlood",
		},
	],
	[
		"neon_spec",
		{
			id: "neon_spec",
			name: "Neon Spec",
			image: "rbxassetid://134148467678584",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Legendary,
			tradeable: true,
			caseId: "YellowCase",
			model: "NeonSpecKnife",
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
			model: "revolver",
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
			caseId: "GreenCase",
			model: "revolverMatteBlack",
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
			caseId: "GreenCase",
			model: "revolverIvory",
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
			caseId: "GreenCase",
			model: "revolverBronze",
		},
	],
	[
		"urban",
		{
			id: "urban",
			name: "Urban",
			image: "rbxassetid://122183102635057",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: true,
			caseId: "BlueCase",
			model: "revolverUrbanSteel",
		},
	],
	[
		"redline",
		{
			id: "redline",
			name: "Redline",
			image: "rbxassetid://97760541553962",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: true,
			caseId: "PurpleCase",
			model: "revolverRedline",
		},
	],
	[
		"nightshade",
		{
			id: "nightshade",
			name: "Nightshade",
			image: "rbxassetid://126601167950830",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Common,
			tradeable: true,
			caseId: "BlueCase",
			model: "revolverNightShade",
		},
	],
	[
		"voltage",
		{
			id: "voltage",
			name: "Voltage",
			image: "rbxassetid://89607826425416",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Legendary,
			tradeable: true,
			caseId: "BlueCase",
			model: "VoltageMagnum",
		},
	],
	[
		"cyber",
		{
			id: "cyber",
			name: "Cyber",
			image: "rbxassetid://77196193804597",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: "PurpleCase",
			model: "CyberMagnum",
		},
	],
	[
		"golden",
		{
			id: "golden",
			name: "Golden",
			image: "rbxassetid://130092227345310",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: "PurpleCase",
			model: "GoldenFangRevolver",
		},
	],
	[
		"void_walker",
		{
			id: "void_walker",
			name: "Void Walker",
			image: "rbxassetid://121534737883774",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: ["YellowCase", "PlusCase"],
			model: "VoidWalker",
		},
	],
	[
		"hellfire",
		{
			id: "hellfire",
			name: "Hellfire",
			image: "rbxassetid://132248169212673",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: ["YellowCase", "PlusCase"],
			model: "HellfireRevolver",
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
			model: "rifle",
		},
	],
	[
		"black_ops",
		{
			id: "black_ops",
			name: "Black Ops",
			image: "rbxassetid://73004033764434",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Epic,
			tradeable: true,
			caseId: "GreenCase",
			model: "rifleBlackOps",
		},
	],
	[
		"arctic",
		{
			id: "arctic",
			name: "Arctic",
			image: "rbxassetid://75523202973032",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: "GreenCase",
			model: "rifleArctic",
		},
	],
	[
		"woodland",
		{
			id: "woodland",
			name: "Woodland",
			image: "rbxassetid://80069804020274",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: "GreenCase",
			model: "rifleWoodland",
		},
	],
	[
		"desert",
		{
			id: "desert",
			name: "Desert",
			image: "rbxassetid://80060960618690",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: "GreenCase",
			model: "rifleDesert",
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
			caseId: "BlueCase",
			model: "ak47UrbanHex",
		},
	],
	[
		"redline_rifle",
		{
			id: "redline_rifle",
			name: "Redline",
			image: "rbxassetid://108783290902787",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Common,
			tradeable: true,
			caseId: "PurpleCase",
			model: "ak47Redline",
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
			caseId: ["BlueCase", "PlusCase"],
			model: "ak47TactBlue",
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
			caseId: "BlueCase",
			model: "m4ElectricCore",
		},
	],
	[
		"neon_hunter",
		{
			id: "neon_hunter",
			name: "Neon Hunter",
			image: "rbxassetid://114829117150455",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Legendary,
			tradeable: true,
			caseId: "PurpleCase",
			model: "m4NeonHunter",
		},
	],
	[
		"silent_strike",
		{
			id: "silent_strike",
			name: "Silent Strike",
			image: "rbxassetid://126287560768917",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Epic,
			tradeable: true,
			caseId: ["PurpleCase", "PlusCase"],
			model: "SilentStrikeSniper",
		},
	],
	[
		"void_harbinger",
		{
			id: "void_harbinger",
			name: "Void Harbinger",
			image: "rbxassetid://123385095317354",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Epic,
			tradeable: true,
			caseId: ["YellowCase", "PlusCase"],
			model: "VoidHarbingerAr",
		},
	],
	[
		"inferno",
		{
			id: "inferno",
			name: "Inferno",
			image: "rbxassetid://135182359495478",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Epic,
			tradeable: true,
			caseId: ["YellowCase", "PlusCase"],
			model: "InfernoAr",
		},
	],

	// Death Effects
	[
		"default_effect",
		{
			id: "default_effect",
			name: "Default Effect",
			image: "rbxassetid://71411711247358",
			slot: WeaponSlot.DeathEffect,
			rarity: Rarity.Common,
			tradeable: true,
			model: "Simple Powder",
		},
	],
	[
		"energy_impact",
		{
			id: "energy_impact",
			name: "Energy Impact",
			image: "rbxassetid://112866346941643",
			slot: WeaponSlot.DeathEffect,
			rarity: Rarity.Rare,
			tradeable: true,
			caseId: "RedCase",
			model: "Energy Impact",
		},
	],
	[
		"glitch_break",
		{
			id: "glitch_break",
			name: "Glitch Break",
			image: "rbxassetid://98945900813516",
			slot: WeaponSlot.DeathEffect,
			rarity: Rarity.Epic,
			tradeable: true,
			caseId: "RedCase",
			model: "Glitch Break",
		},
	],
	[
		"energy_burst",
		{
			id: "energy_burst",
			name: "Energy Burst",
			image: "rbxassetid://78040790573378",
			slot: WeaponSlot.DeathEffect,
			rarity: Rarity.Legendary,
			tradeable: true,
			caseId: "RedCase",
			model: "Energy Burst",
		},
	],
	[
		"inferno_collapse",
		{
			id: "inferno_collapse",
			name: "Inferno Collapse ",
			image: "rbxassetid://79027102371771",
			slot: WeaponSlot.DeathEffect,
			rarity: Rarity.Mythic,
			tradeable: true,
			caseId: "RedCase",
			model: "Inferno Collapse",
		},
	],
	[
		"void_erasure",
		{
			id: "void_erasure",
			name: "Void Erasure ",
			image: "rbxassetid://109896768685726",
			slot: WeaponSlot.DeathEffect,
			rarity: Rarity.Mythic,
			tradeable: true,
			caseId: "RedCase",
			model: "Void Erasure",
		},
	],

	// Exclusive skins never drop from a crate. Granted by owning a GamePass
	// (SetClown/LimitedBundle/Plus, see shared/Gamepasses.ts) or the Limited bundle dev
	// product (see shared/Monetization.ts), wired in server/Gamepass and Shop/Monetization.
	[
		"clown_knife",
		{
			id: "clown_knife",
			name: "Clown Knife",
			image: "115078168421020",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "KnifeClown",
		},
	],
	[
		"clown_revolver",
		{
			id: "clown_revolver",
			name: "Clown Revolver",
			image: "108150556777435",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "RevolverClown",
		},
	],
	[
		"clown_rifle",
		{
			id: "clown_rifle",
			name: "Clown Rifle",
			image: "110932845783102",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "RifleClown",
		},
	],
	[
		"bunny_knife",
		{
			id: "bunny_knife",
			name: "Bunny Knife",
			image: "70498879481873",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "KnifeBunny",
		},
	],
	[
		"bunny_revolver",
		{
			id: "bunny_revolver",
			name: "Bunny Revolver",
			image: "89582338283207",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "RevolverBunny",
		},
	],
	[
		"bunny_rifle",
		{
			id: "bunny_rifle",
			name: "Bunny Rifle",
			image: "133673579511371",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "RifleBunny",
		},
	],
	[
		"monster_knife",
		{
			id: "monster_knife",
			name: "Monster Knife",
			image: "82984634841435",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "KnifeMonster",
		},
	],
	[
		"monster_revolver",
		{
			id: "monster_revolver",
			name: "Monster Revolver",
			image: "118755764803986",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "RevolverMonster",
		},
	],
	[
		"monster_rifle",
		{
			id: "monster_rifle",
			name: "Monster Rifle",
			image: "111204684412544",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Exclusive,
			tradeable: true,
			model: "RifleMonster",
		},
	],
	[
		"plus_knife",
		{
			id: "plus_knife",
			name: "Plus Knife",
			image: "109018950683268",
			slot: WeaponSlot.Knife,
			rarity: Rarity.Exclusive,
			tradeable: true,
			caseId: "PlusCase",
			model: "KnifePlus",
		},
	],
	[
		"plus_revolver",
		{
			id: "plus_revolver",
			name: "Plus Revolver",
			image: "94675130514431",
			slot: WeaponSlot.Revolver,
			rarity: Rarity.Exclusive,
			tradeable: true,
			caseId: "PlusCase",
			model: "RevolverPlus",
		},
	],
	[
		"plus_rifle",
		{
			id: "plus_rifle",
			name: "Plus Rifle",
			image: "115991414856384",
			slot: WeaponSlot.Rifle,
			rarity: Rarity.Exclusive,
			tradeable: true,
			caseId: "PlusCase",
			model: "RiflePlus",
		},
	],
]);

export const DEFAULT_SKINS = new Map<WeaponSlot, string>([
	[WeaponSlot.Rifle, "default_rifle"],
	[WeaponSlot.Revolver, "default_revolver"],
	[WeaponSlot.Knife, "default_knife"],
	[WeaponSlot.DeathEffect, "default_effect"],
]);

// Convenience: undefined = id not a real skin (use for validation on add/equip).
export function getDef(id: string): SkinDef | undefined {
	return Catalog.get(id);
}
