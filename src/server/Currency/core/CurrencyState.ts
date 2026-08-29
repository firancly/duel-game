export interface PlayerCurrencyData {
	coins: number;
}

export const DEFAULT_PLAYER_CURRENCY_DATA: PlayerCurrencyData = {
	coins: 0,
};

export interface WalletStateType {
	player: Player;
	amount: number; // current balance
}
