import { WalletStateType } from "../core/CurrencyState";

// message types the client can receive
export enum ActionType {
	INIT = "Init", // full snapshot (on join)
	EARN = "Earn", // coins gained
	SPEND = "Spend", // coins spent
	SET = "Set", // balance overwritten (admin/debug)
}

// every message carries `amount` = the new balance, so the client just displays it
export class CoinActions {
	static init(state: WalletStateType) {
		return { amount: state.amount };
	}

	static earn(amount: number) {
		return { amount };
	}

	static spend(amount: number) {
		return { amount };
	}

	static set(amount: number) {
		return { amount };
	}
}
