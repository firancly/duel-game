// key -> owned. Keys match GamepassOffer.key in shared/Gamepasses.ts.
export interface PlayerGamepassData {
	owned: { [key: string]: boolean };
}

export const DEFAULT_PLAYER_GAMEPASS_DATA: PlayerGamepassData = {
	owned: {},
};
