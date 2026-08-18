import { Players } from "@rbxts/services";
import { WalletState } from "./core/CurrencyState";
import { Replicator } from "./replication/replicator";
import { CoinActions } from "./replication/actions";

const wallets = new Map<Player, WalletState>();

type Result = { success: true; balance: number } | { success: false; reason: string };

function onPlayerAdded(player: Player) {
	const state = new WalletState(player);
	state.amount = 100; // TEMP starting coins for testing
	wallets.set(player, state);
	print("[CurrencyService] Loaded wallet for:", player.Name);
}

function onPlayerRemoving(player: Player) {
	wallets.delete(player);
}

export function getBalance(player: Player): number {
	return wallets.get(player)?.amount ?? 0;
}

// give coins
export function earn(player: Player, amount: number): Result {
	if (amount <= 0) return { success: false, reason: "INVALID_AMOUNT" };
	const state = wallets.get(player);
	if (state === undefined) return { success: false, reason: "NO_WALLET" };

	state.amount += amount;
	Replicator.sendEarn(player, state.amount);
	return { success: true, balance: state.amount };
}

// take coins, fails if they can't afford it
export function spend(player: Player, amount: number): Result {
	if (amount <= 0) return { success: false, reason: "INVALID_AMOUNT" };
	const state = wallets.get(player);
	if (state === undefined) return { success: false, reason: "NO_WALLET" };
	if (state.amount < amount) return { success: false, reason: "INSUFFICIENT" };

	state.amount -= amount;
	Replicator.sendSpend(player, state.amount);
	return { success: true, balance: state.amount };
}

// overwrite balance (admin/debug)
export function setBalance(player: Player, amount: number): Result {
	const state = wallets.get(player);
	if (state === undefined) return { success: false, reason: "NO_WALLET" };

	state.amount = math.max(0, amount);
	Replicator.sendSet(player, state.amount);
	return { success: true, balance: state.amount };
}

export function init() {
	Players.PlayerAdded.Connect(onPlayerAdded);
	Players.PlayerRemoving.Connect(onPlayerRemoving);
	for (const player of Players.GetPlayers()) onPlayerAdded(player);

	Replicator.onAskForWallet((player) => {
		const state = wallets.get(player);
		return state !== undefined ? CoinActions.init(state) : undefined;
	});

	print("[CurrencyService] Initialized");
}
