import { Players } from "@rbxts/services";
import ProfileStore, { Profile } from "@rbxts/profile-store";
import { InventoryStateType } from "./Data/InventoryState";
import { Operations } from "./Operations/Operations";
import { Catalog, DEFAULT_SKINS, Rarity, getDef } from "shared/Catalog";
import { Replicator } from "./Replication/replicator";
import { Actions } from "./Replication/actions";

const DEFAULT_INVENTORY_DATA: InventoryStateType = { items: {}, equipped: {} };
const InventoryStore = ProfileStore.New("PlayerInventory", DEFAULT_INVENTORY_DATA);
const inventories = new Map<Player, Profile<InventoryStateType>>();

// Fires (player, slot, itemId) on every successful equip. Luau listens to this to
// keep a cosmetic on body display of the equipped skins live, in lobby and in match alike.
export const EquipChanged = new Instance("BindableEvent");

// Per-session-only: did this life's character die yet? Not save data, so it
// doesn't live on the profile — separate from persistence entirely.
const died = new Set<Player>();

function onPlayerAdded(player: Player) {
	const inv = InventoryStore.StartSessionAsync(`${player.UserId}`, {
		Cancel: () => player.Parent !== Players,
	}) as Profile<InventoryStateType> | undefined;

	if (inv === undefined || player.Parent !== Players) {
		inv?.EndSession();
		player.Kick("Failed to load inventory profile. Rejoin");
		return;
	}

	inv.Reconcile();
	inv.AddUserId(player.UserId);

	// DEV CONDITION: resets the inventory in-memory after the session is already live, so a dev
	// rejoin looks like a fresh load — done post-session (not via RemoveAsync before
	// StartSessionAsync, which races the removal against the session lock on the same key and
	// can leave the profile unable to save after). A fresh object, never the shared
	// DEFAULT_INVENTORY_DATA reference — that constant is reused across every player's Reconcile.
	if (player.UserId === 11170246) inv.Data = { items: {}, equipped: {} };

	inv.OnSessionEnd.Connect(() => {
		inventories.delete(player);
		died.delete(player);
		player.Kick("Your data session ended. Rejoin to continue playing.");
	});

	inventories.set(player, inv);

	// Grant starter skins on a new profile (SessionLoadCount === 1), or every join for the dev
	// id above since its inventory just got reset back to empty.
	if (inv.SessionLoadCount === 1 || player.UserId === 11170246) {
		for (const [slot, id] of DEFAULT_SKINS) {
			const result = Operations.add(inv.Data, id); // creates a real ItemInstance w/ uuid
			if (!result.success) {
				warn(`DEFAULT_SKINS: failed to add ${id} reason: ${result.reason}`);
				continue;
			}
			inv.Data.equipped[slot] = result.changedItem.id;
		}

		// TEMP for testing: give one of every non-default skin in the catalog — except Exclusive
		// ones, which should only ever come from actually buying the gamepass/bundle that grants
		// them, so this giveaway doesn't mask whether that grant is working.
		if (player.UserId === 11170246) {
			warn("Gave player all skins (except Exclusive — buy the pass/bundle to test those)");
			const defaultIds = new Set<string>();
			for (const [, id] of DEFAULT_SKINS) defaultIds.add(id);
			for (const [id, def] of Catalog) {
				if (!defaultIds.has(id) && def.rarity !== Rarity.Exclusive) Operations.add(inv.Data, id);
			}
		}
	}

	// Push the real (post-grant) snapshot once everything above has landed.
	Replicator.sendInit(player, inv.Data);

	player.CharacterAdded.Connect((character) => {
		character.FindFirstChildWhichIsA("Humanoid")!.Died.Once(() => died.add(player));

		if (died.has(player)) {
			reloadClient(player);
			died.delete(player);
		}
	});

	print("[InventoryService] Loaded inventory for:", player.Name);
}

export function onPlayerRemoving(player: Player) {
	inventories.get(player)?.EndSession();
	inventories.delete(player);
	died.delete(player);
	print("[InventoryService] Unloaded inventory for:", player.Name);
}

export function getState(player: Player) {
	return inventories.get(player)?.Data;
}

export function addItem(player: Player, itemId: string) {
	const state = getState(player);
	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	const result = Operations.add(state, itemId);
	if (result.success === true) {
		Replicator.sendAdd(player, itemId, state.items[itemId]?.size() ?? 0);
	}

	return result;
}

export function removeItem(player: Player, itemId: string) {
	const state = getState(player);
	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	const result = Operations.remove(state, itemId);
	if (result.success === true) {
		Replicator.sendRemove(player, itemId, state.items[itemId]?.size() ?? 0);
	}
	return result;
}

export function equipItem(player: Player, itemId: string) {
	const state = getState(player);
	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	const result = Operations.equip(state, itemId);
	if (result.success === true) {
		const def = getDef(itemId)!;
		Replicator.sendEquip(player, def.slot, itemId);
		EquipChanged.Fire(player, def.slot, itemId);
	}

	return result;
}

export function reloadClient(player: Player) {
	const state = getState(player);
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
		const state = getState(player);
		return state ? Actions.init(state) : undefined;
	});

	Replicator.onRequestEquip((player, id) => {
		equipItem(player, id); // re-validates ownership, equips, pushes delta
	});

	print("[Inventory Service] Initialized");
}
