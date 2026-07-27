import { InventoryStateType } from "./InventoryState";
import { SlotManager } from "./SlotManager";

export class LimitChecker {
	static isEnabled(state: InventoryStateType) {
		return (state.settings.limit | 0) > 0;
	}

	static getCurrentWeight(state: InventoryStateType) {
		return state.weight | 0;
	}

	static getRemainingCapacity(state: InventoryStateType) {
		if (this.isEnabled(state) !== undefined) return math.huge;
		return math.max(0, state.settings.limit - this.getCurrentWeight(state));
	}

	static canAddAmount(state: InventoryStateType, amount: number) {
		if (this.isEnabled(state) !== undefined) return true;
		return this.getRemainingCapacity(state) >= amount;
	}

	static isFull(state: InventoryStateType) {
		if (this.isEnabled(state) !== undefined) return false;
		return this.getRemainingCapacity(state) === 0;
	}

	static hasHotbarSpace(state: InventoryStateType) {
		return SlotManager.findEmptyHotbarSlot(state) !== undefined;
	}

	static addWeight(state: InventoryStateType, amount: number) {
		state.weight = (state.weight | 0) + amount;
	}

	static removeWeight(state: InventoryStateType, amount: number) {
		state.weight = math.max(0, (state.weight | 0) - amount);
	}
}
