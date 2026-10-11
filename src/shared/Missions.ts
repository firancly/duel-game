// What a mission counts. Gameplay code reports these to the Missions service;
// the service matches them against whichever missions are active today.
export enum MissionStat {
	OpenCrates = "OpenCrates",
	SpendCoins = "SpendCoins",
	CompleteTrades = "CompleteTrades",
	// Call MissionService.report(player, MissionStat.WinMatches | GetKills, n) from it.
	WinMatches = "WinMatches",
	GetKills = "GetKills",
}

export interface MissionDef {
	id: string;
	description: string;
	stat: MissionStat;
	target: number;
	reward: number; // potions granted once, when the mission completes
}

// Number of missions each player gets per day.
export const DAILY_MISSION_COUNT = 5;

// The pool the daily set is drawn from. Must hold at least DAILY_MISSION_COUNT entries.
// Ids are saved on player profiles, so don't reuse or rename one.
export const MissionPool: MissionDef[] = [
	// Reward amounts are placeholders - tune once the special crate has a potion price.
	{ id: "open_1", description: "Open 1 crate", stat: MissionStat.OpenCrates, target: 1, reward: 5 },
	{ id: "open_3", description: "Open 3 crates", stat: MissionStat.OpenCrates, target: 3, reward: 10 },
	{ id: "open_5", description: "Open 5 crates", stat: MissionStat.OpenCrates, target: 5, reward: 20 },
	{ id: "spend_500", description: "Spend 500 coins", stat: MissionStat.SpendCoins, target: 500, reward: 10 },
	{ id: "spend_2000", description: "Spend 2,000 coins", stat: MissionStat.SpendCoins, target: 2000, reward: 25 },
	{ id: "trade_1", description: "Complete 1 trade", stat: MissionStat.CompleteTrades, target: 1, reward: 10 },
	{ id: "trade_3", description: "Complete 3 trades", stat: MissionStat.CompleteTrades, target: 3, reward: 20 },
	{ id: "win_1", description: "Win 1 match", stat: MissionStat.WinMatches, target: 1, reward: 15 },
	{ id: "win_3", description: "Win 3 matches", stat: MissionStat.WinMatches, target: 3, reward: 30 },
	{ id: "kill_10", description: "Get 10 kills", stat: MissionStat.GetKills, target: 10, reward: 15 },
	{ id: "kill_25", description: "Get 25 kills", stat: MissionStat.GetKills, target: 25, reward: 30 },
];

const byId = new Map<string, MissionDef>();
for (const def of MissionPool) byId.set(def.id, def);

export function getMissionDef(id: string): MissionDef | undefined {
	return byId.get(id);
}
