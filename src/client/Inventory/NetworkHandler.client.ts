import { ReplicatedStorage } from "@rbxts/services";
import { Store } from "./Store";
import { WeaponSlot } from "shared/Catalog";
import { AddRemovePayload, EquipPayload, InitPayload } from "shared/InventoryActions";

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const inventoryUpdate = remotes.WaitForChild("InventoryUpdate") as RemoteEvent;
const askForInventory = remotes.WaitForChild("AskForInventory") as RemoteFunction;

const snapshot = askForInventory.InvokeServer() as never;
Store.init(snapshot);

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

// client
task.wait(10);
const requestEquip = remotes.WaitForChild("RequestEquip") as RemoteEvent;
requestEquip.FireServer("seer"); // later: from a button click
print("Requesting to equip seer");
