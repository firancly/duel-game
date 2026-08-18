import { PresenceState } from "../Presence";

// max items a single side can put in a trade offer
export const MAX_OFFER = 6;

// one row in the trade player list
export interface TradePlayerInfo {
	userId: number;
	name: string; // @username
	displayName: string;
	state: PresenceState; // drives IN LOBBY / IN MATCH + whether TRADE is allowed
}
