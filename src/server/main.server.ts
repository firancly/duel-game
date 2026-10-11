import { Players, TextChatService } from "@rbxts/services";
import { remote } from "shared/Remotes";
import * as InventoryService from "./Inventory";
import * as TradeService from "./Trade/TradeService";
import * as CurrencyService from "./Currency";
import * as ShopService from "./Shop";
import * as Monetization from "./Shop/Monetization";
import * as GamepassService from "./Gamepass";
import * as PartyService from "./Party";
import * as MatchmakingService from "./Matchmaking/index";
import * as MissionService from "./Missions";
import { Mode } from "./Matchmaking/index";
import { MissionStat } from "shared/Missions";

InventoryService.init();
TradeService.init();
CurrencyService.init();
ShopService.init();
Monetization.init();
GamepassService.init();
PartyService.init();
MatchmakingService.init();
MissionService.init();

// Broadcasts a system message into everyone's chat window. DisplaySystemMessage is
// client-only, so route it through a remote and let each client display it locally.
const announceRemote = remote("Announce", "RemoteEvent");
function announce(msg: string) {
	announceRemote.FireAllClients(msg);
}

function handleInventoryCommand(player: Player, msg: string) {
	if (player.UserId !== 11170246) return; // dev-only chat commands

	const parts = msg.split(" ");
	const keyword = parts[0];
	const itemId = msg.sub(keyword.size() + 2);

	if (msg === "get state") print(InventoryService.getState(player));

	if (keyword === "add" && itemId !== "") {
		const result = InventoryService.addItem(player, itemId);
		if (result.success === true) print(`added ${itemId}`);
	}

	if (keyword === "remove" && itemId !== "") {
		InventoryService.removeItem(player, itemId);
		print(`removed ${itemId}`);
	}

	if (keyword === "equip" && itemId !== "") {
		InventoryService.equipItem(player, itemId);
		print(`equipped ${itemId}`);
	}

	if (msg === "coins") print("coins:", CurrencyService.getBalance(player));

	if (keyword === "earn" && itemId !== "") {
		const n = tonumber(itemId);
		if (n !== undefined) CurrencyService.earn(player, n);
	}

	if (keyword === "spend" && itemId !== "") {
		const n = tonumber(itemId);
		if (n !== undefined) CurrencyService.spend(player, n);
	}

	if (msg === "potions") print("potions:", CurrencyService.getPotions(player));

	if (keyword === "earnpotions" && itemId !== "") {
		const n = tonumber(itemId);
		if (n !== undefined) CurrencyService.earnPotions(player, n);
	}

	if (keyword === "spendpotions" && itemId !== "") {
		const n = tonumber(itemId);
		if (n !== undefined) print(CurrencyService.spendPotions(player, n));
	}
}

// Dev-only mission test commands. Output goes to the server Output window, not chat.
//   missions                       list today's missions + progress
//   mission report <stat> <n>      fire a report, e.g. "mission report GetKills 10"
//   mission reset                  wipe progress and redraw today's set
//   mission day <n>                shift "today" by n days (0 = back to real time)
function handleMissionCommand(player: Player, msg: string) {
	if (player.UserId !== 11170246) return;

	const parts = msg.split(" ");

	if (msg === "missions") {
		print(`[Missions] ${player.Name}:`);
		for (const m of MissionService.getMissions(player)) {
			const done = m.completed ? "  DONE" : "";
			print(`  ${m.id}  ${m.progress}/${m.target}${done}  - ${m.description}`);
		}
		return;
	}

	if (parts[0] !== "mission") return;
	const sub = parts[1];

	if (sub === "report") {
		const stat = MissionStat[parts[2] as keyof typeof MissionStat] as MissionStat | undefined;
		const amount = tonumber(parts[3] ?? "1");
		if (stat === undefined || amount === undefined) return print("usage: mission report <stat> <n>");
		MissionService.report(player, stat, amount);
		print(`[Missions] reported ${stat} +${amount}`);
	}

	if (sub === "reset") {
		MissionService.debugReset(player);
		print("[Missions] reset");
	}

	if (sub === "day") {
		const days = tonumber(parts[2] ?? "");
		if (days === undefined) return print("usage: mission day <n>");
		MissionService.debugSetDayOffset(days);
		print(`[Missions] day offset = ${days}`);
	}
}

// Party chat commands
function handlePartyCommand(player: Player, msg: string) {
	const parts = msg.split(" ");
	if (parts[0] !== "party") return;

	const sub = parts[1];
	const targetName = parts[2];
	const target = targetName !== undefined ? (Players.FindFirstChild(targetName) as Player | undefined) : undefined;

	if (sub === "invite") {
		if (target === undefined) return announce(`no player named ${targetName}`);
		PartyService.invitePlayer(player, target);
		announce(`${player.Name} invited ${target.Name} to their party`);
	}

	if (sub === "accept") {
		if (target === undefined) return announce(`no player named ${targetName}`);
		PartyService.acceptInvite(player, target);
		announce(`${player.Name} joined ${target.Name}'s party`);
	}

	if (sub === "decline") {
		if (target === undefined) return announce(`no player named ${targetName}`);
		PartyService.declineInvite(player, target);
		announce(`${player.Name} declined ${target.Name}'s invite`);
	}

	if (sub === "leave") {
		PartyService.leaveParty(player);
		announce(`${player.Name} left their party`);
	}

	if (sub === "kick") {
		if (target === undefined) return announce(`no player named ${targetName}`);
		PartyService.kickMember(player, target);
		announce(`${player.Name} kicked ${target.Name} from the party`);
	}

	if (sub === "members") {
		announce(
			`party: ${PartyService.getMembers(player)
				.map((p) => p.Name)
				.join(", ")}`,
		);
	}
}

// Matchmaking chat commands: "queue 1v1", "queue 2v2", ... "cancel queue"
function handleMatchmakingCommand(player: Player, msg: string) {
	const parts = msg.split(" ");

	if (parts[0] === "queue") {
		const mode = parts[1] as Mode | undefined;
		if (mode === undefined || !(mode in MatchmakingService.MODES)) {
			return announce("usage: queue <1v1|2v2|3v3|4v4|5v5>");
		}

		const ok = MatchmakingService.requestMatch(player, mode);
		announce(ok ? `${player.Name} queued for ${mode}` : `${player.Name} could not queue for ${mode}`);
	}

	if (msg === "cancel queue") {
		MatchmakingService.cancelMatch(player);
		announce(`${player.Name} left the queue`);
	}
}

const generalChannel = TextChatService.WaitForChild("TextChannels").WaitForChild("RBXGeneral") as TextChannel;
generalChannel.ShouldDeliverCallback = (message, textSource) => {
	if (textSource === message.TextSource) {
		const player = Players.GetPlayerByUserId(textSource.UserId);
		if (player !== undefined) {
			const msg = message.Text;
			handleInventoryCommand(player, msg);
			handleMissionCommand(player, msg);
			handlePartyCommand(player, msg);
			handleMatchmakingCommand(player, msg);
		}
	}
	return true;
};
