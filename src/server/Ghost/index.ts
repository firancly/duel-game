// The match Ghost. An eligible match rolls once when it starts; if the roll passes, a ghost
// appears somewhere in the map after a random delay, then either fades on its own or is
// banished early by being shot. Every counted hit goes to the shooter's GhostHits mission.
//
// The match loop and the weapons are legacy Luau, so this module is driven from there:
//   onMatchStarted / onMatchEnded   from a bridge script on MatchUtils' events
//   isGhost / tryHit                from WeaponServer, where a shot resolves
// The exports are plain functions: call them with a dot from Luau, never a colon.
//
// All numbers live in shared/GhostConfig.ts.

import { CollectionService, ReplicatedStorage, Workspace } from "@rbxts/services";
import { GhostConfig } from "shared/GhostConfig";
import { MissionStat } from "shared/Missions";
import * as MissionService from "server/Missions";

interface HitRecord {
	count: number;
	lastAt: number; // os.clock() of this player's last counted hit
}

// One match that won its roll. Dropped as soon as its ghost is gone: one ghost per match.
interface GhostMatch {
	id: string;
	container: Instance; // the map model; the ghost is parented here so it dies with the map
	roster: unknown; // the session's own player table, read at hit time so it is never stale
	rosterWarned: boolean;
	fixedSpawn?: CFrame; // set by the debug spawn; real matches pick a tagged spawn part
	ghost?: Model;
	hits: number;
	hitsByPlayer: Map<Player, HitRecord>;
	timer: number; // bumped per scheduled step, so a stale task.delay callback does nothing
	mapGone?: RBXScriptConnection;
}

const DEBUG_MATCH_ID = "debug";
const DEBUG_SPAWN_DISTANCE = 12; // studs in front of the dev who asked for it

const matches = new Map<string, GhostMatch>();
const rng = new Random();
let warnedNoModel = false;

function isCurrent(match: GhostMatch, timer: number): boolean {
	return matches.get(match.id) === match && match.timer === timer;
}

// The session's player table comes from Luau and its exact shape isn't ours to assume, so
// take every Player found as a key or a value (covers an array, a set and a name -> player map).
function playersIn(source: unknown): Set<Player> {
	const found = new Set<Player>();
	if (!typeIs(source, "table")) return found;

	for (const [key, value] of source as Map<unknown, unknown>) {
		if (typeIs(key, "Instance") && key.IsA("Player")) found.add(key);
		if (typeIs(value, "Instance") && value.IsA("Player")) found.add(value);
	}
	return found;
}

function isInMatch(match: GhostMatch, player: Player): boolean {
	const roster = playersIn(match.roster);
	if (roster.size() > 0) return roster.has(player);

	// An unreadable roster must not make the ghost unhittable, but it shouldn't pass quietly.
	if (!match.rosterWarned) {
		match.rosterWarned = true;
		warn(`[Ghost] match ${match.id}: no readable player list, so any player's hit counts`);
	}
	return true;
}

function matchOfGhost(instance: Instance): GhostMatch | undefined {
	for (const [, match] of matches) {
		const ghost = match.ghost;
		if (ghost !== undefined && (instance === ghost || instance.IsDescendantOf(ghost))) return match;
	}
	return undefined;
}

// Stops tracking the match and removes its ghost, if one is out. Every exit goes through here.
function closeMatch(match: GhostMatch, reason: string) {
	if (matches.get(match.id) !== match) return;
	matches.delete(match.id);
	match.mapGone?.Disconnect();

	if (match.ghost !== undefined) {
		match.ghost.Destroy();
		print(`[Ghost] match ${match.id}: ghost gone (${reason})`);
	}
}

function track(id: string, container: Instance, roster: unknown): GhostMatch {
	const match: GhostMatch = {
		id,
		container,
		roster,
		rosterWarned: false,
		hits: 0,
		hitsByPlayer: new Map(),
		timer: 0,
	};
	// Safety net: the map going away ends the match here even if nobody calls onMatchEnded.
	match.mapGone = container.Destroying.Connect(() => closeMatch(match, "map removed"));
	matches.set(id, match);
	return match;
}

// Visible stand-in so the mechanic can be tested before the real ghost asset exists.
function buildPlaceholder(): Model {
	const body = new Instance("Part");
	body.Name = "Body";
	body.Shape = Enum.PartType.Ball;
	body.Size = new Vector3(4, 4, 4);
	body.Material = Enum.Material.Neon;
	body.Color = Color3.fromRGB(235, 245, 255);
	body.Transparency = 0.35;

	const model = new Instance("Model");
	body.Parent = model;
	model.PrimaryPart = body;
	return model;
}

function buildGhost(): Model {
	const template = ReplicatedStorage.FindFirstChild("Assets")?.FindFirstChild(GhostConfig.modelName);
	const hasTemplate = template !== undefined && template.IsA("Model");
	if (!hasTemplate && !warnedNoModel) {
		warnedNoModel = true;
		warn(`[Ghost] no Model "${GhostConfig.modelName}" in ReplicatedStorage/Assets - using a placeholder`);
	}

	const ghost = hasTemplate ? template.Clone() : buildPlaceholder();
	ghost.Name = "Ghost";

	// Shootable but not solid: raycasts must see it, players must walk straight through it.
	for (const descendant of ghost.GetDescendants()) {
		if (!descendant.IsA("BasePart")) continue;
		descendant.Anchored = true;
		descendant.CanCollide = false;
		descendant.CanTouch = false;
		descendant.CanQuery = true;
	}

	CollectionService.AddTag(ghost, GhostConfig.ghostTag);
	return ghost;
}

// A random spawn part inside this map. Their CFrame is used as is, so rotating the part
// in Studio turns the ghost.
function pickSpawn(container: Instance): CFrame {
	const points: BasePart[] = [];
	for (const tagged of CollectionService.GetTagged(GhostConfig.spawnTag)) {
		if (tagged.IsA("BasePart") && tagged.IsDescendantOf(container)) points.push(tagged);
	}
	if (points.size() > 0) return points[rng.NextInteger(0, points.size() - 1)].CFrame;

	warn(`[Ghost] no "${GhostConfig.spawnTag}" parts in ${container.GetFullName()} - using the map centre`);
	if (!container.IsA("Model")) return new CFrame();
	const [center] = container.GetBoundingBox();
	return center;
}

function spawnGhost(match: GhostMatch) {
	if (!match.container.IsDescendantOf(game)) {
		closeMatch(match, "map removed");
		return;
	}

	const ghost = buildGhost();
	ghost.PivotTo(match.fixedSpawn ?? pickSpawn(match.container));
	ghost.Parent = match.container;
	match.ghost = ghost;
	print(`[Ghost] match ${match.id}: ghost appeared for ${GhostConfig.activeDuration}s`);

	match.timer += 1;
	const timer = match.timer;
	task.delay(GhostConfig.activeDuration, () => {
		if (isCurrent(match, timer)) closeMatch(match, "faded");
	});
}

function registerHit(match: GhostMatch, player: Player) {
	if (!isInMatch(match, player)) return;

	const now = os.clock();
	const record = match.hitsByPlayer.get(player);
	const count = record?.count ?? 0;
	if (count >= GhostConfig.maxHitsPerPlayer) return;
	// One knife swing overlaps the ghost for several frames; it is still one hit.
	if (record !== undefined && now - record.lastAt < GhostConfig.hitCooldown) return;

	match.hitsByPlayer.set(player, { count: count + 1, lastAt: now });
	match.hits += 1;
	MissionService.report(player, MissionStat.GhostHits);
	print(`[Ghost] ${player.Name} hit the ghost (${match.hits}/${GhostConfig.hitsToBanish})`);

	if (match.hits >= GhostConfig.hitsToBanish) closeMatch(match, "banished");
}

function isEligible(gameType: unknown): boolean {
	const types = GhostConfig.eligibleGameTypes;
	return types.size() === 0 || (typeIs(gameType, "string") && types.includes(gameType));
}

// Luau bridge: call on MatchUtils.MatchStarted with the session's fields.
// `players` is session.Players as is; this module reads Player instances out of it.
export function onMatchStarted(matchId: unknown, gameType: unknown, mapModel: unknown, players: unknown) {
	if (!typeIs(matchId, "string") && !typeIs(matchId, "number")) {
		warn("[Ghost] onMatchStarted: matchId must be a string or a number");
		return;
	}
	const id = tostring(matchId);
	if (!typeIs(mapModel, "Instance") || !mapModel.IsA("Model")) {
		warn(`[Ghost] onMatchStarted(${id}): mapModel is not a Model, no ghost for this match`);
		return;
	}
	if (matches.has(id) || !isEligible(gameType)) return;

	if (rng.NextNumber() >= GhostConfig.spawnChance) {
		print(`[Ghost] match ${id}: no ghost this time`);
		return;
	}

	const match = track(id, mapModel, players);
	const latest = math.max(GhostConfig.minSpawnDelay, GhostConfig.maxSpawnDelay);
	const delay = rng.NextNumber(GhostConfig.minSpawnDelay, latest);
	const timer = match.timer;
	task.delay(delay, () => {
		if (isCurrent(match, timer)) spawnGhost(match);
	});
	print(`[Ghost] match ${id}: ghost due in ${math.round(delay)}s`);
}

// Luau bridge: call on MatchUtils.SessionEnded. Safe to call for a match with no ghost.
export function onMatchEnded(matchId: unknown) {
	const match = matches.get(tostring(matchId));
	if (match !== undefined) closeMatch(match, "match ended");
}

// WeaponServer: true when this instance is a live ghost or any part of one.
export function isGhost(instance: unknown): boolean {
	return typeIs(instance, "Instance") && matchOfGhost(instance) !== undefined;
}

// WeaponServer: call where a shot has been validated, before anything treats the target
// as a character. Returns true when the target was a ghost; the shot is then consumed
// whether or not it counted (wrong match, per-player cap, cooldown), so the caller must
// stop there and never run kill logic on it.
export function tryHit(shooter: unknown, target: unknown): boolean {
	if (!typeIs(target, "Instance")) return false;
	const match = matchOfGhost(target);
	if (match === undefined) return false;

	if (typeIs(shooter, "Instance") && shooter.IsA("Player")) registerHit(match, shooter);
	return true;
}

// TEST ONLY: put a ghost in front of this player right now, outside any match.
// Only that player can hit it.
export function debugSpawn(player: Player): boolean {
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	if (root === undefined || !root.IsA("BasePart")) return false;

	const previous = matches.get(DEBUG_MATCH_ID);
	if (previous !== undefined) closeMatch(previous, "replaced");

	const match = track(DEBUG_MATCH_ID, Workspace, [player]);
	match.fixedSpawn = root.CFrame.mul(new CFrame(0, 0, -DEBUG_SPAWN_DISTANCE));
	spawnGhost(match);
	return true;
}

// TEST ONLY: score a hit on whichever ghost is out, as if this player had shot it.
// Goes through tryHit, so the roster, cap and cooldown rules all apply.
export function debugHit(player: Player): boolean {
	for (const [, match] of matches) {
		if (match.ghost !== undefined) return tryHit(player, match.ghost);
	}
	return false;
}

// TEST ONLY: remove every ghost and cancel every pending spawn.
export function debugClear() {
	const all: GhostMatch[] = [];
	for (const [, match] of matches) all.push(match);
	for (const match of all) closeMatch(match, "cleared");
}

export function init() {
	if (GhostConfig.spawnChance < 0 || GhostConfig.spawnChance > 1) {
		warn("[Ghost] GhostConfig.spawnChance should be between 0 and 1");
	}
	if (GhostConfig.minSpawnDelay > GhostConfig.maxSpawnDelay) {
		warn("[Ghost] GhostConfig.minSpawnDelay is above maxSpawnDelay - the ghost appears at minSpawnDelay");
	}
	print("[Ghost Service] Initialized");
}
