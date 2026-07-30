import { ReplicatedStorage } from "@rbxts/services";
import { Actions, InvAction } from "./actions";
import { InventoryStateType } from "../Data/InventoryState";
import { WeaponSlot } from "shared/Catalog";

function getRemotesFolder(): Folder {
	let folder = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (folder === undefined) {
		folder = new Instance("Folder");
		folder.Name = "Remotes";
		folder.Parent = ReplicatedStorage;
	}
	return folder;
}

const remotes = getRemotesFolder();

// server to client
const inventoryUpdate = new Instance("RemoteEvent");
inventoryUpdate.Name = "InventoryUpdate";
inventoryUpdate.Parent = remotes;

// client to server
const askForInventory = new Instance("RemoteFunction");
askForInventory.Name = "AskForInventory";
askForInventory.Parent = remotes;

// client to server
const requestEquip = new Instance("RemoteEvent");
requestEquip.Name = "RequestEquip";
requestEquip.Parent = remotes;

// Send core
export class Replicator {
	static send(player: Player, action: InvAction, payload: unknown) {
		inventoryUpdate.FireClient(player, action, payload);
	}

	static sendInit(player: Player, state: InventoryStateType) {
		this.send(player, InvAction.INIT, Actions.init(state));
	}

	static sendAdd(player: Player, id: string, count: number) {
		this.send(player, InvAction.ADD, Actions.add(id, count));
	}

	static sendRemove(player: Player, id: string, count: number) {
		this.send(player, InvAction.REMOVE, Actions.remove(id, count));
	}

	static sendEquip(player: Player, slot: WeaponSlot, id: string) {
		this.send(player, InvAction.EQUIP, Actions.equip(slot, id));
	}

	static sendUnequip(player: Player, slot: WeaponSlot, id: string) {
		this.send(player, InvAction.UNEQUIP, Actions.unequip(slot, id));
	}

	static onAskForInventory(callback: (player: Player) => unknown) {
		askForInventory.OnServerInvoke = callback;
	}

	static onRequestEquip(callback: (player: Player, id: string) => void) {
		requestEquip.OnServerEvent.Connect((player, id) => {
			if (typeIs(id, "string")) callback(player, id);
		});
	}
}
