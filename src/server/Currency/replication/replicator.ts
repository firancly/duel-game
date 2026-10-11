import { remote } from "shared/Remotes";
import { CoinActions, ActionType } from "./actions";
import { WalletStateType } from "../core/CurrencyState";

const walletUpdate = remote("WalletUpdate", "RemoteEvent"); // S->C deltas
const askForWallet = remote("AskForWallet", "RemoteFunction"); // C->S initial snapshot
const potionsUpdate = remote("PotionsUpdate", "RemoteEvent"); // S->C new potion balance
const askForPotions = remote("AskForPotions", "RemoteFunction"); // C->S initial potion balance

export const Replicator = {
	send(player: Player, action: ActionType, payload: unknown) {
		walletUpdate.FireClient(player, action, payload);
	},

	sendInit(player: Player, state: WalletStateType) {
		this.send(player, ActionType.INIT, CoinActions.init(state));
	},

	sendEarn(player: Player, amount: number) {
		this.send(player, ActionType.EARN, CoinActions.earn(amount));
	},

	sendSpend(player: Player, amount: number) {
		this.send(player, ActionType.SPEND, CoinActions.spend(amount));
	},

	sendSet(player: Player, amount: number) {
		this.send(player, ActionType.SET, CoinActions.set(amount));
	},

	onAskForWallet(callback: (player: Player) => unknown) {
		askForWallet.OnServerInvoke = callback;
	},

	sendPotions(player: Player, amount: number) {
		potionsUpdate.FireClient(player, amount);
	},

	onAskForPotions(callback: (player: Player) => number) {
		askForPotions.OnServerInvoke = callback;
	},
};
