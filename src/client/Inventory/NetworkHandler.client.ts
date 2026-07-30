import { ReplicatedStorage } from "@rbxts/services";
import { Store } from "./Store";
import { WeaponSlot } from "shared/Catalog";
import { AddRemovePayload, EquipPayload, InitPayload } from "shared/InventoryActions";
import * as InventoryUI from "./InventoryUI";

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const inventoryUpdate = remotes.WaitForChild("InventoryUpdate") as RemoteEvent;
const askForInventory = remotes.WaitForChild("AskForInventory") as RemoteFunction;
const requestEquip = remotes.WaitForChild("RequestEquip") as RemoteEvent;

inventoryUpdate.OnClientEvent.Connect((action: string, payload: unknown) => {
	if (action === "Init") Store.init(payload as InitPayload);
	else if (action === "Add") {
		const p = payload as AddRemovePayload;
		Store.applyAdd(p.id, p.count);
	} else if (action === "Remove") {
		const p = payload as AddRemovePayload;
		Store.applyRemove(p.id, p.count);
	} else if (action === "Equip") {
		const p = payload as EquipPayload;
		Store.applyEquip(p.slot as WeaponSlot, p.id);
	} else if (action === "Unequip") {
		const p = payload as EquipPayload;
		Store.applyUnequip(p.slot, p.id);
	}
});

const snapshot = askForInventory.InvokeServer() as InitPayload;
Store.init(snapshot);

InventoryUI.init((id) => requestEquip.FireServer(id));

// client
task.wait(10);
requestEquip.FireServer("seer"); // later: from a button click
print("Requesting to equip seer");
