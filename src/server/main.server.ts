import { Players, TextChatService } from "@rbxts/services";
import * as InventoryService from "./Inventory";
import * as TradeService from "./Trade/TradeService";
import * as CurrencyService from "./Currency";
import * as ShopService from "./Shop";
import * as Monetization from "./Shop/Monetization";
import * as GamepassService from "./Gamepass";
import * as PartyService from "./Party";

InventoryService.init();
TradeService.init();
CurrencyService.init();
ShopService.init();
Monetization.init();
GamepassService.init();
PartyService.init();

// Setup chat commands
Players.PlayerAdded.Connect((player) => {
	if (player.UserId !== 11170246) return; // dev-only chat commands

	player.Chatted.Connect((msg) => {
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
	});
});

// Broadcasts a system message into everyone's chat window (not just the server console).
function announce(msg: string) {
	const channels = TextChatService.FindFirstChild("TextChannels");
	const general = channels?.FindFirstChild("RBXGeneral") as TextChannel | undefined;
	general?.DisplaySystemMessage(msg);
}

// Party chat commands
Players.PlayerAdded.Connect((player) => {
	player.Chatted.Connect((msg) => {
		const parts = msg.split(" ");
		if (parts[0] !== "party") return;

		const sub = parts[1];
		const targetName = parts[2];
		const target =
			targetName !== undefined ? (Players.FindFirstChild(targetName) as Player | undefined) : undefined;

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
	});
});
