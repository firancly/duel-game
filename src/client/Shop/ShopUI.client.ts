import { MarketplaceService, Players, ReplicatedStorage, TextChatService } from "@rbxts/services";
import { Cases } from "shared/Cases";
import { CoinOffer, CoinProducts } from "shared/Monetization";
import { GamepassOffer, Gamepasses, findGamepassByKey } from "shared/Gamepasses";
import { CaseResultPayload } from "shared/types/Shop";
import * as WindowManager from "../UI/WindowManager";
import * as CratePresenter from "./CratePresenter";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const shop = gui.WaitForChild("MainFrame").WaitForChild("ShopGUI") as GuiObject;
const container = shop.WaitForChild("Container") as ScrollingFrame;
const cases = container.WaitForChild("Cases");
const casesContainer = cases.WaitForChild("CasesContainer");
const casesContainer2 = cases.WaitForChild("CasesContainer2");

const productsTab = container.WaitForChild("Coins");
const productsContainer = productsTab.WaitForChild("CoinsContainer");
const productsContainer2 = productsTab.WaitForChild("CoinsContainer2");

const gamepassesContent = container.WaitForChild("Gamepasses");
const gamepassesContainer1 = gamepassesContent.WaitForChild("GamepassesContainer1");
const gamepassesContainer2 = gamepassesContent.WaitForChild("GamepassesContainer2");

WindowManager.register("Shop", () => (shop.Visible = false));

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const openCase = remotes.WaitForChild("OpenCase") as RemoteEvent;
const caseResult = remotes.WaitForChild("CaseResult") as RemoteEvent;
const gamepassUpdate = remotes.WaitForChild("GamepassUpdate") as RemoteEvent;
const askForGamepasses = remotes.WaitForChild("AskForGamepasses") as RemoteFunction;

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

// Gamepasses ------------------------------------------------------------

const ownedGamepasses = new Set<string>();

function gamepassParent(gp: GamepassOffer): Instance {
	return gp.container === "GamepassesContainer1" ? gamepassesContainer1 : gamepassesContainer2;
}

function gamepassFrame(gp: GamepassOffer): Instance | undefined {
	return gamepassParent(gp).FindFirstChild(gp.key);
}

// Roblox already blocks a duplicate purchase server-side; this is just so the
// button reads "OWNED" instead of prompting a purchase that'll get refused.
function markOwned(key: string) {
	ownedGamepasses.add(key);

	const gp = findGamepassByKey(key);
	if (gp === undefined) return;

	const frame = gamepassFrame(gp);
	const button = frame?.FindFirstChild("Button") as ImageButton | undefined;
	const label = button?.FindFirstChild("TextLabel") as TextLabel | undefined;
	if (label !== undefined) label.Text = "OWNED";
	if (button !== undefined) button.Active = false;
}

function wireGamepass(gp: GamepassOffer) {
	const frame = gamepassFrame(gp);
	const button = frame?.FindFirstChild("Button") as ImageButton | undefined;
	if (button === undefined) {
		warn(`[Shop] no Button in gamepass frame "${gp.key}"`);
		return;
	}

	button.Activated.Connect(() => {
		print(`[Shop] clicked gamepass ${gp.key} (id ${gp.id})`);
		if (gp.id === 0) {
			systemMessage("This gamepass isn't set up yet — check back later.");
			return;
		}
		if (ownedGamepasses.has(gp.key)) {
			systemMessage(`You already own ${gp.name}.`);
			return;
		}
		MarketplaceService.PromptGamePassPurchase(player, gp.id);
	});
	print(`[Shop] Wired gamepass ${gp.key} → id ${gp.id}`);
}

for (const gp of Gamepasses) wireGamepass(gp);

const [gpOk, gpSnapshot] = pcall(() => askForGamepasses.InvokeServer() as { owned?: Record<string, boolean> });
if (gpOk && gpSnapshot?.owned !== undefined) {
	for (const [key, isOwned] of pairs(gpSnapshot.owned)) {
		if (isOwned) markOwned(key as string);
	}
}

gamepassUpdate.OnClientEvent.Connect((action: string, payload: unknown) => {
	if (action === "Init") {
		const owned = (payload as { owned?: Record<string, boolean> }).owned;
		for (const [key, isOwned] of pairs(owned ?? {})) {
			if (isOwned) markOwned(key as string);
		}
	} else if (action === "Own") {
		const key = (payload as { key?: string }).key;
		if (key === undefined) return;
		markOwned(key);
		systemMessage(`You unlocked ${findGamepassByKey(key)?.name ?? key}!`);
	}
});

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

// Logic for tab buttons
const tabs = shop.FindFirstChild("TabButtons") as Frame;
const casesTab = tabs.WaitForChild("Cases") as ImageButton;
const coinsTab = tabs.WaitForChild("Coins") as ImageButton;
const gamepassesTab = tabs.WaitForChild("Gamepasses") as ImageButton;
const limitedsTab = tabs.WaitForChild("Limiteds") as ImageButton;

const ACTIVE_TAB = "rbxassetid://76459582722455";
const INACTIVE_TAB = "rbxassetid://118371499551965";

let currentTab: ImageButton | undefined = undefined;

function highlightTab(active: ImageButton) {
	if (currentTab === active) return;
	currentTab = active;

	for (const b of tabs.GetChildren()) {
		if (b.IsA("ImageButton")) {
			if (b === active) {
				b.Image = ACTIVE_TAB;
				const title = b.FindFirstChild("Title") as TextLabel;
				title.TextColor3 = new Color3(1, 1, 1);
			} else {
				b.Image = INACTIVE_TAB;
				const title1 = b.FindFirstChild("Title") as TextLabel;
				title1.TextColor3 = new Color3(0.45, 0.45, 0.45);
			}
		}
	}
}

const tabScrollValues = {
	cases: 185,
	coins: 375,
	gamepasses: 560,
	limiteds: 0,
};

casesTab.MouseButton1Click.Connect(() => {
	container.CanvasPosition = new Vector2(0, tabScrollValues.cases);
	highlightTab(casesTab);
});

coinsTab.MouseButton1Click.Connect(() => {
	container.CanvasPosition = new Vector2(0, tabScrollValues.coins);
	highlightTab(coinsTab);
});

gamepassesTab.MouseButton1Click.Connect(() => {
	container.CanvasPosition = new Vector2(0, tabScrollValues.gamepasses);
	highlightTab(gamepassesTab);
});

limitedsTab.MouseButton1Click.Connect(() => {
	container.CanvasPosition = new Vector2(0, tabScrollValues.limiteds);
	highlightTab(limitedsTab);
});

export {};
