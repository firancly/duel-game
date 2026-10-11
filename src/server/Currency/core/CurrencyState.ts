export interface PlayerCurrencyData {
	coins: number;
	potions: number; // earned from missions, spent on the special crate
}

export const DEFAULT_PLAYER_CURRENCY_DATA: PlayerCurrencyData = {
	coins: 0,
	potions: 0,
};

export interface WalletStateType {
	player: Player;
	amount: number; // current balance
}
