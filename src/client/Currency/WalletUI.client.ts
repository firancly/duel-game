import { Players, ReplicatedStorage } from "@rbxts/services";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const moneyLabel = gui.WaitForChild("MainFrame").WaitForChild("MoneyBackground").WaitForChild("TextLabel") as TextLabel;

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const walletUpdate = remotes.WaitForChild("WalletUpdate") as RemoteEvent;
const askForWallet = remotes.WaitForChild("AskForWallet") as RemoteFunction;

function setBalance(amount: number) {
	moneyLabel.Text = tostring(amount);
}

const snapshot = askForWallet.InvokeServer() as { amount: number };
setBalance(snapshot.amount);

walletUpdate.OnClientEvent.Connect((_action: string, payload: unknown) => {
	setBalance((payload as { amount: number }).amount);
});

export {};
