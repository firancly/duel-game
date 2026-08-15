import { Actions, InvAction } from "./actions";
import { InventoryStateType } from "../Data/InventoryState";
import { WeaponSlot } from "shared/Catalog";
import { remote } from "shared/Remotes";

// server to client
const inventoryUpdate = remote("InventoryUpdate", "RemoteEvent");

// client to server
const askForInventory = remote("AskForInventory", "RemoteFunction");

// client to server
const requestEquip = remote("RequestEquip", "RemoteEvent");

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
