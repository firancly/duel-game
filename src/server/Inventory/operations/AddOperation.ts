import { LimitChecker } from "server/Inventory/core/LimitChecker";
import Generate from "server/Inventory/utils/uuid";
import { InventoryStateType, ItemInstance } from "server/Inventory/core/InventoryState";
import { MetaDataParser } from "server/Inventory/utils/metaDataParser";
import { SlotManager } from "server/Inventory/core/SlotManager";
import { StackChecker } from "server/Inventory/utils/stackChecker";
import Settings from "shared/Settings";
import { DropOperation } from "./DropOperation";
import { EquipOperation } from "./EquipOperation";

export interface AddResult {
	success: boolean;
	reason?: string;
	addedItems?: Array<{ uuid: string; slotType: string; slot: number }>;
	updatedItems?: Map<string, number>; // UUID -> New Amount
	addedAmount?: number; // How many were actually added
	overflow?: number; // How many could NOT be added (for dropping/ignoring)
	equippedUUID?: string; // UUID of the item that was automatically equipped
}

// Remove Amount and Stack amount attributes
function normalizeMetadataOverrides(
	metadataOverrides: Map<string, unknown> | undefined,
): [Map<string, unknown> | undefined, number | undefined] {
	if (metadataOverrides === undefined && !typeIs(metadataOverrides, "table")) {
		return [undefined, undefined];
	}

	const normalized = new Map<string, unknown>();
	for (const [k, v] of metadataOverrides) {
		normalized.set(k, v);
	}

	let amountFromMeta: unknown = normalized.get("Amount");
	if (amountFromMeta === undefined) {
		amountFromMeta = normalized.get("StackAmount");
	}

	if (typeIs(amountFromMeta, "string")) amountFromMeta = tonumber(amountFromMeta);
	if (!typeIs(amountFromMeta, "number")) amountFromMeta = undefined;

	normalized.delete("Amount");
	normalized.delete("StackAmount");

	return [normalized, amountFromMeta as number | undefined];
}

function createItem(
	state: InventoryStateType,
	itemId: string,
	amount: number,
	metadata?: Map<string, unknown>,
): ItemInstance {
	const uuid = Generate();
	const newAmount = math.min(amount, state.settings.maxStackSize);

	const item: ItemInstance = {
		UUID: uuid,
		id: itemId,
		amount: newAmount,
		metadata: metadata ?? new Map(),
	};

	state.items.set(uuid, item);

	let uuids = state.itemsByID.get(itemId);
	if (uuids === undefined) {
		uuids = [];
		state.itemsByID.set(itemId, uuids);
	}
	uuids.push(uuid);

	LimitChecker.addWeight(state, newAmount);

	return item;
}

export class AddOperation {
	static execute(
		state: InventoryStateType,
		itemId: string,
		amount?: number,
		metadataOverrides?: Map<string, unknown>,
	): AddResult {
		const [normalizedOverrides, metadataAmount] = normalizeMetadataOverrides(metadataOverrides);

		// Prepare metadata (parse from tool + merge overrides)
		// MetaDataParser returns [metadata, defaultAmount] - Amount is excluded from metadata
		const [baseMeta, defaultAmount] = MetaDataParser.fromItemId(itemId);
		const finalMetadata = MetaDataParser.merge(baseMeta, normalizedOverrides);

		// Use explicit amount first, then metadata-provided amount, then tool default, then 1
		const finalAmount = amount ?? metadataAmount ?? defaultAmount ?? 1;
		let equippedUUID: string | undefined = undefined;

		// Validate amount
		if (finalAmount <= 0) {
			return { success: false, reason: "INVALID_AMOUNT" };
		}

		const addedItems: Array<{ uuid: string; slotType: string; slot: number }> = [];
		const originalAmount = finalAmount;

		// 1. Cap amount to remaining capacity (partial fill)
		let remainingAmount = finalAmount;
		if (LimitChecker.isEnabled(state)) {
			const remaining = LimitChecker.getRemainingCapacity(state);
			if (remaining <= 0) {
				// Completely full, nothing can be added
				return { success: false, reason: "FULL", addedAmount: 0, overflow: finalAmount };
			}
			// Cap to what we can fit
			remainingAmount = math.min(remainingAmount, remaining);
		}

		const amountToAdd = remainingAmount; // Track how much we'll try to add after capping

		// 2. Try stacking first (StackChecker updates weight internally)
		let updatedItems: Map<string, number> = new Map();
		if (state.settings.canStack) {
			const [stacked, updates] = StackChecker.tryStack(state, itemId, remainingAmount, finalMetadata);
			remainingAmount -= stacked;
			updatedItems = updates;

			if (remainingAmount <= 0) {
				const overflow = originalAmount - amountToAdd;
				return {
					success: true,
					addedItems,
					updatedItems,
					addedAmount: amountToAdd,
					overflow,
				};
			}
		}

		// 3. Remaining amount after stacking - create new slots

		// Check for Backpack Disabled Logic
		if (Settings.Storage.backpackEnabled === false) {
			// Try Hotbar first
			while (remainingAmount > 0) {
				const slot = SlotManager.findEmptyHotbarSlot(state);
				if (slot !== undefined) {
					const item = createItem(state, itemId, remainingAmount, finalMetadata);
					SlotManager.setHotbarSlot(state, slot, item.UUID);
					addedItems.push({ uuid: item.UUID, slotType: "Hotbar", slot });
					remainingAmount -= item.amount;
				} else {
					// Hotbar is FULL.
					// Logic: Drop currently equipped item (or slot 0), then place new item there.

					// 1. Determine Target Slot
					let targetSlot = 0;
					const equippedItemUUID = state.equippedItemUUID;

					if (equippedItemUUID !== undefined) {
						const found = SlotManager.findSlotByUUID(state, equippedItemUUID);
						if (found !== undefined) {
							const [sType, sIndex] = found;
							if (sType === "Hotbar") {
								targetSlot = sIndex;
							}
						}
					}

					// 2. Drop existing item in target slot
					const existingUUID = state.hotbar[targetSlot];
					if (existingUUID !== undefined) {
						// We force drop. DropOperation handles unequip + remove + spawn.
						// Note: DropOperation might check Droppable settings.
						// If dropping is disabled but we are forcing a swap, we might need to override or just Remove.
						// Requirement says "drop that to the world".
						DropOperation.execute(state, state.player, "Hotbar", targetSlot, undefined, {
							skipHotbarCompaction: true,
						});
					}

					const item = createItem(state, itemId, remainingAmount, finalMetadata);
					SlotManager.setHotbarSlot(state, targetSlot, item.UUID);
					addedItems.push({ uuid: item.UUID, slotType: "Hotbar", slot: targetSlot });

					// 4. Re-equip new item if previous was equipped
					if (equippedItemUUID !== undefined) {
						EquipOperation.equip(state, state.player, item.UUID);
						equippedUUID = item.UUID;
					}

					remainingAmount -= item.amount;

					// Since we are forcing a swap for the remainder, we break loop after one swap?
					// Usually you pick up one stack/item.
					// If remainingAmount > maxStack, we might loop.
					// But for "swap" logic, usually we handle one slot.
					break;
				}
			}
		} else {
			// Standard Logic (Backpack Enabled)

			// 3. Try Hotbar first (Static)
			while (remainingAmount > 0) {
				const slot = SlotManager.findEmptyHotbarSlot(state);
				if (slot !== undefined) {
					const item = createItem(state, itemId, remainingAmount, finalMetadata);
					SlotManager.setHotbarSlot(state, slot, item.UUID);
					addedItems.push({ uuid: item.UUID, slotType: "Hotbar", slot });
					remainingAmount -= item.amount;
				} else {
					break;
				}
			}

			// 4. Try Storage (Dynamic Append)
			while (remainingAmount > 0) {
				// If limit is infinite OR we have capacity, allow adding
				if (!LimitChecker.isEnabled(state) || LimitChecker.getRemainingCapacity(state) > 0) {
					const item = createItem(state, itemId, remainingAmount, finalMetadata);
					SlotManager.appendStorage(state, item.UUID);
					const storageIndex = state.storage.size();
					addedItems.push({ uuid: item.UUID, slotType: "Storage", slot: storageIndex });
					remainingAmount -= item.amount;
				} else {
					break; // No more room
				}
			}
		}

		// Calculate results
		const addedAmount = amountToAdd - remainingAmount;
		const overflow = originalAmount - addedAmount;

		return {
			success: addedAmount > 0,
			addedItems,
			updatedItems,
			addedAmount,
			overflow,
			reason: overflow > 0 ? "PARTIAL" : undefined,
			equippedUUID,
		};
	}
}
