import { MarketplaceService, Players, ReplicatedStorage, TextChatService } from "@rbxts/services";
import { Cases } from "shared/Cases";
import { CaseResultPayload } from "shared/types/Shop";
import { trackTagged } from "../UI/Tags";
import * as CratePresenter from "./CratePresenter";

// Buttons for the Halloween Case on the event screen, found by tag:
//   HalloweenCasePotions  buys and opens the case with potions
//   HalloweenCaseRobux    prompts the Robux purchase (the server opens it on receipt)
// While the crate ceremony plays, the tagged EventScreen is hidden and then restored.

const TAG_POTIONS = "HalloweenCasePotions";
const TAG_ROBUX = "HalloweenCaseRobux";
const TAG_SCREEN = "EventScreen";
const CASE_ID = "HalloweenCase";

const REQUEST_TIMEOUT = 10; // seconds before the buttons unlock if the server goes quiet
const CEREMONY_START_TIMEOUT = 2; // seconds to wait for the presenter to take over
const POLL_INTERVAL = 0.1;

const player = Players.LocalPlayer;
const remotes = ReplicatedStorage.WaitForChild("Remotes");
const openCase = remotes.WaitForChild("OpenCase") as RemoteEvent;
const caseResult = remotes.WaitForChild("CaseResult") as RemoteEvent;

const caseDef = Cases.get(CASE_ID);

let requesting = false;

function systemMessage(text: string) {
	const general = TextChatService.FindFirstChild("TextChannels")?.FindFirstChild("RBXGeneral") as
		TextChannel | undefined;
	general?.DisplaySystemMessage(text);
}

function unlockLater() {
	task.delay(REQUEST_TIMEOUT, () => (requesting = false));
}

function onPotionsPressed() {
	if (requesting || CratePresenter.isBusy()) return;

	requesting = true;
	openCase.FireServer(CASE_ID);
	unlockLater();
}

function onRobuxPressed() {
	if (requesting || CratePresenter.isBusy()) return;

	const productId = caseDef?.robuxProductId;
	if (productId === undefined || productId === 0) {
		systemMessage("The Halloween Case isn't available for Robux yet.");
		return;
	}

	MarketplaceService.PromptProductPurchase(player, productId);
}

// A tag can fire for an instance more than once; never bind the same button twice.
const bound = new Set<GuiButton>();
function bindButton(button: GuiButton, onPressed: () => void) {
	if (bound.has(button)) return;
	bound.add(button);
	button.Activated.Connect(onPressed);
}

trackTagged<GuiButton>(TAG_POTIONS, (button) => bindButton(button, onPotionsPressed));
trackTagged<GuiButton>(TAG_ROBUX, (button) => bindButton(button, onRobuxPressed));

const screens = trackTagged<ScreenGui>(TAG_SCREEN);

// Hide the event screen for the length of the crate ceremony, then give it back.
function coverCeremony() {
	const hidden: ScreenGui[] = [];
	for (const screen of screens) {
		if (!screen.Enabled) continue;
		screen.Enabled = false;
		hidden.push(screen);
	}
	if (hidden.size() === 0) return;

	task.spawn(() => {
		// the presenter is started by the shop's CaseResult handler a moment after this one
		let waited = 0;
		while (!CratePresenter.isBusy() && waited < CEREMONY_START_TIMEOUT) {
			task.wait(POLL_INTERVAL);
			waited += POLL_INTERVAL;
		}
		while (CratePresenter.isBusy()) task.wait(POLL_INTERVAL);

		for (const screen of hidden) screen.Enabled = true;
	});
}

caseResult.OnClientEvent.Connect((_text: string, payload?: CaseResultPayload) => {
	requesting = false;

	if (payload?.ok !== true || payload.caseId !== CASE_ID) return;
	coverCeremony();
});
