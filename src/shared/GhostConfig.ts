// Tuning for the match Ghost (see server/Ghost). Everything a designer may want to change
// lives here. The Ghost mission's target and reward sit with the other missions in
// shared/Missions.ts (stat GhostHits).

export interface GhostSettings {
	spawnChance: number; // 0..1, chance that an eligible match gets a ghost at all
	minSpawnDelay: number; // seconds after the match starts: earliest it can appear
	maxSpawnDelay: number; // seconds after the match starts: latest it can appear
	activeDuration: number; // seconds it stays before fading away on its own

	hitsToBanish: number; // counted hits (from everyone) that make it vanish early
	maxHitsPerPlayer: number; // counted hits one player can score on a single ghost
	hitCooldown: number; // seconds between two counted hits from the same player

	eligibleGameTypes: string[]; // session.GameType values that can roll a ghost; empty = all

	modelName: string; // Model under ReplicatedStorage/Assets; a stand-in is built if missing
	spawnTag: string; // CollectionService tag on the parts inside a map it can appear at
	ghostTag: string; // CollectionService tag put on the live ghost model
}

export const GhostConfig: GhostSettings = {
	spawnChance: 1, // ! CHANGE LATER TO 0.35
	minSpawnDelay: 0, // 15
	maxSpawnDelay: 5, // 60
	activeDuration: 12000,

	hitsToBanish: 1,
	maxHitsPerPlayer: 1,
	hitCooldown: 0.5,

	eligibleGameTypes: [],

	modelName: "Ghost",
	spawnTag: "GhostSpawn",
	ghostTag: "Ghost",
};
