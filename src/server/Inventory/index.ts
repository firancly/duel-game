import { Players } from "@rbxts/services";
import { InventoryState } from "./Data/InventoryState";
import { Operations } from "./Operations/Operations";
import { Catalog, DEFAULT_SKINS, getDef } from "shared/Catalog";
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
		if (result.success) state.equipped.set(slot, result.changedItem.id);

		if (!result.success) {
			warn(`DEFAULT_SKINS: failed to add ${id} reason: ${result.reason}`);
			continue;
		}
		state.equipped.set(slot, result.changedItem.id);
	}

	// TEMP for testing: give one of every non-default skin in the catalog
	const defaultIds = new Set<string>();
	for (const [, id] of DEFAULT_SKINS) defaultIds.add(id);
	for (const [id] of Catalog) {
		if (!defaultIds.has(id)) Operations.add(state, id);
	}

	player.CharacterAdded.Connect((character) => {
		character.FindFirstChildWhichIsA("Humanoid")!.Died.Once(() => (state.died = true));

		if (state.died) {
			reloadClient(player);

			state.died = false;
		}
	});

	print("[InventoryService] Loaded inventory for:", player.Name);
}

export function onPlayerRemoving(player: Player) {
	playerInventories.delete(player);
	playerOperationLock.delete(player);
	print("[InventoryService] Unloaded inventory for:", player.Name);
}

export function getState(player: Player) {
	return playerInventories.get(player);
}

export function addItem(player: Player, itemId: string) {
	const state = playerInventories.get(player);
	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	const result = Operations.add(state, itemId);
	if (result.success === true) {
		Replicator.sendAdd(player, itemId, state.items.get(itemId)?.size() ?? 0);
	}

	return result;
}

export function removeItem(player: Player, itemId: string) {
	const state = playerInventories.get(player);
	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	const result = Operations.removeOne(state, itemId);
	if (result.success === true) {
		Replicator.sendRemove(player, itemId, state.items.get(itemId)?.size() ?? 0);
	}
	return result;
}

export function equipItem(player: Player, itemId: string) {
	const state = playerInventories.get(player);
	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	const result = Operations.equip(state, itemId);
	if (result.success === true) {
		const def = getDef(itemId)!;
		Replicator.sendEquip(player, def.slot, itemId);
	}

	return result;
}

export function reloadClient(player: Player) {
	const state = playerInventories.get(player);
	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	// Module helper class to communicate with the client
}

export function init() {
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
		equipItem(player, id); // re-validates ownership, equips, pushes delta
	});

	print("[Inventory Service] Initialized");
}
