import { Players } from "@rbxts/services";
import * as Presence from "server/Trade/Presence";
import { PresenceState } from "shared/Presence";
import { TradePlayerInfo } from "shared/types/Trade";
import { remote } from "shared/Remotes";

const getTradePlayers = remote("GetTradePlayers", "RemoteFunction");
const sendTradeRequest = remote("SendTradeRequest", "RemoteEvent");
const incomingTradeRequest = remote("IncomingTradeRequest", "RemoteEvent");
const tradeStarted = remote("TradeStarted", "RemoteEvent");

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

// who (if anyone) sent this player a pending request?
function findIncomingRequester(responder: Player): Player | undefined {
	for (const [requesterId, targetId] of pending) {
		if (targetId === responder.UserId) return Players.GetPlayerByUserId(requesterId);
	}
	return undefined;
}

function startTrade(a: Player, b: Player) {
	pending.delete(a.UserId);
	pending.delete(b.UserId);

	Presence.set(a, PresenceState.Trading);
	Presence.set(b, PresenceState.Trading);

	// tell each side who they're trading with → clients open TradeSecondGUI
	tradeStarted.FireClient(a, b.UserId, b.DisplayName);
	tradeStarted.FireClient(b, a.UserId, a.DisplayName);
	print(`[Trade] started ${a.Name} <-> ${b.Name}`);
	// NEXT PHASE: create a TradeSession to hold both offers
}

// TEMP for testing: accept a pending request by typing "accept" in chat
function hookChat(player: Player) {
	player.Chatted.Connect((message) => {
		if (message.lower() !== "accept") return;
		const requester = findIncomingRequester(player);
		if (requester === undefined) return;
		startTrade(requester, player);
	});
}

export function init() {
	Presence.init();

	getTradePlayers.OnServerInvoke = (player) => buildPlayerList(player);

	// client clicked TRADE on someone
	sendTradeRequest.OnServerEvent.Connect((from, targetUserId) => {
		if (!typeIs(targetUserId, "number")) return;
		const target = Players.GetPlayerByUserId(targetUserId);
		if (target === undefined || target === from) return;

		// both have to be free (re-checked here, never trust the client's list)
		if (!Presence.isAvailable(from) || !Presence.isAvailable(target)) return;
		if (pending.has(from.UserId)) return; // one outgoing request at a time

		pending.set(from.UserId, targetUserId);
		incomingTradeRequest.FireClient(target, from.UserId, from.DisplayName);
		print(`[Trade] request ${from.Name} -> ${target.Name} (target types "accept")`);
	});

	// hook chat for the temp accept flow
	for (const p of Players.GetPlayers()) hookChat(p);
	Players.PlayerAdded.Connect(hookChat);

	print("[TradeService] Initialized");
}
