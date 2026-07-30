import { Players } from "@rbxts/services";
import { InventoryState } from "./Data/InventoryState";
import { Operations } from "./Operations/Operations";
import { DEFAULT_SKINS, getDef } from "shared/Catalog";
import { Replicator } from "./Replication/replicator";
import { Actions } from "./Replication/actions";

const playerInventories = new Map<Player, InventoryState>();

const playerOperationLock = new Set<Player>(); // ? Don't know what this does yet

// const toolsFolder = ServerStorage.FindFirstChild("Tools") as Folder | undefined;

// const DEFAULT_SKINS: [WeaponSlot, string][] = [
// 	[WeaponSlot.Sniper, "default_sniper"],
// 	[WeaponSlot.Revolver, "default_revolver"],
// 	[WeaponSlot.Knife, "default_knife"],
// ];

function onPlayerAdded(player: Player) {
	const state = new InventoryState(player);
	playerInventories.set(player, state);

	for (const [slot, id] of DEFAULT_SKINS) {
		const result = Operations.add(state, id); // creates a real ItemInstance w/ uuid
		if (result.changedItem) state.equipped.set(slot, result.changedItem.id);
	}

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

	static addItem(player: Player, itemId: string) {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		const result = Operations.add(state, itemId);
		if (result.success === true) {
			Replicator.sendAdd(player, itemId, state.items.get(itemId)?.size() ?? 0);
		}

		return result;
	}

	// TODO
	// static removeItem(player: Player, itemId: string) {
	// 	const state = playerInventories.get(player);
	// 	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	// 	const result = Operations.remove(state, itemId);
	// if (result.success === true) {
	// 		const def = getDef(itemId);
	// 		Replicator.sendRemove(player, itemId, 1);
	// 	}
	// 	return result;
	// }

	static equipItem(player: Player, itemId: string) {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		const result = Operations.equip(state, itemId);
		if (result.success === true) {
			const def = getDef(itemId)!;
			Replicator.sendEquip(player, def.slot, itemId);
		}

		return result;
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
		Replicator.onAskForInventory((player) => {
			const state = playerInventories.get(player);
			return state ? Actions.init(state) : undefined;
		});

		Replicator.onRequestEquip((player, id) => {
			InventoryService.equipItem(player, id); // re-validates ownership, equips, pushes delta
		});

		print("[Inventory Service] Initialized");
	}
}
