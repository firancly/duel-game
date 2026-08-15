import { PresenceState } from "../Presence";

// one row in the trade player list
export interface TradePlayerInfo {
	userId: number;
	name: string; // @username
	displayName: string;
	state: PresenceState; // drives EN LOBBY / EN PARTIDA + whether TRADE is allowed
}
