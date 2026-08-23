import { Rarity } from "./Catalog";

// How many clicks on the 3D crate are needed to pop it open.
export const CLICKS_TO_OPEN = 3;

// A shop case: costs `price`, rolls a rarity by `weights`, then gives a random
// skin of that rarity. Weights are relative odds (don't need to sum to 100).
export interface CaseDef {
	id: string;
	name: string;
	price: number;
	weights: { [rarity: string]: number };

	// Presentation (client only, ignored by the server roll):
	color?: Color3; // tint for the procedurally built crate
	modelName?: string; // name under ReplicatedStorage/Assets/Cases, defaults to `id`
}

export const Cases = new Map<string, CaseDef>([
	[
		"GreenCase",
		{
			id: "GreenCase",
			name: "Green Case",
			price: 300,
			weights: { [Rarity.Common]: 70, [Rarity.Rare]: 25, [Rarity.Epic]: 5 },
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
			weights: { [Rarity.Common]: 40, [Rarity.Rare]: 40, [Rarity.Epic]: 15, [Rarity.Legendary]: 5 },
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
			weights: { [Rarity.Epic]: 45, [Rarity.Legendary]: 40, [Rarity.Mythic]: 15 },
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
			weights: { [Rarity.Legendary]: 60, [Rarity.Mythic]: 40 },
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
			weights: { [Rarity.Rare]: 35, [Rarity.Epic]: 40, [Rarity.Legendary]: 22, [Rarity.Mythic]: 3 },
			color: Color3.fromRGB(215, 60, 60),
			modelName: "RedCase",
		},
	],
]);
