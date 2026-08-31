import { remote } from "shared/Remotes";
import { GamepassActions, ActionType } from "./actions";
import { PlayerGamepassData } from "../core/GamepassState";

const gamepassUpdate = remote("GamepassUpdate", "RemoteEvent"); // S->C deltas
const askForGamepasses = remote("AskForGamepasses", "RemoteFunction"); // C->S initial snapshot
const requestGift = remote("RequestGift", "RemoteFunction"); // C->S: (recipientUserId, key) -> { ok, reason? }

export const Replicator = {
	send(player: Player, action: ActionType, payload: unknown) {
		gamepassUpdate.FireClient(player, action, payload);
	},

	sendInit(player: Player, state: PlayerGamepassData) {
		this.send(player, ActionType.INIT, GamepassActions.init(state));
	},

	sendOwn(player: Player, key: string) {
		this.send(player, ActionType.OWN, GamepassActions.own(key));
	},

	onAskForGamepasses(callback: (player: Player) => unknown) {
		askForGamepasses.OnServerInvoke = callback;
	},

	onRequestGift(callback: (player: Player, recipientUserId: number, key: string) => unknown) {
		requestGift.OnServerInvoke = (player, ...args) => callback(player, args[0] as number, args[1] as string);
	},
};
