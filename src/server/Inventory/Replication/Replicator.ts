import { ReplicatedStorage } from "@rbxts/services";
import { InventoryStateType, ItemInstance, PlayerSettings } from "server/Inventory/core/InventoryState";
import { Actions, ActionType } from "./Actions";

function getOrCreateRemotesFolder(): Folder {
	const existing = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (existing !== undefined) return existing;

	const folder = new Instance("Folder");
	folder.Name = "Remotes";
	folder.Parent = ReplicatedStorage;
	return folder;
}

const remotesFolder = getOrCreateRemotesFolder();

function getRemote<T extends keyof CreatableInstances>(name: string, className: T): CreatableInstances[T] {
	const existing = remotesFolder.FindFirstChild(name) as CreatableInstances[T] | undefined;
	if (existing !== undefined) return existing;

	const remote = new Instance(className);
	remote.Name = name;
	remote.Parent = remotesFolder;
	return remote;
}

// Main event for inventory updates
const inventoryUpdateRemote = getRemote("InventoryUpdate", "RemoteEvent");

// Initial Sync Request Handling
const initialSyncRemote = getRemote("AskForStoway", "RemoteFunction");

export class Replicator {
	// Send delta update to player
	static send(player: Player, action: ActionType, payload: unknown) {
		inventoryUpdateRemote.FireClient(player, action, payload);
	}

	// Convenience methods for each action type
	static sendInit(player: Player, state: InventoryStateType) {
		const payload = Actions.init(state);
		Replicator.send(player, ActionType.INIT, payload);
	}

	static sendAdd(
		player: Player,
		addedItems: Array<{ uuid: string; slotType: string; slot: number }>,
		items: Map<string, ItemInstance>,
	) {
		const payload = Actions.add(addedItems, items);
		Replicator.send(player, ActionType.ADD, payload);
	}

	static sendRemove(player: Player, slotType: string, slot: number, uuid: string) {
		const payload = Actions.remove(slotType, slot, uuid);
		Replicator.send(player, ActionType.REMOVE, payload);
	}

	static sendSwap(player: Player, fromType: string, fromSlot: number, toType: string, toSlot: number) {
		const payload = Actions.swap(fromType, fromSlot, toType, toSlot);
		Replicator.send(player, ActionType.SWAP, payload);
	}

	static sendEquip(player: Player, uuid?: string) {
		const payload = Actions.equip(uuid);
		Replicator.send(player, ActionType.EQUIP, payload);
	}

	static sendUpdateSettings(player: Player, settings?: PlayerSettings) {
		if (settings === undefined) return;
		const payload = Actions.updateSettings(settings);
		Replicator.send(player, ActionType.UPDATE_SETTINGS, payload);
	}

	static sendReload(player: Player, configSettingName: string, data?: unknown) {
		const payload = Actions.reload(configSettingName, data);
		Replicator.send(player, ActionType.RELOAD, payload);
	}

	static sendUpdateMeta(player: Player, uuid: string, updates: Map<string, unknown>, newWeight: number) {
		const payload = Actions.updateMeta(uuid, updates, newWeight);
		Replicator.send(player, ActionType.UPDATE_META, payload);
	}

	// Initial Sync Request Handling
	static registerInitialSyncCallback(callback: (player: Player) => unknown) {
		initialSyncRemote.OnServerInvoke = callback;
	}

	// Get remote for external access (e.g., InitialSync)
	static getRemotesFolder(): Folder {
		return remotesFolder;
	}
}
