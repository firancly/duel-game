// Where a player currently is. Drives whether they can be sent a trade.
export enum PresenceState {
	Lobby = "Lobby", // in the lobby, free to trade  → "EN LOBBY"
	InMatch = "InMatch", // in a round               → "EN PARTIDA"
	Trading = "Trading", // already in a trade, busy
}
