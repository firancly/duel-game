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
	requiredGamepass?: string; // Gamepasses.ts key, only owners can open this case
	currency?: "coins" | "potions"; // what `price` is paid in; coins when omitted
	robuxProductId?: number; // developer product that buys-and-opens this case for Robux

	// Presentation:
	color?: Color3; // tint for the procedurally built crate
	modelName?: string; // extra name to look for under ReplicatedStorage/Assets/Cases; `id` is tried first
	animationId?: string; // published opening animation, e.g. "rbxassetid://123". Falls back to the
	// model's AnimSaves KeyframeSequence, which only registers reliably in Studio.
	animationName?: string; // which take in AnimSaves to use, when the model holds several
	openSoundId?: string; // "rbxassetid://123", played once as the opening animation starts
	revealSoundId?: string; // "rbxassetid://123", played as the reward pops out
	displayYaw?: number; // degrees to turn the crate so its front faces the player. Rotating the
	// model's RootPart in Studio does nothing the presenter overwrites that CFrame every frame.
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

export const PLUS_CASE_WEIGHTS: { [rarity: string]: number } = {
	[Rarity.Rare]: 40,
	[Rarity.Epic]: 35,
	[Rarity.Mythic]: 20,
	[Rarity.Exclusive]: 5,
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
			animationId: "rbxassetid://128721319789902",
			openSoundId: "rbxassetid://103103373491932",
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
			animationId: "rbxassetid://131705746780177",
			openSoundId: "rbxassetid://114128227406848",
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
			animationId: "rbxassetid://134640375695297",
			openSoundId: "rbxassetid://71479100563125",
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
			animationId: "rbxassetid://74460996781940",
			openSoundId: "rbxassetid://84096641936532",
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
			animationId: "rbxassetid://133525921658689",
			openSoundId: "rbxassetid://73127933401668",
		},
	],
	[
		"PlusCase",
		{
			id: "PlusCase",
			name: "Plus Case",
			price: 2000,
			weights: PLUS_CASE_WEIGHTS,
			requiredGamepass: "Plus",
			color: Color3.fromRGB(255, 210, 60),
			modelName: "PlusCase",
			animationId: "rbxassetid://101908799614645",
			openSoundId: "rbxassetid://130291271967956",
		},
	],
	[
		"HalloweenCase",
		{
			id: "HalloweenCase",
			name: "Halloween Case",
			price: 200, // potions
			currency: "potions",
			robuxProductId: 3717835254, // Halloween Box, 49 R$
			weights: STANDARD_WEIGHTS, // rarities with no Halloween skin are skipped at roll time
			color: Color3.fromRGB(255, 120, 0),
			modelName: "HalloweenCase",
			openSoundId: "rbxassetid://96902830946603",
			animationId: "rbxassetid://70436231388787",
			// TODO: animationId once the crate animation is published
		},
	],
]);

export function findCaseByProductId(productId: number): CaseDef | undefined {
	for (const [, def] of Cases) {
		if (def.robuxProductId !== undefined && def.robuxProductId !== 0 && def.robuxProductId === productId) {
			return def;
		}
	}
	return undefined;
}
