import { Players } from "@rbxts/services";
import * as Presence from "server/Trade/Presence";
import { PresenceState } from "shared/Presence";
import { TradePlayerInfo, MAX_OFFER } from "shared/types/Trade";
import { remote } from "shared/Remotes";
import { getDef } from "shared/Catalog";
import * as InventoryService from "server/Inventory";

const getTradePlayers = remote("GetTradePlayers", "RemoteFunction");
const sendTradeRequest = remote("SendTradeRequest", "RemoteEvent");
const incomingTradeRequest = remote("IncomingTradeRequest", "RemoteEvent");
const tradeStarted = remote("TradeStarted", "RemoteEvent");
const updateOffer = remote("UpdateOffer", "RemoteEvent");
const offerUpdated = remote("OfferUpdated", "RemoteEvent");
const confirmTrade = remote("ConfirmTrade", "RemoteEvent");
const cancelTrade = remote("CancelTrade", "RemoteEvent");
const tradeConfirmed = remote("TradeConfirmed", "RemoteEvent");
const tradeComplete = remote("TradeComplete", "RemoteEvent");
const tradeState = remote("TradeState", "RemoteEvent"); // S->C: text for the TradeState label
const respondTradeRequest = remote("RespondTradeRequest", "RemoteEvent"); // C->S: (fromUserId, accept)

// outgoing requests waiting on a reply: requesterUserId -> targetUserId
const pending = new Map<number, number>();

// an active trade between two players
interface TradeSession {
	a: Player;
	b: Player;
	offerA: Map<string, number>; // id -> count
	offerB: Map<string, number>;
	confirmedA: boolean;
	confirmedB: boolean;
	countdownToken: number; // bumped to cancel a running countdown
}
// both players' userIds point at the same session object
const sessions = new Map<number, TradeSession>();

// convert map to plain object for sending over to remotes
function recordFromMap(m: Map<string, number>): { [id: string]: number } {
	const out: { [id: string]: number } = {};
	for (const [k, v] of m) out[k] = v;
	return out;
}

function endSession(session: TradeSession) {
	sessions.delete(session.a.UserId);
	sessions.delete(session.b.UserId);
	Presence.set(session.a, PresenceState.Lobby);
	Presence.set(session.b, PresenceState.Lobby);
}

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

	// open a fresh session to hold both offers
	const session: TradeSession = {
		a,
		b,
		offerA: new Map(),
		offerB: new Map(),
		confirmedA: false,
		confirmedB: false,
		countdownToken: 0,
	};
	sessions.set(a.UserId, session);
	sessions.set(b.UserId, session);

	// tell each side who they're trading with, clients open TradeSecondGUI
	tradeStarted.FireClient(a, b.UserId, b.DisplayName);
	tradeStarted.FireClient(b, a.UserId, a.DisplayName);
	setState(session, "Waiting");
	print(`[Trade] started ${a.Name} <-> ${b.Name}`);
}

// a player changed their offer: validate it, store it, relay to the other side
function handleOfferUpdate(player: Player, offerRecord: unknown) {
	if (!typeIs(offerRecord, "table")) return;
	const session = sessions.get(player.UserId);
	if (session === undefined) return;

	const state = InventoryService.getState(player);
	if (state === undefined) return;

	// re-validate everything server-side: tradeable + owned + total under the limit
	const validated = new Map<string, number>();
	let total = 0;
	for (const [id, count] of pairs(offerRecord as { [id: string]: number })) {
		if (!typeIs(id, "string") || !typeIs(count, "number")) continue;
		const def = getDef(id);
		if (def === undefined || !def.tradeable) continue;
		const owned = state.items.get(id)?.size() ?? 0;
		const amount = math.min(count, owned, MAX_OFFER - total); // owned + within limit
		if (amount > 0) {
			validated.set(id, amount);
			total += amount;
		}
		if (total >= MAX_OFFER) break;
	}

	// store on the right side; any change resets both confirmations
	const isA = session.a === player;
	if (isA) session.offerA = validated;
	else session.offerB = validated;

	// any offer change unaccepts both and cancels any running countdown
	session.confirmedA = false;
	session.confirmedB = false;
	session.countdownToken += 1;
	setState(session, "Waiting");

	// show it on the OTHER player's screen (their "their offer" panel)
	const other = isA ? session.b : session.a;
	offerUpdated.FireClient(other, recordFromMap(validated));
	print(`[Trade] ${player.Name} offer updated (${validated.size()} kinds)`);
}

// does this player still own every item (and enough of it) in the given offer?
function ownsAll(player: Player, offer: Map<string, number>): boolean {
	const state = InventoryService.getState(player);
	if (state === undefined) return false;
	for (const [id, count] of offer) {
		if ((state.items.get(id)?.size() ?? 0) < count) return false;
	}
	return true;
}

// both confirmed, swap the items. all-or-nothing.
function executeTrade(session: TradeSession) {
	// final re-validation: neither side may have dropped an item mid-trade
	if (!ownsAll(session.a, session.offerA) || !ownsAll(session.b, session.offerB)) {
		tradeComplete.FireClient(session.a, false);
		tradeComplete.FireClient(session.b, false);
		endSession(session);
		print("[Trade] aborted, ownership changed");
		return;
	}

	// move A's offer to B (removeItem/addItem both replicate the inventory change)
	for (const [id, count] of session.offerA) {
		for (let i = 0; i < count; i++) {
			InventoryService.removeItem(session.a, id);
			InventoryService.addItem(session.b, id);
		}
	}
	// move B's offer to A
	for (const [id, count] of session.offerB) {
		for (let i = 0; i < count; i++) {
			InventoryService.removeItem(session.b, id);
			InventoryService.addItem(session.a, id);
		}
	}

	tradeComplete.FireClient(session.a, true);
	tradeComplete.FireClient(session.b, true);
	print(`[Trade] completed ${session.a.Name} <-> ${session.b.Name}`);
	endSession(session);
}

// push the same display text to both players' TradeState label
function setState(session: TradeSession, text: string) {
	tradeState.FireClient(session.a, text);
	tradeState.FireClient(session.b, text);
}

// both accepted, 10s countdown then swap. cancels itself if anything changes.
function startCountdown(session: TradeSession) {
	session.countdownToken += 1;
	const token = session.countdownToken;
	task.spawn(() => {
		for (let t = 10; t >= 0; t--) {
			if (sessions.get(session.a.UserId) !== session) return; // ended / cancelled
			if (session.countdownToken !== token) return; // offer changed / re-accepted
			if (!(session.confirmedA && session.confirmedB)) return; // someone unaccepted
			setState(session, tostring(t));
			if (t === 0) {
				executeTrade(session);
				return;
			}
			task.wait(1);
		}
	});
}

function handleConfirm(player: Player) {
	const session = sessions.get(player.UserId);
	if (session === undefined) return;

	const isA = session.a === player;
	if (isA) session.confirmedA = true;
	else session.confirmedB = true;

	// both in, start the countdown; otherwise still waiting
	if (session.confirmedA && session.confirmedB) startCountdown(session);
	else setState(session, "Waiting");
}

function handleCancel(player: Player) {
	const session = sessions.get(player.UserId);
	if (session === undefined) return;
	tradeComplete.FireClient(session.a, false);
	tradeComplete.FireClient(session.b, false);
	endSession(session);
	print(`[Trade] cancelled by ${player.Name}`);
}

// target accepted or declined an incoming request
function handleRespond(responder: Player, fromUserId: number, accept: boolean) {
	if (pending.get(fromUserId) !== responder.UserId) return; // no matching request
	pending.delete(fromUserId);
	if (!accept) return;

	const requester = Players.GetPlayerByUserId(fromUserId);
	if (requester === undefined) return;
	if (!Presence.isAvailable(requester) || !Presence.isAvailable(responder)) return;
	startTrade(requester, responder);
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

	// a player changed their offer
	updateOffer.OnServerEvent.Connect((player, offerRecord) => handleOfferUpdate(player, offerRecord));

	// confirm / cancel
	confirmTrade.OnServerEvent.Connect((player) => handleConfirm(player));
	cancelTrade.OnServerEvent.Connect((player) => handleCancel(player));

	// accept / decline an incoming request
	respondTradeRequest.OnServerEvent.Connect((responder, fromUserId, accept) => {
		if (!typeIs(fromUserId, "number") || !typeIs(accept, "boolean")) return;
		handleRespond(responder, fromUserId, accept);
	});

	// if someone leaves mid-trade, tear the session down and free the other player
	Players.PlayerRemoving.Connect((player) => {
		const session = sessions.get(player.UserId);
		if (session !== undefined) endSession(session);
	});

	// hook chat for the temp accept flow
	for (const p of Players.GetPlayers()) hookChat(p);
	Players.PlayerAdded.Connect(hookChat);

	print("[TradeService] Initialized");
}
