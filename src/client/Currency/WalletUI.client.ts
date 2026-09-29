import { Players, ReplicatedStorage } from "@rbxts/services";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("NEW_MAIN_UI");
const moneyLabel = gui.WaitForChild("MainFrame").WaitForChild("MoneyBackground").WaitForChild("TextLabel") as TextLabel;

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const walletUpdate = remotes.WaitForChild("WalletUpdate") as RemoteEvent;
const askForWallet = remotes.WaitForChild("AskForWallet") as RemoteFunction;

function formatAmount(amount: number): string {
	const text = tostring(math.floor(amount));
	const [reversed] = string.gsub(string.reverse(text), "(%d%d%d)", "%1,");
	let formatted = string.reverse(reversed);

	if (string.sub(formatted, 1, 1) === ",") {
		formatted = string.sub(formatted, 2);
	} else if (string.sub(formatted, 1, 2) === "-,") {
		formatted = "-" + string.sub(formatted, 3);
	}

	return formatted + "$";
}

function setBalance(amount: number) {
	moneyLabel.Text = formatAmount(amount);
}

const snapshot = askForWallet.InvokeServer() as { amount: number };
setBalance(snapshot?.amount ?? 0);

walletUpdate.OnClientEvent.Connect((_action: string, payload: unknown) => {
	setBalance((payload as { amount: number }).amount);
});

export {};
