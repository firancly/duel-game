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
	// reward: TBD - see grantReward() in server/Missions/index.ts
}

// Number of missions each player gets per day.
export const DAILY_MISSION_COUNT = 5;

// The pool the daily set is drawn from. Must hold at least DAILY_MISSION_COUNT entries.
// Ids are saved on player profiles, so don't reuse or rename one.
export const MissionPool: MissionDef[] = [
	{ id: "open_1", description: "Open 1 crate", stat: MissionStat.OpenCrates, target: 1 },
	{ id: "open_3", description: "Open 3 crates", stat: MissionStat.OpenCrates, target: 3 },
	{ id: "open_5", description: "Open 5 crates", stat: MissionStat.OpenCrates, target: 5 },
	{ id: "spend_500", description: "Spend 500 coins", stat: MissionStat.SpendCoins, target: 500 },
	{ id: "spend_2000", description: "Spend 2,000 coins", stat: MissionStat.SpendCoins, target: 2000 },
	{ id: "trade_1", description: "Complete 1 trade", stat: MissionStat.CompleteTrades, target: 1 },
	{ id: "trade_3", description: "Complete 3 trades", stat: MissionStat.CompleteTrades, target: 3 },
	{ id: "win_1", description: "Win 1 match", stat: MissionStat.WinMatches, target: 1 },
	{ id: "win_3", description: "Win 3 matches", stat: MissionStat.WinMatches, target: 3 },
	{ id: "kill_10", description: "Get 10 kills", stat: MissionStat.GetKills, target: 10 },
	{ id: "kill_25", description: "Get 25 kills", stat: MissionStat.GetKills, target: 25 },
];

const byId = new Map<string, MissionDef>();
for (const def of MissionPool) byId.set(def.id, def);

export function getMissionDef(id: string): MissionDef | undefined {
	return byId.get(id);
}
