// Where a player currently is. Drives whether they can be sent a trade.
export enum PresenceState {
	Lobby = "Lobby", // in the lobby, free to trade, shows "In Lobby"
	InMatch = "InMatch", // in a round, shows "In Match" and disables trade button
	Trading = "Trading", // already in a trade, busy
}
