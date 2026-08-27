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
