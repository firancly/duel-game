export enum ActionType {
	INIT = "Init",
	EARN = "Earn",
	SPEND = "Spend",
	SET = "Set",
}

export interface WalletStateType {
	player: Player;
	amount: number;
}

export class CoinActions {
	static init(state: WalletStateType) {
		return {
			amount: state.amount,
		};
	}

	static earn() {}
	static spend() {}
	static set() {}
}
