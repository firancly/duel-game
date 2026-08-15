import { Players } from "@rbxts/services";
import { PresenceState } from "shared/Presence";

// server-owned: every player's current presence. Default Lobby.
const states = new Map<Player, PresenceState>();

export function set(player: Player, state: PresenceState) {
	states.set(player, state);
}

export function get(player: Player): PresenceState {
	return states.get(player) ?? PresenceState.Lobby;
}

// can this player be sent / start a trade right now?
export function isAvailable(player: Player): boolean {
	return get(player) === PresenceState.Lobby;
}

export function init() {
	Players.PlayerAdded.Connect((p) => states.set(p, PresenceState.Lobby));
	Players.PlayerRemoving.Connect((p) => states.delete(p));
	for (const p of Players.GetPlayers()) states.set(p, PresenceState.Lobby);
}
