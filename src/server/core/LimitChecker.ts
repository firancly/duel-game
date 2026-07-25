import { InventoryStateType } from "./InventoryState";
import { SlotManager } from "./SlotManager";

export class LimitChecker {
	isEnabled(state: InventoryStateType) {
		return (state.settings.limit | 0) > 0;
	}

	getCurrentWeight(state: InventoryStateType) {
		return state.weight | 0;
	}

	getRemainingCapacity(state: InventoryStateType) {
		if (this.isEnabled(state) !== undefined) return math.huge;
		return math.max(0, state.settings.limit - this.getCurrentWeight(state));
	}

	canAddAmount(state: InventoryStateType, amount: number) {
		if (this.isEnabled(state) !== undefined) return true;
		return this.getRemainingCapacity(state) >= amount;
	}

	isFull(state: InventoryStateType) {
		if (this.isEnabled(state) !== undefined) return false;
		return this.getRemainingCapacity(state) === 0;
	}

	hasHotbarSpace(state: InventoryStateType) {
		return SlotManager.findEmptyHotbarSlot(state) !== undefined;
	}

	addWeight(state: InventoryStateType, amount: number) {
		state.weight = (state.weight | 0) + amount;
	}

	removeWeight(state: InventoryStateType, amount: number) {
		state.weight = math.max(0, (state.weight | 0) - amount);
	}
}
