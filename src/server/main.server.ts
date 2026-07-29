import { Players } from "@rbxts/services";
import { InventoryService } from "./Inventory";

InventoryService.init();

function grantItem(item: string) {
	print(item);
}

// Setup chat commands
Players.PlayerAdded.Connect((player) => {
	player.Chatted.Connect((msg) => {
		if (msg === "get state") print(InventoryService.getState(player));
		if (msg === "add dog") {
			InventoryService.addItem(player, "dog", 1);
			print("added dog");
		}

		if (msg === "grant cat") grantItem("cat");
	});
});
