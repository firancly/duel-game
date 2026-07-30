import { Players } from "@rbxts/services";
import { InventoryService } from "./Inventory";

InventoryService.init();

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

		if (keyword === "unequip" && itemId !== "") {
			// InventoryService.unequipItem(player, itemId);
			print(`unequipped ${itemId}`);
		}
	});
});
