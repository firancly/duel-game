import { Players, ServerStorage } from "@rbxts/services";
import Settings from "shared/Settings";
import { InventoryState, InventoryStateType, ItemInstance } from "./core/InventoryState";
import { SlotManager } from "./core/SlotManager";
import { LimitChecker } from "./core/LimitChecker";
import { AddOperation, AddResult } from "./operations/AddOperation";
import { RemoveOperation, RemoveResult } from "./operations/RemoveOperation";
import { EquipOperation, EquipResult } from "./operations/EquipOperation";
import { DropOperation, DropResult } from "./operations/DropOperation";
// import { SwapOperation } from "./operations/SwapOperation"; // TODO: SwapOperation.ts doesn't exist yet
import { Replicator } from "./Replication/Replicator";
import { MetaDataParser } from "./utils/metaDataParser";
import Generate from "./utils/uuid";
import { StackChecker } from "./utils/stackChecker";
// import { ChatCommands } from "./Debug/ChatCommands"; // TODO: ChatCommands.ts doesn't exist yet

const playerInventories = new Map<Player, InventoryState>();
const playerOperationLock = new Set<Player>();

const toolsFolder = ServerStorage.FindFirstChild("Tools") as Folder | undefined;

function onPlayerAdded(player: Player) {
	const state = new InventoryState(player);
	playerInventories.set(player, state);

	player.CharacterAdded.Connect((character) => {
		character.FindFirstChildWhichIsA("Humanoid")!.Died.Once(() => (state.died = true));

		if (state.died) {
			InventoryService.reloadClient(player, { configSettingName: state.settings.uiType, refreshData: false });

			if (state.equippedItemUUID !== undefined) {
				const found = SlotManager.findSlotByUUID(state, state.equippedItemUUID);
				if (found !== undefined) {
					const [slotType, index] = found;
					InventoryService.unequipSlot(player, true);
					InventoryService.equipSlot(player, slotType, index, true);
				}
			}

			state.died = false;
		}
	});

	// Register debug chat commands
	// ChatCommands.register(player, InventoryService);
	InventoryService.addItem(player, "apple", 1, undefined, false);
	InventoryService.addItem(player, "shield", 1, undefined, false);
	InventoryService.addItem(player, "sword", 2, undefined, false);
	InventoryService.addToBackpack(player, "wood", 1, undefined, false);

	print("[InventoryService] Loaded inventory for", player.Name);
}

function onPlayerRemoving(player: Player) {
	playerInventories.delete(player);
	playerOperationLock.delete(player);
	print("[InventoryService] Unloaded inventory for", player.Name);
}

export class InventoryService {
	static getState(player: Player): InventoryStateType | undefined {
		return playerInventories.get(player);
	}

	static addItem(
		player: Player,
		itemId: string,
		amount: number,
		metadata: Map<string, unknown> | undefined,
		replicate: boolean,
	): AddResult {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };
		if (toolsFolder?.FindFirstChild(itemId) === undefined) return { success: false, reason: "ITEM_NOT_FOUND" };

		const result = AddOperation.execute(state, itemId, amount, metadata);

		if (result.success && replicate) {
			if (result.addedItems !== undefined && result.addedItems.size() > 0) {
				Replicator.sendAdd(player, result.addedItems, state.items);
			}

			if (result.updatedItems !== undefined) {
				for (const [uuid, newAmount] of result.updatedItems) {
					Replicator.sendUpdateMeta(
						player,
						uuid,
						new Map<string, unknown>([["Amount", newAmount]]),
						state.weight,
					);
				}
			}

			if (result.equippedUUID !== undefined) {
				Replicator.sendEquip(player, result.equippedUUID);
			}
		}

		return result;
	}

	static removeItem(player: Player, uuid: string, amount: number | undefined, replicate: boolean): RemoveResult {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		const result = RemoveOperation.execute(state, uuid, amount);

		if (result.success && replicate) {
			if (result.remaining !== undefined && result.remaining > 0) {
				Replicator.sendUpdateMeta(
					player,
					uuid,
					new Map<string, unknown>([["Amount", result.remaining]]),
					state.weight,
				);
			} else if (result.hotbarCompacted) {
				Replicator.sendInit(player, state);
			} else if (result.slotType !== undefined && result.slot !== undefined) {
				Replicator.sendRemove(player, result.slotType, result.slot, uuid);
			}
		}

		return result;
	}

	// static swapSlots(
	// 	player: Player,
	// 	fromType: string,
	// 	fromSlot: number,
	// 	toType: string,
	// 	toSlot: number,
	// 	replicate: boolean,
	// ) {
	// 	const state = playerInventories.get(player);
	// 	if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

	// 	const result = SwapOperation.executeRaw(state, fromType, fromSlot, toType, toSlot);

	// 	if (!result.success) return { success: false, reason: "Server error while swapping" };

	// 	if (replicate) {
	// 		if (result.hotbarCompacted) {
	// 			Replicator.sendInit(player, state);
	// 		} else {
	// 			Replicator.sendSwap(player, fromType, fromSlot, toType, toSlot);
	// 		}
	// 	}

	// 	return result;
	// }

	static equipSlot(player: Player, slotType: string, slot: number, replicate: boolean): EquipResult {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		const result = EquipOperation.equipBySlot(state, player, slotType, slot);

		if (result.success && replicate) {
			Replicator.sendEquip(player, result.currentUUID);
		}

		return result;
	}

	static unequipSlot(player: Player, replicate: boolean): EquipResult {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		const result = EquipOperation.unequip(state, player);

		if (result.success && replicate) {
			Replicator.sendEquip(player, undefined);
		}

		return result;
	}

	static dropItem(
		player: Player,
		slotType: string,
		slot: number,
		amount: number | undefined,
		replicate: boolean,
	): DropResult {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		const result = DropOperation.execute(state, player, slotType, slot, amount);

		if (result.success && replicate) {
			if (result.remaining !== undefined && result.remaining > 0 && result.UUID !== undefined) {
				Replicator.sendUpdateMeta(
					player,
					result.UUID,
					new Map<string, unknown>([["Amount", result.remaining]]),
					state.weight,
				);
			} else if (result.hotbarCompacted) {
				Replicator.sendInit(player, state);
			} else if (result.UUID !== undefined) {
				Replicator.sendRemove(player, slotType, slot, result.UUID);
			}
		}

		return result;
	}

	static updateMetadata(player: Player, uuid: string, updates: Map<string, unknown>, replicate: boolean): boolean {
		const state = playerInventories.get(player);
		if (state === undefined) return false;

		const item = state.items.get(uuid);
		if (item === undefined) return false;

		if (item.metadata === undefined) {
			item.metadata = new Map();
		}

		for (const [k, v] of updates) {
			item.metadata.set(k, v);
		}

		if (replicate) Replicator.sendUpdateMeta(player, uuid, updates, state.weight);
		return true;
	}

	static syncSettings(player: Player) {
		const state = playerInventories.get(player);
		if (state !== undefined) {
			Replicator.sendUpdateSettings(player, state.settings);
		}
	}

	static reloadClient(player: Player, config: { configSettingName: string; refreshData?: boolean }) {
		const state = playerInventories.get(player);
		const uiType = Settings.DifferentUIs[config.configSettingName];
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };
		if (uiType === undefined) return { success: false, reason: `NO UI CALLED ${config.configSettingName}` };

		state.settings.uiType = config.configSettingName;
		Replicator.sendReload(player, config.configSettingName, state);
		return { success: true };
	}

	// Stack two slots together (for drag-and-drop stacking)
	// Drags item A onto item B -> B absorbs as much as possible, A keeps remainder
	static stackTwoSlots(
		player: Player,
		fromType: string,
		fromSlot: number,
		toType: string,
		toSlot: number,
		replicate: boolean,
	) {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		if (!state.settings.canStack) {
			return { success: false, reason: "STACKING_DISABLED" };
		}

		const fromUUID = SlotManager.getUUIDFromSlot(state, fromType, fromSlot);
		const toUUID = SlotManager.getUUIDFromSlot(state, toType, toSlot);

		if (fromUUID === undefined || toUUID === undefined) {
			return { success: false, reason: "SLOT_EMPTY" };
		}

		const fromItem = state.items.get(fromUUID);
		const toItem = state.items.get(toUUID);

		if (fromItem === undefined || toItem === undefined) {
			return { success: false, reason: "ITEM_NOT_FOUND" };
		}

		if (!StackChecker.canStack(fromItem, toItem)) {
			return { success: false, reason: "CANNOT_STACK" };
		}

		const maxStack = state.settings.maxStackSize;
		if (toItem.amount >= maxStack || fromItem.amount >= maxStack) {
			return { success: false, reason: "STACK_FULL" };
		}

		const space = maxStack - toItem.amount;
		const transfer = math.min(fromItem.amount, space);

		toItem.amount += transfer;
		fromItem.amount -= transfer;

		if (fromItem.amount <= 0) {
			RemoveOperation.execute(state, fromUUID, fromItem.amount);
		}

		if (replicate) Replicator.sendInit(player, state);

		return {
			success: true,
			transferred: transfer,
			fromRemaining: fromItem.amount,
			toAmount: toItem.amount,
		};
	}

	// Add item directly to backpack (bypasses hotbar-first logic)
	static addToBackpack(
		player: Player,
		itemId: string,
		amount: number | undefined,
		metadata: Map<string, unknown> | undefined,
		replicate: boolean,
	) {
		const state = playerInventories.get(player);
		if (state === undefined) return { success: false, reason: "NO_INVENTORY" };

		if (!Settings.Storage.backpackEnabled) {
			return { success: false, reason: "BACKPACK_DISABLED" };
		}

		if (toolsFolder?.FindFirstChild(itemId) === undefined) return { success: false, reason: "ITEM_NOT_FOUND" };

		let normalizedMetadata: Map<string, unknown> | undefined = undefined;
		let metadataAmount: number | undefined = undefined;

		if (metadata !== undefined) {
			normalizedMetadata = new Map<string, unknown>();
			for (const [k, v] of metadata) {
				normalizedMetadata.set(k, v);
			}

			let amountFromMeta: unknown = normalizedMetadata.get("Amount");
			if (amountFromMeta === undefined) {
				amountFromMeta = normalizedMetadata.get("StackAmount");
			}

			if (typeIs(amountFromMeta, "string")) amountFromMeta = tonumber(amountFromMeta);
			if (!typeIs(amountFromMeta, "number")) amountFromMeta = undefined;

			metadataAmount = amountFromMeta as number | undefined;

			normalizedMetadata.delete("Amount");
			normalizedMetadata.delete("StackAmount");
		}

		const [baseMeta, defaultAmount] = MetaDataParser.fromItemId(itemId);
		const finalMetadata = MetaDataParser.merge(baseMeta, normalizedMetadata);
		let finalAmount = amount ?? metadataAmount ?? defaultAmount ?? 1;

		if (finalAmount <= 0) {
			return { success: false, reason: "INVALID_AMOUNT" };
		}

		if (LimitChecker.isEnabled(state)) {
			const remaining = LimitChecker.getRemainingCapacity(state);
			if (remaining <= 0) {
				return { success: false, reason: "FULL", addedAmount: 0, overflow: finalAmount };
			}
			finalAmount = math.min(finalAmount, remaining);
		}

		const addedItems: Array<{ uuid: string; slotType: string; slot: number }> = [];
		const originalAmount = finalAmount;

		let updatedItems: Map<string, number> = new Map();
		if (state.settings.canStack) {
			const [stacked, updates] = StackChecker.tryStack(state, itemId, finalAmount, finalMetadata);
			finalAmount -= stacked;
			updatedItems = updates;
		}

		// Add remaining to storage directly (bypass hotbar)
		while (finalAmount > 0) {
			if (!LimitChecker.isEnabled(state) || LimitChecker.getRemainingCapacity(state) > 0) {
				const uuid = Generate();
				const newAmount = math.min(finalAmount, state.settings.maxStackSize);

				const item: ItemInstance = {
					UUID: uuid,
					id: itemId,
					amount: newAmount,
					metadata: finalMetadata,
				};

				state.items.set(uuid, item);

				let uuids = state.itemsByID.get(itemId);
				if (uuids === undefined) {
					uuids = [];
					state.itemsByID.set(itemId, uuids);
				}
				uuids.push(uuid);

				LimitChecker.addWeight(state, newAmount);

				SlotManager.appendStorage(state, uuid);
				const storageIndex = state.storage.size();
				addedItems.push({ uuid, slotType: "Storage", slot: storageIndex });

				finalAmount -= newAmount;
			} else {
				break;
			}
		}

		if (replicate) {
			if (addedItems.size() > 0) {
				Replicator.sendAdd(player, addedItems, state.items);
			}

			for (const [uuid, newAmount] of updatedItems) {
				Replicator.sendUpdateMeta(
					player,
					uuid,
					new Map<string, unknown>([["Amount", newAmount]]),
					state.weight,
				);
			}
		}

		const addedAmount = originalAmount - finalAmount;
		return {
			success: addedAmount > 0,
			addedItems,
			addedAmount,
			overflow: finalAmount,
			reason: finalAmount > 0 ? "PARTIAL" : undefined,
		};
	}

	static init() {
		Players.PlayerAdded.Connect(onPlayerAdded);
		Players.PlayerRemoving.Connect(onPlayerRemoving);

		// Handle existing players (studio test)
		for (const player of Players.GetPlayers()) {
			onPlayerAdded(player);
		}

		setupRemotes();

		print("[InventoryService] Initialized");
	}
}

// Operation types (must match client)
enum RequestOperation {
	SWAP = "Swap",
	EQUIP = "Equip",
	UNEQUIP = "Unequip",
	REMOVE = "Remove",
	DROP = "Drop",
	STACK = "Stack",
}

type OperationArgs = Record<string, unknown>;

// Operation handlers
const operationHandlers: Record<string, (player: Player, args: OperationArgs) => unknown> = {
	// [RequestOperation.SWAP]: (player, args) =>
	// 	InventoryService.swapSlots(
	// 		player,
	// 		args.fromType as string,
	// 		args.fromSlot as number,
	// 		args.toType as string,
	// 		args.toSlot as number,
	// 		false,
	// 	),
	[RequestOperation.EQUIP]: (player, args) =>
		InventoryService.equipSlot(
			player,
			(args.slotType as string | undefined) ?? "Hotbar",
			args.slot as number,
			false,
		),
	[RequestOperation.UNEQUIP]: (player) => InventoryService.unequipSlot(player, false),
	[RequestOperation.REMOVE]: (player, args) =>
		InventoryService.removeItem(player, args.uuid as string, args.amount as number | undefined, false),
	[RequestOperation.DROP]: (player, args) =>
		InventoryService.dropItem(
			player,
			args.slotType as string,
			args.slot as number,
			args.amount as number | undefined,
			false,
		),
	[RequestOperation.STACK]: (player, args) =>
		InventoryService.stackTwoSlots(
			player,
			args.fromType as string,
			args.fromSlot as number,
			args.toType as string,
			args.toSlot as number,
			false,
		),
};

function setupRemotes() {
	const remotesFolder = Replicator.getRemotesFolder();

	function getOrCreateRemote<T extends keyof CreatableInstances>(name: string, className: T): CreatableInstances[T] {
		const existing = remotesFolder.FindFirstChild(name) as CreatableInstances[T] | undefined;
		if (existing !== undefined) return existing;

		const remote = new Instance(className);
		remote.Name = name;
		remote.Parent = remotesFolder;
		return remote;
	}

	// InitialSync (Client requests full state) - No lock needed, read-only
	const initialSyncRemote = getOrCreateRemote("AskForStoway", "RemoteFunction");
	initialSyncRemote.OnServerInvoke = (player) => {
		// Anti-exploit: Check if player is locked
		if (playerOperationLock.has(player)) {
			return { success: false, reason: "OPERATION_IN_PROGRESS" };
		}

		playerOperationLock.add(player);

		// only here for some reason execution takes too long
		const lock = task.delay(3, () => {
			playerOperationLock.delete(player);
		});

		const state = playerInventories.get(player);
		if (state !== undefined) {
			playerOperationLock.delete(player);
			task.cancel(lock);
			return { success: true, reason: "", data: state };
		}

		return { success: false, reason: "NO_PLAYER_STATE_EXIST" };
	};

	// UNIFIED REMOTE: InventoryAction (All operations go through here)
	const inventoryActionRemote = getOrCreateRemote("InventoryAction", "RemoteEvent");
	inventoryActionRemote.OnServerEvent.Connect((player, operation, args) => {
		const state = playerInventories.get(player);

		// Anti-exploit: Check if player is locked
		if (playerOperationLock.has(player)) {
			if (state !== undefined) Replicator.sendInit(player, state);
			return;
		}

		// Validate operation
		if (!typeIs(operation, "string")) {
			if (state !== undefined) Replicator.sendInit(player, state);
			return;
		}

		const handler = operationHandlers[operation];
		if (handler === undefined) {
			if (state !== undefined) Replicator.sendInit(player, state);
			return;
		}

		// Validate args
		if (args === undefined || !typeIs(args, "table")) {
			if (state !== undefined) Replicator.sendInit(player, state);
			return;
		}

		// Lock player
		playerOperationLock.add(player);

		// In case a function is taking too long
		const lock = task.delay(3, () => {
			playerOperationLock.delete(player);
		});

		// Execute operation (wrapped in try/catch for safety)
		let success = true;
		let result: unknown;
		try {
			result = handler(player, args as OperationArgs);
		} catch (e) {
			success = false;
			result = e;
		}

		// Unlock player
		playerOperationLock.delete(player);
		task.cancel(lock);

		// Handle failure
		if (!success) {
			warn("[InventoryService] Operation error for", player.Name, ":", result);
			if (state !== undefined) Replicator.sendInit(player, state);
			return;
		}

		// Client uses optimistic updates; force correction when server diverges or rejects.
		if (!typeIs(result, "table") || (result as { success?: boolean }).success !== true) {
			if (state !== undefined) Replicator.sendInit(player, state);
			return;
		}

		if ((result as { hotbarCompacted?: boolean }).hotbarCompacted && state !== undefined) {
			Replicator.sendInit(player, state);
		}
	});
}
