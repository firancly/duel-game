import { Players } from "@rbxts/services";
import * as InventoryService from "./Inventory";
import * as TradeService from "./Trade/TradeService";
import * as CurrencyService from "./Currency";

InventoryService.init();
TradeService.init();
CurrencyService.init();

// Setup chat commands
Players.PlayerAdded.Connect((player) => {
	player.Chatted.Connect((msg) => {
		const parts = msg.split(" ");
		const keyword = parts[0];
		const itemId = msg.sub(keyword.size() + 2);

		if (msg === "get state") print(InventoryService.getState(player));

		if (keyword === "add" && itemId !== "") {
			const result = InventoryService.addItem(player, itemId);
			if (result.success === true) print(`added ${itemId}`);
		}

		// TODO
		// if (keyword === "remove" && itemId !== "") {
		// 	InventoryService.removeItem(player, itemId);
		// 	print(`removed ${itemId}`);
		// }

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

		if (keyword === "unequip" && itemId !== "") {
			// InventoryService.unequipItem(player, itemId);
			print(`unequipped ${itemId}`);
		}
	});
});
