export interface WalletStateType {
	player: Player;
	amount: number; // current balance
}

export class WalletState implements WalletStateType {
	player: Player;
	amount = 0;

	constructor(player: Player) {
		this.player = player;
	}
}
