export interface GamepassOffer {
	key: string; // unique id, also the ImageButton name inside `container`
	container: "GamepassesContainer1" | "GamepassesContainer2";
	id: number; // Roblox GamePass asset id
	name: string; // display name
	// Roblox has no API to buy a GamePass on someone else's behalf, so gifting goes through
	// its own Developer Product (same Robux price as the pass) — see server/Shop/Monetization.ts.
	// 0/undefined = gifting not set up for this pass yet (Gift button shows "not set up" message).
	giftProductId?: number;
}

// "key" used in PlayerGamepassData.owned as field name
export const Gamepasses: GamepassOffer[] = [
	{ key: "SetClown", container: "GamepassesContainer1", id: 1962240250, name: "Clown Set" },
	{ key: "LimitedBundle", container: "GamepassesContainer1", id: 1960128461, name: "Limited Bundle" }, // Bunny
	{ key: "X2", container: "GamepassesContainer1", id: 1960326493, name: "2x Earnings" },
	{ key: "Plus", container: "GamepassesContainer2", id: 1960314453, name: "Plus" },
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
