import { Rarity } from "./Catalog";

// How many clicks on the 3D crate are needed to pop it open.
export const CLICKS_TO_OPEN = 0;

// A shop case: costs `price`, rolls a rarity by `weights`, then gives a random
// skin of that rarity. Weights are relative odds (don't need to sum to 100).
export interface CaseDef {
	id: string;
	name: string;
	price: number;
	weights: { [rarity: string]: number };

	// Presentation:
	color?: Color3; // tint for the procedurally built crate
	modelName?: string; // extra name to look for under ReplicatedStorage/Assets/Cases; `id` is tried first
	animationId?: string; // published opening animation, e.g. "rbxassetid://123". Falls back to the
	// model's AnimSaves KeyframeSequence, which only registers reliably in Studio.
	animationName?: string; // which take in AnimSaves to use, when the model holds several
	displayYaw?: number; // degrees to turn the crate so its front faces the player. Rotating the
	// model's RootPart in Studio does nothing — the presenter overwrites that CFrame every frame.
	// A "DisplayYaw" attribute on the Model wins over this value.
}

// Shared odds: every crate rolls the same rarity chances. What differs per crate
// is which skins are eligible (see SkinDef.caseId in Catalog.ts).
export const STANDARD_WEIGHTS: { [rarity: string]: number } = {
	[Rarity.Common]: 50,
	[Rarity.Rare]: 30,
	[Rarity.Epic]: 15,
	[Rarity.Legendary]: 4,
	[Rarity.Mythic]: 1,
};

export const Cases = new Map<string, CaseDef>([
	[
		"GreenCase",
		{
			id: "GreenCase",
			name: "Green Case",
			price: 300,
			weights: STANDARD_WEIGHTS,
			color: Color3.fromRGB(70, 175, 90),
			modelName: "BaseCrate",
		},
	],
	[
		"BlueCase",
		{
			id: "BlueCase",
			name: "Blue Case",
			price: 600,
			weights: STANDARD_WEIGHTS,
			color: Color3.fromRGB(60, 130, 235),
			modelName: "BlueCase",
		},
	],
	[
		"PurpleCase",
		{
			id: "PurpleCase",
			name: "Purple Case",
			price: 1000,
			weights: STANDARD_WEIGHTS,
			color: Color3.fromRGB(150, 75, 220),
			modelName: "PurpleCase",
		},
	],
	[
		"YellowCase",
		{
			id: "YellowCase",
			name: "Yellow Case",
			price: 1750,
			weights: STANDARD_WEIGHTS,
			color: Color3.fromRGB(240, 195, 55),
			modelName: "YellowCase",
		},
	],
	[
		"RedCase",
		{
			id: "RedCase",
			name: "Red Case",
			price: 3500,
			weights: STANDARD_WEIGHTS,
			color: Color3.fromRGB(215, 60, 60),
			modelName: "RedCase",
			animationName: "Mythic",
		},
	],
]);
