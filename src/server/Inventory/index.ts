import { Players, ServerStorage } from "@rbxts/services";
import { InventoryState } from "./Data/InventoryState";
import { AddOperation } from "./Operations/AddOperation";

const playerInventories = new Map<Player, InventoryState>();

const playerOperationLock = new Set<Player>(); // ? Don't know what this does yet

const toolsFolder = ServerStorage.FindFirstChild("Tools") as Folder | undefined;

function onPlayerAdded(player: Player) {
	const state = new InventoryState(player);
	playerInventories.set(player, state);

	player.CharacterAdded.Connect((character) => {
		character.FindFirstChildWhichIsA("Humanoid")!.Died.Once(() => (state.died = true));

		if (state.died) {
			InventoryService.reloadClient(player);

			state.died = false;
		}
	});

	print("[InventoryService] Loaded inventory for:", player.Name);
}

function onPlayerRemoving(player: Player) {
	playerInventories.delete(player);
	playerOperationLock.delete(player);
	print("[InventoryService] Unloaded inventory for:", player.Name);
}

export class InventoryService {
	static getState(player: Player) {
		return playerInventories.get(player);
	}

	static addItem(player: Player, itemId: string, amount: number) {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };
		// * CHHECK if an item is legit
		// if (toolsFolder?.FindFirstChild(itemId) === undefined) return {success: false, reason: "ITEM_NOT_FOUND"}};

		const result = AddOperation.execute(state, itemId, amount); // Execute some function (AddOperation) and if it is successful return object

		// returns the object with params from add operation (return result)
		return result;
	}

	static removeItem(player: Player, itemId: string, amount: number) {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		const result = false;

		// returns the object with params from add operation (return result)
	}

	static reloadClient(player: Player) {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		// Module helper class to communicate with the client
	}

	static init() {
		Players.PlayerAdded.Connect(onPlayerAdded);
		Players.PlayerRemoving.Connect(onPlayerRemoving);

		for (const player of Players.GetPlayers()) {
			onPlayerAdded(player);
		}

		// Setup remotes
		// setupRemotes();

		print("[Inventory Service] Initialized");
	}
}

// * Main server code v
