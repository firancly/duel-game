import { Players, ReplicatedStorage, TextChatService } from "@rbxts/services";
import { Cases } from "shared/Cases";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const shop = gui.WaitForChild("MainFrame").WaitForChild("ShopGUI") as GuiObject;
const container = shop.WaitForChild("Container");
const cases = container.WaitForChild("Cases");
const casesContainer = cases.WaitForChild("CasesContainer");
const casesContainer2 = cases.WaitForChild("CasesContainer2");

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const openCase = remotes.WaitForChild("OpenCase") as RemoteEvent;
const caseResult = remotes.WaitForChild("CaseResult") as RemoteEvent;

function systemMessage(text: string) {
	const channels = TextChatService.FindFirstChild("TextChannels");
	const general = channels?.FindFirstChild("RBXGeneral") as TextChannel | undefined;
	general?.DisplaySystemMessage(text);
}

// wire a case button to its caseId
function wireCase(parent: Instance, name: string, caseId: string) {
	const btn = parent.FindFirstChild(name) as ImageButton | undefined;

	const priceLabel = btn?.FindFirstChild("Price") as TextLabel | undefined;
	const caseDef = Cases.get(caseId);
	if (priceLabel !== undefined && caseDef !== undefined) priceLabel.Text = tostring(caseDef.price);

	btn?.Activated.Connect(() => {
		openCase.FireServer(caseId);
		print(`[Shop] ${player.Name} clicked ${name} → ${caseId}`);
	});
	print(`[Shop] Wired ${name} → ${caseId}`);
}

wireCase(casesContainer, "GreenCase", "GreenCase");
wireCase(casesContainer, "BlueCase", "BlueCase");
wireCase(casesContainer, "RedCase", "RedCase");
wireCase(casesContainer, "PurpleCase", "PurpleCase");
wireCase(casesContainer2, "YellowCase", "YellowCase");

// server tells us what we got (or why it failed) as a chat message
caseResult.OnClientEvent.Connect((text: string) => systemMessage(text));

// type shop in chat to toggle the shop open/closed
player.Chatted.Connect((msg) => {
	if (msg.lower() === "shop") {
		shop.Visible = !shop.Visible;
	}
});

export {};
