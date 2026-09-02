import { Players } from "@rbxts/services";
import ProfileStore, { Profile } from "@rbxts/profile-store";
import { DEFAULT_PLAYER_CURRENCY_DATA, PlayerCurrencyData } from "./core/CurrencyState";
import { Replicator } from "./replication/replicator";
import { CoinActions } from "./replication/actions";

const CurrencyStore = ProfileStore.New("PlayerCurrency", DEFAULT_PLAYER_CURRENCY_DATA);
const wallets = new Map<Player, Profile<PlayerCurrencyData>>();

// Fires (player, newBalance) on load and on every earn/spend/setBalance.
// Legacy Luau listens to this to mirror the balance without knowing about ProfileStore.
export const CoinsChanged = new Instance("BindableEvent");

type Result = { success: true; balance: number } | { success: false; reason: string };

function notifyChanged(player: Player, amount: number) {
	CoinsChanged.Fire(player, amount);
}

function onPlayerAdded(player: Player) {
	const wallet = CurrencyStore.StartSessionAsync(`${player.UserId}`, {
		Cancel: () => player.Parent !== Players,
	}) as Profile<PlayerCurrencyData> | undefined;

	if (wallet === undefined || player.Parent !== Players) {
		wallet?.EndSession();
		player.Kick("Failed to load currency profile. Rejoin");
		return;
	}

	wallet.Reconcile();
	wallet.AddUserId(player.UserId);

	wallet.OnSessionEnd.Connect(() => {
		wallets.delete(player);
		player.Kick("Your data session ended. Rejoin to continue playing.");
	});

	wallets.set(player, wallet);
	Replicator.sendInit(player, { player, amount: wallet.Data.coins });
	notifyChanged(player, wallet.Data.coins);

	print("[CurrencyService] Loaded wallet for:", player.Name);
}

function onPlayerRemoving(player: Player) {
	wallets.get(player)?.EndSession();
	wallets.delete(player);
}

export function getBalance(player: Player): number {
	return wallets.get(player)?.Data.coins ?? 0;
}

// give coins
export function earn(player: Player, amount: number): Result {
	if (amount <= 0) return { success: false, reason: "INVALID_AMOUNT" };
	const profile = wallets.get(player);
	if (profile === undefined) return { success: false, reason: "NO_WALLET" };

	profile.Data.coins += amount;
	Replicator.sendEarn(player, profile.Data.coins);
	notifyChanged(player, profile.Data.coins);
	return { success: true, balance: profile.Data.coins };
}

// take coins, fails if they can't afford it
export function spend(player: Player, amount: number): Result {
	if (amount <= 0) return { success: false, reason: "INVALID_AMOUNT" };
	const profile = wallets.get(player);
	if (profile === undefined) return { success: false, reason: "NO_WALLET" };
	if (profile.Data.coins < amount) return { success: false, reason: "INSUFFICIENT" };

	profile.Data.coins -= amount;
	Replicator.sendSpend(player, profile.Data.coins);
	notifyChanged(player, profile.Data.coins);
	return { success: true, balance: profile.Data.coins };
}

// overwrite balance (admin/debug)
export function setBalance(player: Player, amount: number): Result {
	const profile = wallets.get(player);
	if (profile === undefined) return { success: false, reason: "NO_WALLET" };

	profile.Data.coins = math.max(0, amount);
	Replicator.sendSet(player, profile.Data.coins);
	notifyChanged(player, profile.Data.coins);
	return { success: true, balance: profile.Data.coins };
}

// Yields until this player's wallet has finished loading, then returns the balance.
// For legacy Luau to safely read a starting value regardless of PlayerAdded handler order.
export function waitForBalance(player: Player): number {
	if (wallets.has(player)) return getBalance(player);
	while (!wallets.has(player) && player.Parent === Players) {
		const p = CoinsChanged.Event.Wait() as unknown as Player; // Wait() returns (player, amount); only player is used
		if (p === player) break;
	}
	return getBalance(player);
}

export function init() {
	Players.PlayerAdded.Connect(onPlayerAdded);
	Players.PlayerRemoving.Connect(onPlayerRemoving);
	for (const player of Players.GetPlayers()) onPlayerAdded(player);

	Replicator.onAskForWallet((player) => {
		const profile = wallets.get(player);
		return profile !== undefined ? CoinActions.init({ player, amount: profile.Data.coins }) : undefined;
	});

	print("[CurrencyService] Initialized");
}
