import { Players } from "@rbxts/services";
import * as Presence from "server/Trade/Presence";
import { TradePlayerInfo } from "shared/types/Trade";
import { remote } from "shared/Remotes";

const getTradePlayers = remote("GetTradePlayers", "RemoteFunction");
const sendTradeRequest = remote("SendTradeRequest", "RemoteEvent");
const incomingTradeRequest = remote("IncomingTradeRequest", "RemoteEvent");
const respondTradeRequest = remote("RespondTradeRequest", "RemoteEvent");

// outgoing requests waiting on a reply: requesterUserId -> targetUserId
const pending = new Map<number, number>();

export function buildPlayerList(exclude: Player): TradePlayerInfo[] {
	const list: TradePlayerInfo[] = [];
	for (const other of Players.GetPlayers()) {
		if (other === exclude) continue;
		list.push({
			userId: other.UserId,
			name: other.Name,
			displayName: other.DisplayName,
			state: Presence.get(other),
		});
	}
	return list;
}

export function init() {
	Presence.init();

	// client opens the trade window → give it the player list
	getTradePlayers.OnServerInvoke = (player) => buildPlayerList(player);

	// client clicked TRADE on someone
	sendTradeRequest.OnServerEvent.Connect((from, targetUserId) => {
		if (!typeIs(targetUserId, "number")) return;
		const target = Players.GetPlayerByUserId(targetUserId);
		if (target === undefined || target === from) return;

		// both have to be free (re-checked here, never trust the client's list)
		if (!Presence.isAvailable(from) || !Presence.isAvailable(target)) return;
		// one outgoing request at a time
		if (pending.has(from.UserId)) return;

		pending.set(from.UserId, targetUserId);
		incomingTradeRequest.FireClient(target, from.UserId, from.DisplayName);
		print(`[Trade] request ${from.Name} -> ${target.Name}`);
	});

	// target accepted / declined
	respondTradeRequest.OnServerEvent.Connect((responder, fromUserId, accept) => {
		if (!typeIs(fromUserId, "number") || !typeIs(accept, "boolean")) return;
		const requester = Players.GetPlayerByUserId(fromUserId);
		if (requester === undefined) return;
		if (pending.get(fromUserId) !== responder.UserId) return; // no matching request

		pending.delete(fromUserId);
		print(`[Trade] ${responder.Name} ${accept ? "accepted" : "declined"} ${requester.Name}`);
		// NEXT PHASE: on accept → mark both Trading, open a TradeSession, fire a TradeStarted event
	});

	print("[TradeService] Initialized");
}
