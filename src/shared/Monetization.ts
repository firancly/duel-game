export interface CoinOffer {
	button: string; // ImageButton name inside `container`
	container: "CoinsContainer" | "CoinsContainer2";
	id: number; // Developer Product id
	coins: number; // amount credited on purchase
}

export const CoinProducts: CoinOffer[] = [
	{ button: "first", container: "CoinsContainer", id: 3709976183, coins: 600 },
	{ button: "second", container: "CoinsContainer", id: 3709976218, coins: 2000 },
	{ button: "third", container: "CoinsContainer", id: 3709976277, coins: 5200 },
	{ button: "fourth", container: "CoinsContainer", id: 3709976321, coins: 12000 },
	{ button: "fifth", container: "CoinsContainer2", id: 3709976409, coins: 27000 },
];

export function findProductById(productId: number): CoinOffer | undefined {
	for (const p of CoinProducts) if (p.id === productId) return p;
	return undefined;
}

// A Limited: one Developer Product grants a fixed set of skins straight to the inventory
// (no crate roll). `key` matches the Frame name under Container.Limiteds.
export interface LimitedOffer {
	key: string; // Frame name under Container.Limiteds
	id: number; // Developer Product id
	name: string; // display name
	skinIds: string[]; // Catalog.ts ids granted on purchase — fill in once decided
	giftProductId?: number; // separate dev product for gifting this bundle, priced 10% under `id`
}

// prettier-ignore
export const Limiteds: LimitedOffer[] = [
	{ key: "Limited", id: 3710307602, name: "Monster Bundle", skinIds: ["monster_knife", "monster_revolver", "monster_rifle"], giftProductId: 3711119580 }, // Monster
];

export function findLimitedByKey(key: string): LimitedOffer | undefined {
	for (const offer of Limiteds) if (offer.key === key) return offer;
	return undefined;
}

export function findLimitedById(id: number): LimitedOffer | undefined {
	for (const offer of Limiteds) if (offer.id === id) return offer;
	return undefined;
}

export function findLimitedByGiftProductId(productId: number): LimitedOffer | undefined {
	for (const offer of Limiteds) if (offer.giftProductId === productId) return offer;
	return undefined;
}
