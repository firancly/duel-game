import { Players, ReplicatedStorage, TextChatService } from "@rbxts/services";
import { Cases } from "shared/Cases";
import { CaseResultPayload } from "shared/types/Shop";
import * as CratePresenter from "./CratePresenter";

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

// one open at a time: true from firing OpenCase until the server answers
let requesting = false;

// wire a case button to its caseId
function wireCase(parent: Instance, name: string, caseId: string) {
	const btn = parent.FindFirstChild(name) as ImageButton | undefined;

	const priceLabel = btn?.FindFirstChild("Price") as TextLabel | undefined;
	const caseDef = Cases.get(caseId);
	if (priceLabel !== undefined && caseDef !== undefined) priceLabel.Text = tostring(caseDef.price);

	btn?.Activated.Connect(() => {
		if (requesting || CratePresenter.isBusy()) return;

		requesting = true;
		openCase.FireServer(caseId);
		print(`[Shop] ${player.Name} clicked ${name} → ${caseId}`);

		// failsafe: never leave the buttons dead if the server goes quiet
		task.delay(10, () => (requesting = false));
	});
	print(`[Shop] Wired ${name} → ${caseId}`);
}

wireCase(casesContainer, "GreenCase", "GreenCase");
wireCase(casesContainer, "BlueCase", "BlueCase");
wireCase(casesContainer, "RedCase", "RedCase");
wireCase(casesContainer, "PurpleCase", "PurpleCase");
wireCase(casesContainer2, "YellowCase", "YellowCase");

// server tells us what we got (or why it failed) as a chat message.
// On success the payload carries the rolled skin, so the crate ceremony can
// start already knowing what it will reveal.
caseResult.OnClientEvent.Connect((text: string, payload?: CaseResultPayload) => {
	systemMessage(text);
	requesting = false;

	if (payload?.ok !== true || payload.skinId === undefined) return;

	shop.Visible = false;
	const started = CratePresenter.present(payload.caseId, payload.skinId, payload.rarity, () => {
		shop.Visible = true;
	});
	if (!started) shop.Visible = true; // presenter refused, put the shop back
});

// type shop in chat to toggle the shop open/closed
player.Chatted.Connect((msg) => {
	if (msg.lower() === "shop") {
		shop.Visible = !shop.Visible;
	}
});

export {};
