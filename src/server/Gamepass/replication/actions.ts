import { PlayerGamepassData } from "../core/GamepassState";

// message types the client can receive
export enum ActionType {
	INIT = "Init", // full snapshot (on join)
	OWN = "Own", // a single gamepass was just confirmed owned (fresh purchase or late verify)
}

export class GamepassActions {
	static init(state: PlayerGamepassData) {
		return { owned: state.owned };
	}

	static own(key: string) {
		return { key };
	}
}
