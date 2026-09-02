export interface GamepassOffer {
	key: string; // unique id, also the ImageButton name inside `container`
	container: "GamepassesContainer1" | "GamepassesContainer2";
	id: number; // Roblox GamePass asset id
	name: string; // display name
	price?: number; // price in Robux
	giftProductId?: number; // dev product id for gifting this GamePass
	skinIds?: string[]; // Catalog.ts ids granted the moment this pass is first bought
}

// "key" used in PlayerGamepassData.owned as field name
// prettier-ignore
export const Gamepasses: GamepassOffer[] = [
	{ key: "SetClown", container: "GamepassesContainer1", id: 1962240250, name: "Clown Set", price: 200, giftProductId: 3710302463, skinIds: ["clown_knife", "clown_revolver", "clown_rifle"] }, // Clown
	{ key: "LimitedBundle", container: "GamepassesContainer1", id: 1960128461, name: "Limited Bundle", price: 150, giftProductId: 3710302525, skinIds: ["bunny_knife", "bunny_revolver", "bunny_rifle"] }, // Bunny
	{ key: "X2", container: "GamepassesContainer1", id: 1960326493, name: "2x Earnings", price: 59, giftProductId: 3710302763 }, // 2x Earnings
	{ key: "Plus", container: "GamepassesContainer2", id: 1960314453, name: "Plus", price: 150, giftProductId: 3710302694, skinIds: ["plus_knife", "plus_revolver", "plus_rifle"] }, // Plus
];

export function findGamepassByKey(key: string): GamepassOffer | undefined {
	for (const gp of Gamepasses) if (gp.key === key) return gp;
	return undefined;
}

export function findGamepassById(id: number): GamepassOffer | undefined {
	for (const gp of Gamepasses) if (gp.id === id) return gp;
	return undefined;
}

export function findGamepassByGiftProductId(productId: number): GamepassOffer | undefined {
	for (const gp of Gamepasses) if (gp.giftProductId === productId) return gp;
	return undefined;
}
