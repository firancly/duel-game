// Daily missions. Every UTC day each player gets DAILY_MISSION_COUNT missions drawn
// from MissionPool; the draw is seeded by the day number, so everyone sees the same
// set and it changes at 00:00 UTC. Progress is saved per player and reset on rollover.

import { Players } from "@rbxts/services";
import ProfileStore, { Profile } from "@rbxts/profile-store";
import { remote } from "shared/Remotes";
import * as CurrencyService from "server/Currency";
import { DAILY_MISSION_COUNT, getMissionDef, MissionDef, MissionPool, MissionStat } from "shared/Missions";
import { MissionView } from "shared/types/Missions";

interface MissionProgress {
	id: string;
	progress: number;
	completed: boolean;
}

interface PlayerMissionData {
	day: number; // UTC days since the epoch the saved set was drawn for
	missions: MissionProgress[];
}

const DEFAULT_MISSION_DATA: PlayerMissionData = { day: 0, missions: [] };

const SECONDS_PER_DAY = 86400;
const ROLLOVER_CHECK_SECONDS = 30;

const MissionStore = ProfileStore.New("PlayerMissions", DEFAULT_MISSION_DATA);
const profiles = new Map<Player, Profile<PlayerMissionData>>();

const missionsUpdate = remote("MissionsUpdate", "RemoteEvent"); // S->C: full MissionView[] snapshot
const askForMissions = remote("AskForMissions", "RemoteFunction"); // C->S: current snapshot

// Fires (player, missionId) when a mission is completed.
export const MissionCompleted = new Instance("BindableEvent");

// TEST ONLY: shifts "today" by this many days so rollover can be exercised without
// waiting for midnight UTC. Server-wide, in-memory, never saved.
let debugDayOffset = 0;

function currentDay(): number {
	return math.floor(os.time() / SECONDS_PER_DAY) + debugDayOffset;
}

// Deterministic for a given day: same pool + same day = same missions for everyone.
function drawDailyIds(day: number): string[] {
	const rng = new Random(day);
	const ids = MissionPool.map((m) => m.id);
	for (let i = ids.size() - 1; i > 0; i--) {
		const j = rng.NextInteger(0, i);
		[ids[i], ids[j]] = [ids[j], ids[i]];
	}
	return ids.filter((_, i) => i < DAILY_MISSION_COUNT);
}

function freshSet(day: number): MissionProgress[] {
	return drawDailyIds(day).map((id) => ({ id, progress: 0, completed: false }));
}

// Redraw if the day moved on, or the saved set no longer fits the pool (mission removed).
function ensureCurrent(profile: Profile<PlayerMissionData>): boolean {
	const day = currentDay();
	const data = profile.Data;
	const intact =
		data.missions.size() === DAILY_MISSION_COUNT && data.missions.every((m) => getMissionDef(m.id) !== undefined);
	if (data.day === day && intact) return false;

	data.day = day;
	data.missions = freshSet(day);
	return true;
}

function snapshot(profile: Profile<PlayerMissionData>): MissionView[] {
	const views: MissionView[] = [];
	for (const m of profile.Data.missions) {
		const def = getMissionDef(m.id);
		if (def === undefined) continue;
		views.push({
			id: m.id,
			description: def.description,
			progress: m.progress,
			target: def.target,
			reward: def.reward,
			completed: m.completed,
		});
	}
	return views;
}

function replicate(player: Player, profile: Profile<PlayerMissionData>) {
	missionsUpdate.FireClient(player, snapshot(profile));
}

// Called exactly once per mission, the moment it completes.
function grantReward(player: Player, def: MissionDef) {
	const result = CurrencyService.earnPotions(player, def.reward);
	if (!result.success) warn(`[Missions] potion reward failed for ${player.Name}: ${result.reason}`);
	else print(`[Missions] ${player.Name} completed "${def.description}" +${def.reward} potions`);
}

export function getMissions(player: Player): MissionView[] {
	const profile = profiles.get(player);
	return profile !== undefined ? snapshot(profile) : [];
}

// TEST ONLY: wipe this player's progress and redraw today's set.
export function debugReset(player: Player) {
	const profile = profiles.get(player);
	if (profile === undefined) return;

	profile.Data.day = currentDay();
	profile.Data.missions = freshSet(profile.Data.day);
	replicate(player, profile);
}

// TEST ONLY: move "today" forward/back by `days` and roll everyone over to that day's set.
export function debugSetDayOffset(days: number) {
	debugDayOffset = days;
	for (const [player, profile] of profiles) {
		if (ensureCurrent(profile)) replicate(player, profile);
	}
}

// Add `amount` to every active, unfinished mission that counts `stat`.
export function report(player: Player, stat: MissionStat, amount = 1) {
	if (amount <= 0) return;
	const profile = profiles.get(player);
	if (profile === undefined) return;

	let changed = ensureCurrent(profile);
	const completedNow: MissionDef[] = [];

	for (const m of profile.Data.missions) {
		if (m.completed) continue;
		const def = getMissionDef(m.id);
		if (def === undefined || def.stat !== stat) continue;

		m.progress = math.min(m.progress + amount, def.target);
		changed = true;
		if (m.progress >= def.target) {
			m.completed = true;
			completedNow.push(def);
		}
	}

	if (!changed) return;
	replicate(player, profile);

	for (const def of completedNow) {
		grantReward(player, def);
		MissionCompleted.Fire(player, def.id);
	}
}

function onPlayerAdded(player: Player) {
	const profile = MissionStore.StartSessionAsync(`${player.UserId}`, {
		Cancel: () => player.Parent !== Players,
	}) as Profile<PlayerMissionData> | undefined;

	if (profile === undefined || player.Parent !== Players) {
		profile?.EndSession();
		player.Kick("Failed to load missions profile. Rejoin");
		return;
	}

	profile.Reconcile();
	profile.AddUserId(player.UserId);

	profile.OnSessionEnd.Connect(() => {
		profiles.delete(player);
		player.Kick("Your data session ended. Rejoin to continue playing.");
	});

	ensureCurrent(profile);
	profiles.set(player, profile);
	replicate(player, profile);

	print("[Missions Service] Loaded missions for:", player.Name);
}

function onPlayerRemoving(player: Player) {
	profiles.get(player)?.EndSession();
	profiles.delete(player);
}

// A day can tick over while someone is online; reset them without waiting for their next report().
function runRolloverLoop() {
	task.spawn(() => {
		while (true) {
			task.wait(ROLLOVER_CHECK_SECONDS);
			for (const [player, profile] of profiles) {
				if (ensureCurrent(profile)) replicate(player, profile);
			}
		}
	});
}

export function init() {
	Players.PlayerAdded.Connect(onPlayerAdded);
	Players.PlayerRemoving.Connect(onPlayerRemoving);
	for (const player of Players.GetPlayers()) task.spawn(onPlayerAdded, player);

	askForMissions.OnServerInvoke = (player) => getMissions(player);
	runRolloverLoop();

	print("[Missions Service] Initialized");
}
