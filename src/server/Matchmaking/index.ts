// Cross-server matchmaking. A player (or their whole party) queues for a mode;
// any server may pull a full match off the shared queue and reserve a server
// for it. Since only the server a player physically sits in can teleport them,
// the match is announced over MessagingService so each player's own origin
// server does the actual teleport.
//
// Team assignment is random and off-limits to the player, per design.

import { MemoryStoreService, MessagingService, Players, TeleportService } from "@rbxts/services";
import * as PartyService from "../Party";

export const MODES = {
	"1v1": 2,
	"2v2": 4,
	"3v3": 6,
	"4v4": 8,
	"5v5": 10,
};
export type Mode = keyof typeof MODES;

interface QueueEntry {
	userIds: number[];
	mode: Mode;
	requestedAt: number;
}

interface MatchFoundMessage {
	placeId: number;
	accessCode: string;
	teamA: number[];
	teamB: number[];
}

const QUEUE_INVISIBILITY_SECONDS = 30;
const ENTRY_EXPIRATION_SECONDS = 120;
const MATCHER_INTERVAL_SECONDS = 3;
const MAX_READS_PER_CYCLE = 20;

const queues = new Map<Mode, MemoryStoreQueue>();
const cancelled = MemoryStoreService.GetSortedMap("MatchmakingCancelled");

// Players with a live request out, tracked locally just so cancelMatch/isQueued
// give instant local feedback without a MemoryStore round trip.
const queuedLocally = new Map<Player, Mode>();

function queueFor(mode: Mode): MemoryStoreQueue {
	let q = queues.get(mode);
	if (q === undefined) {
		q = MemoryStoreService.GetQueue(`Matchmaking_${mode}`, QUEUE_INVISIBILITY_SECONDS);
		queues.set(mode, q);
	}
	return q;
}

export function isQueued(player: Player): boolean {
	return queuedLocally.has(player);
}

// Only the party leader (or a solo player) may queue; the whole party goes in as one block.
export function requestMatch(player: Player, mode: Mode): boolean {
	if (isQueued(player)) return false;
	if (PartyService.isInParty(player) && !PartyService.isLeader(player)) return false;

	const members = PartyService.getMembers(player);
	if (members.size() > MODES[mode]) return false; // party too big for this mode

	const entry: QueueEntry = {
		userIds: members.map((p) => p.UserId),
		mode,
		requestedAt: os.time(),
	};

	queueFor(mode).AddAsync(entry, ENTRY_EXPIRATION_SECONDS);
	for (const member of members) queuedLocally.set(member, mode);
	return true;
}

// Best-effort: the entry may already be off the queue and mid-match by the time
// this lands. Cancellation is checked by the matcher before it finalizes anything.
export function cancelMatch(player: Player) {
	const mode = queuedLocally.get(player);
	if (mode === undefined) return;

	for (const member of PartyService.getMembers(player)) {
		queuedLocally.delete(member);
		cancelled.SetAsync(`${member.UserId}`, true, ENTRY_EXPIRATION_SECONDS);
	}
}

function anyCancelled(userIds: number[]): boolean {
	for (const id of userIds) {
		const [flag] = cancelled.GetAsync(`${id}`);
		if (flag === true) return true;
	}
	return false;
}

function clearLocalQueueState(userIds: number[]) {
	const toClear: Player[] = [];
	queuedLocally.forEach((_mode, player) => {
		if (userIds.includes(player.UserId)) toClear.push(player);
	});
	for (const player of toClear) queuedLocally.delete(player);
}

// Tries once to fill `mode`'s queue up to its total player count. Reads one
// entry at a time so it can skip ones that would overshoot the total without
// removing them — they just go invisible for QUEUE_INVISIBILITY_SECONDS and
// come back around for the next server (or next cycle) to try.
function tryFillMatch(mode: Mode) {
	const total = MODES[mode];
	const queue = queueFor(mode);

	const pulled: Array<{ id: string; entry: QueueEntry }> = [];
	let sum = 0;

	for (let i = 0; i < MAX_READS_PER_CYCLE && sum < total; i++) {
		const [ok, items, id] = pcall(() => queue.ReadAsync(1, false, 1));
		if (!ok || items === undefined || items.size() === 0) break;

		const entry = items[0] as QueueEntry;

		if (anyCancelled(entry.userIds)) {
			queue.RemoveAsync(id);
			clearLocalQueueState(entry.userIds);
			continue;
		}

		if (sum + entry.userIds.size() > total) continue; // leave unclaimed, let it go visible again

		pulled.push({ id, entry });
		sum += entry.userIds.size();
	}

	if (sum !== total) return; // couldn't fill this cycle; unmatched reads simply expire back onto the queue

	for (const { id } of pulled) queue.RemoveAsync(id);
	formMatch(pulled.map((p) => p.entry));
}

// Splits matched party-groups (kept intact) randomly across two teams, roughly evenly.
function assignTeams(entries: QueueEntry[]): { teamA: number[]; teamB: number[] } {
	const groups = [...entries].map((e) => e.userIds);
	for (let i = groups.size() - 1; i > 0; i--) {
		const j = math.random(0, i);
		[groups[i], groups[j]] = [groups[j], groups[i]];
	}

	const total = groups.reduce((sum, g) => sum + g.size(), 0);
	const teamA: number[] = [];
	const teamB: number[] = [];
	for (const group of groups) {
		const target = teamA.size() <= teamB.size() && teamA.size() + group.size() <= total / 2 ? teamA : teamB;
		for (const userId of group) target.push(userId);
	}

	return { teamA, teamB };
}

function formMatch(entries: QueueEntry[]) {
	const { teamA, teamB } = assignTeams(entries);

	const [accessCode] = TeleportService.ReserveServerAsync(game.PlaceId) as unknown as [string, string];

	const message: MatchFoundMessage = { placeId: game.PlaceId, accessCode, teamA, teamB };
	MessagingService.PublishAsync("MatchFound", message);

	clearLocalQueueState([...teamA, ...teamB]);
	teleportLocalPlayers(message);
}

// Every server (including the one that formed the match) runs this on the
// MatchFound message, and only acts on whichever of its own local players are involved.
function teleportLocalPlayers(message: MatchFoundMessage) {
	const localPlayers: Player[] = [];
	for (const userId of [...message.teamA, ...message.teamB]) {
		const player = Players.GetPlayerByUserId(userId);
		if (player !== undefined) localPlayers.push(player);
	}

	if (localPlayers.size() > 0) {
		TeleportService.TeleportToPrivateServer(message.placeId, message.accessCode, localPlayers);
	}
}

// Set true right as the server starts shutting down, so the loop below stops issuing new
// MemoryStore calls instead of leaving one in flight when Studio's Stop button is pressed —
// an in-flight cloud call at that point is what makes Studio hang for a minute or two.
let shuttingDown = false;

// One loop cycling through every mode in turn, not one loop per mode: at most a single
// MemoryStore call in flight at any moment, instead of up to five in parallel.
function runMatcherLoop() {
	task.spawn(() => {
		while (!shuttingDown) {
			task.wait(MATCHER_INTERVAL_SECONDS);
			if (shuttingDown) break;
			for (const [mode] of pairs(MODES)) {
				if (shuttingDown) break;
				tryFillMatch(mode as Mode);
			}
		}
	});
}

export function init() {
	MessagingService.SubscribeAsync("MatchFound", (message) => {
		teleportLocalPlayers(message.Data as MatchFoundMessage);
	});

	runMatcherLoop();

	Players.PlayerRemoving.Connect((player) => cancelMatch(player));

	game.BindToClose(() => {
		shuttingDown = true;
	});

	print("[Matchmaking Service] Initialized");
}
