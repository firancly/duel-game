import { MarketplaceService, Players, ReplicatedStorage, TextChatService } from "@rbxts/services";
import { Cases } from "shared/Cases";
import { CoinOffer, CoinProducts } from "shared/Monetization";
import { CaseResultPayload } from "shared/types/Shop";
import * as WindowManager from "../UI/WindowManager";
import * as CratePresenter from "./CratePresenter";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const shop = gui.WaitForChild("MainFrame").WaitForChild("ShopGUI") as GuiObject;
const container = shop.WaitForChild("Container");
const cases = container.WaitForChild("Cases");
const casesContainer = cases.WaitForChild("CasesContainer");
const casesContainer2 = cases.WaitForChild("CasesContainer2");

const productsTab = container.WaitForChild("Gamepasses");
const productsContainer = productsTab.WaitForChild("CoinsContainer");
const productsContainer2 = productsTab.WaitForChild("CoinsContainer2");

WindowManager.register("Shop", () => (shop.Visible = false));

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const openCase = remotes.WaitForChild("OpenCase") as RemoteEvent;
const caseResult = remotes.WaitForChild("CaseResult") as RemoteEvent;

function systemMessage(text: string) {
	const channels = TextChatService.FindFirstChild("TextChannels");
	const general = channels?.FindFirstChild("RBXGeneral") as TextChannel | undefined;
	general?.DisplaySystemMessage(text);
}

// one open at a time
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

function labelOffer(btn: Instance, offer: CoinOffer) {
	const label = (btn.FindFirstChild("Price") ?? btn.FindFirstChild("Title")) as TextLabel | undefined;
	if (label === undefined) return;

	if (offer.id === 0) {
		label.Text = `${offer.coins} Coins`;
		return;
	}

	const [ok, info] = pcall(() => MarketplaceService.GetProductInfo(offer.id, Enum.InfoType.Product));
	const price = ok ? (info as { PriceInRobux?: number }).PriceInRobux : undefined;
	label.Text = price !== undefined ? `R$${price}` : `${offer.coins} Coins`;
}

function wireOffer(parent: Instance, offer: CoinOffer) {
	const btn = parent.FindFirstChild(offer.button) as ImageButton | undefined;
	if (btn === undefined) {
		warn(`[Shop] no button "${offer.button}" in ${parent.GetFullName()}`);
		return;
	}

	labelOffer(btn, offer);
	btn.Activated.Connect(() => {
		print(`[Shop] clicked ${offer.button} (id ${offer.id})`);
		if (offer.id === 0) {
			systemMessage("This offer isn't set up yet — check back later.");
			return;
		}
		MarketplaceService.PromptProductPurchase(player, offer.id);
	});
	print(`[Shop] Wired product ${offer.button} → id ${offer.id}`);
}

function productParent(offer: CoinOffer): Instance {
	return offer.container === "CoinsContainer" ? productsContainer : productsContainer2;
}

for (const offer of CoinProducts) {
	wireOffer(productParent(offer), offer);
}

// server tells us what we got (or why it failed) as a chat message
caseResult.OnClientEvent.Connect((text: string, payload?: CaseResultPayload) => {
	systemMessage(text);
	requesting = false;

	if (payload?.ok !== true || payload.skinId === undefined) return;

	shop.Visible = false;
	const started = CratePresenter.present(payload.caseId, payload.skinId, payload.rarity, () => {
		WindowManager.open("Shop");
		shop.Visible = true;
	});
	if (!started) {
		WindowManager.open("Shop");
		shop.Visible = true; // presenter refused put the shop back
		systemMessage(`Error: the ${payload.caseId} crate does not exist.`);
	}
});

// type shop in chat to toggle the shop open/closed
player.Chatted.Connect((msg) => {
	if (msg.lower() === "shop") {
		if (shop.Visible) {
			WindowManager.closed("Shop");
			shop.Visible = false;
		} else {
			WindowManager.open("Shop");
			shop.Visible = true;
		}
	}
});

// Logic for close button
const closeBtn = shop.WaitForChild("CloseButton") as GuiButton;
closeBtn.MouseButton1Click.Connect(() => {
	WindowManager.closed("Shop");
	(closeBtn.Parent as GuiObject).Visible = false;
});

// the coin display doubles as a shop shortcut
const moneyBuyBtn = gui
	.WaitForChild("MainFrame")
	.WaitForChild("MoneyBackground")
	.WaitForChild("BuyButton") as ImageButton;
moneyBuyBtn.Activated.Connect(() => {
	WindowManager.open("Shop");
	shop.Visible = true;
});

export {};
