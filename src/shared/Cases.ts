import { Rarity } from "./Catalog";

// A shop case: costs `price`, rolls a rarity by `weights`, then gives a random
// skin of that rarity. Weights are relative odds (don't need to sum to 100).
export interface CaseDef {
	id: string;
	name: string;
	price: number;
	weights: { [rarity: string]: number };
}

export const Cases = new Map<string, CaseDef>([
	[
		"GreenCase",
		{
			id: "GreenCase",
			name: "Green Case",
			price: 50,
			weights: { [Rarity.Common]: 70, [Rarity.Rare]: 25, [Rarity.Epic]: 5 },
		},
	],
	[
		"BlueCase",
		{
			id: "BlueCase",
			name: "Blue Case",
			price: 120,
			weights: { [Rarity.Common]: 40, [Rarity.Rare]: 40, [Rarity.Epic]: 15, [Rarity.Legendary]: 5 },
		},
	],
	[
		"RedCase",
		{
			id: "RedCase",
			name: "Red Case",
			price: 250,
			weights: { [Rarity.Rare]: 35, [Rarity.Epic]: 40, [Rarity.Legendary]: 22, [Rarity.Mythic]: 3 },
		},
	],
	[
		"PurpleCase",
		{
			id: "PurpleCase",
			name: "Purple Case",
			price: 500,
			weights: { [Rarity.Epic]: 45, [Rarity.Legendary]: 40, [Rarity.Mythic]: 15 },
		},
	],
	[
		"YellowCase",
		{
			id: "YellowCase",
			name: "Yellow Case",
			price: 1000,
			weights: { [Rarity.Legendary]: 60, [Rarity.Mythic]: 40 },
		},
	],
]);
