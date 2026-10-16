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
	// TODO: skinIds placeholder until the Halloween Pack's exclusive skins are decided
	{ key: "Limited", id: 3715179443, name: "Halloween Pack", skinIds: [], giftProductId: 3715179509 }, // Halloween, 699 R$ / gift 629 R$
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

// A potion pack: one Developer Product credits `potions` to the buyer's balance.
export interface PotionPack {
	key: string;
	id: number; // Developer Product id
	name: string;
	potions: number; // amount credited on purchase
	tag: string; // CollectionService tag on the button that buys it
}

// TODO: the potion amounts are placeholders - confirm them. Robux prices live on the products.
export const PotionPacks: PotionPack[] = [
	{ key: "Small", id: 3717835304, name: "Small Potion Pack", potions: 250, tag: "PotionPackSmall" }, // 49 R$
	{ key: "Medium", id: 3717835331, name: "Medium Potion Pack", potions: 650, tag: "PotionPackMedium" }, // 149 R$
	{ key: "Large", id: 3717835430, name: "Large Potion Pack", potions: 1400, tag: "PotionPackLarge" }, // 299 R$
	{ key: "Mega", id: 3717835581, name: "Mega Potion Pack", potions: 3000, tag: "PotionPackMega" }, // 549 R$
];

export function findPotionPackById(productId: number): PotionPack | undefined {
	for (const pack of PotionPacks) if (pack.id === productId) return pack;
	return undefined;
}
