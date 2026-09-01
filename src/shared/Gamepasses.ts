export interface GamepassOffer {
	key: string; // unique id, also the ImageButton name inside `container`
	container: "GamepassesContainer1" | "GamepassesContainer2";
	id: number; // Roblox GamePass asset id
	name: string; // display name
	price?: number; // price in Robux
	giftProductId?: number; // dev product id for gifting this GamePass
}

// "key" used in PlayerGamepassData.owned as field name
// prettier-ignore
export const Gamepasses: GamepassOffer[] = [
	{ key: "SetClown", container: "GamepassesContainer1", id: 1962240250, name: "Clown Set", price: 0, giftProductId: 3710302463 }, // Clown
	{ key: "LimitedBundle", container: "GamepassesContainer1", id: 1960128461, name: "Limited Bundle", price: 0, giftProductId: 3710302525}, // Bunny
	{ key: "X2", container: "GamepassesContainer1", id: 1960326493, name: "2x Earnings", price: 0, giftProductId: 3710302763 }, // 2x Earnings
	{ key: "Plus", container: "GamepassesContainer2", id: 1960314453, name: "Plus", price: 0, giftProductId: 3710302694 }, // Plus
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
