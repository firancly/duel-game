import {
	MarketplaceService,
	Players,
	ProximityPromptService,
	ReplicatedStorage,
	TextChatService,
} from "@rbxts/services";
import { Cases } from "shared/Cases";
import { CoinOffer, CoinProducts, LimitedOffer, Limiteds } from "shared/Monetization";
import { GamepassOffer, Gamepasses, findGamepassByKey } from "shared/Gamepasses";
import { CaseResultPayload } from "shared/types/Shop";
import * as WindowManager from "../UI/WindowManager";
import * as CratePresenter from "./CratePresenter";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("NEW_MAIN_UI");
const shop = gui.WaitForChild("MainFrame").WaitForChild("ShopGUI") as GuiObject;
const container = shop.WaitForChild("Scroll") as ScrollingFrame;

// new UI: every section is a card inside Scroll and the buttons sit directly in it
const cases = container.WaitForChild("Cases") as GuiObject;
const casesContainer = cases;
const casesContainer2 = cases;

const productsTab = container.WaitForChild("Coins") as GuiObject;
const limitedsContent = container.WaitForChild("PacketLimited") as GuiObject;
const gamepassesContent = container.WaitForChild("Gamepass") as GuiObject;

const giftGui = shop.WaitForChild("GiftGUI") as ImageLabel;
const serverPlayerScroll = giftGui.WaitForChild("FriendplayerScroll") as ScrollingFrame;
const giftPlayerTemplate = serverPlayerScroll.WaitForChild("GiftPlayers") as ImageLabel;
const giftSearchBox = giftGui.WaitForChild("SearchGui").WaitForChild("TextBox") as TextBox;
const giftNameLabel = giftGui.WaitForChild("NameGamepass") as TextLabel;
const giftPriceLabel = giftGui.WaitForChild("PriceGamepass") as TextLabel;
const giftRobuxIcon = giftGui.WaitForChild("ImageLabel") as ImageLabel;
const giftTitle = giftGui.FindFirstChild("Title") as TextLabel | undefined;
giftGui.Visible = false;

// coin offers (Monetization.button) -> coin cards, in order
const COIN_BUTTONS: Record<string, string> = {
	first: "YellowCase",
	second: "YellowCase1",
	third: "YellowCase2",
	fourth: "YellowCase3",
	fifth: "YellowCase4",
};

// gamepass key -> card in Scroll.Gamepass (art matches the old shop)
const GAMEPASS_CARDS: Record<string, string> = {
	SetClown: "YellowCase",
	LimitedBundle: "YellowCase1",
	X2: "YellowCase2",
	Plus: "YellowCase3",
};

// the new design only ships three gamepass cards; Plus gets a copy of the last one
if (gamepassesContent.FindFirstChild("YellowCase3") === undefined) {
	const source = gamepassesContent.FindFirstChild("YellowCase2");
	if (source !== undefined) {
		const plusCard = source.Clone();
		plusCard.Name = "YellowCase3";
		const art = plusCard.FindFirstChild("ImageLabel") as ImageLabel | undefined;
		if (art !== undefined) art.Image = "rbxassetid://109151770079913";
		plusCard.Parent = gamepassesContent;
	}
}

// coins have no gifting
for (const card of productsTab.GetChildren()) {
	const gift = card.FindFirstChild("Gift");
	if (gift !== undefined) (gift as GuiObject).Visible = false;
}

WindowManager.register("Shop", () => (shop.Visible = false));

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const openCase = remotes.WaitForChild("OpenCase") as RemoteEvent;
const caseResult = remotes.WaitForChild("CaseResult") as RemoteEvent;
const gamepassUpdate = remotes.WaitForChild("GamepassUpdate") as RemoteEvent;
const askForGamepasses = remotes.WaitForChild("AskForGamepasses") as RemoteFunction;
const requestGift = remotes.WaitForChild("RequestGift") as RemoteFunction;
const requestLimitedGift = remotes.WaitForChild("RequestLimitedGift") as RemoteFunction;

function systemMessage(text: string) {
	const channels = TextChatService.FindFirstChild("TextChannels");
	const general = channels?.FindFirstChild("RBXGeneral") as TextChannel | undefined;
	general?.DisplaySystemMessage(text);
}

// one open at a time
let requesting = false;

// caseId -> Price label, for cases gated behind a gamepass (see refreshCaseLock)
const gatedCasePriceLabels = new Map<string, TextLabel>();

// wire a case button to its caseId
function wireCase(parent: Instance, name: string, caseId: string) {
	const btn = parent.FindFirstChild(name) as ImageButton | undefined;

	const priceLabel = (btn?.FindFirstChild("Price") ?? btn?.FindFirstChild("TextLabel")) as TextLabel | undefined;
	const caseDef = Cases.get(caseId);
	if (priceLabel !== undefined && caseDef !== undefined) {
		if (caseDef.requiredGamepass !== undefined) {
			priceLabel.Text = `${caseDef.requiredGamepass} Only`;
			gatedCasePriceLabels.set(caseId, priceLabel);
		} else {
			priceLabel.Text = tostring(caseDef.price);
		}
	}

	btn?.Activated.Connect(() => {
		if (requesting || CratePresenter.isBusy()) return;

		if (caseDef?.requiredGamepass !== undefined && !ownedGamepasses.has(caseDef.requiredGamepass)) {
			systemMessage(`You need the ${caseDef.requiredGamepass} gamepass to open ${caseDef.name}.`);
			return;
		}

		requesting = true;
		openCase.FireServer(caseId);
		print(`[Shop] ${player.Name} clicked ${name} → ${caseId}`);

		// failsafe: never leave the buttons dead if the server goes quiet
		task.delay(10, () => (requesting = false));
	});
	// print(`[Shop] Wired ${name} → ${caseId}`);
}

// flips a gated case's Price label from "<Gamepass> Only" to its real price once owned
function refreshCaseLock(caseId: string) {
	const caseDef = Cases.get(caseId);
	const priceLabel = gatedCasePriceLabels.get(caseId);
	if (caseDef === undefined || priceLabel === undefined || caseDef.requiredGamepass === undefined) return;
	priceLabel.Text = ownedGamepasses.has(caseDef.requiredGamepass)
		? tostring(caseDef.price)
		: `${caseDef.requiredGamepass} Only`;
}

wireCase(casesContainer, "GreenCase", "GreenCase");
wireCase(casesContainer, "BlueCase", "BlueCase");
wireCase(casesContainer, "RedCase", "RedCase");
wireCase(casesContainer, "PurpleCase", "PurpleCase");
wireCase(casesContainer2, "YellowCase", "YellowCase");
wireCase(casesContainer2, "PlusCase", "PlusCase");

// Limiteds ----------------------------------------------------------------
// One Developer Product grants a fixed skin set directly (no crate roll).

// the new UI has a single limited card (PacketLimited) for the "Limited" offer
function limitedFrame(offer: LimitedOffer): Instance | undefined {
	if (offer.key === "Limited") return limitedsContent;
	return limitedsContent.FindFirstChild(offer.key);
}

function wireLimited(offer: LimitedOffer) {
	const frame = limitedFrame(offer);
	const buyBtn = frame?.FindFirstChild("Buy") as ImageButton | undefined;
	if (buyBtn === undefined) {
		warn(`[Shop] no Buy button for limited "${offer.key}"`);
		return;
	}

	const label = buyBtn.FindFirstChild("TextLabel") as TextLabel | undefined;
	if (label !== undefined && offer.id !== 0) {
		const [ok, info] = pcall(() => MarketplaceService.GetProductInfo(offer.id, Enum.InfoType.Product));
		const price = ok ? (info as { PriceInRobux?: number }).PriceInRobux : undefined;
		if (price !== undefined) label.Text = `R$${price}`;
	}

	buyBtn.Activated.Connect(() => {
		print(`[Shop] clicked limited ${offer.key} (id ${offer.id})`);
		if (offer.id === 0) {
			systemMessage("This item isn't set up yet — check back later.");
			return;
		}
		MarketplaceService.PromptProductPurchase(player, offer.id);
	});
	// print(`[Shop] Wired limited ${offer.key} → id ${offer.id}`);
}

for (const offer of Limiteds) wireLimited(offer);

function labelOffer(btn: Instance, offer: CoinOffer) {
	const buy = btn.FindFirstChild("Buy");
	const label = (buy?.FindFirstChild("TextLabel") ?? btn.FindFirstChild("Price") ?? btn.FindFirstChild("Title")) as
		TextLabel | undefined;
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
	const btn = parent.FindFirstChild(COIN_BUTTONS[offer.button] ?? offer.button) as ImageButton | undefined;
	if (btn === undefined) {
		warn(`[Shop] no button "${offer.button}" in ${parent.GetFullName()}`);
		return;
	}

	labelOffer(btn, offer);

	const promptOffer = () => {
		print(`[Shop] clicked ${offer.button} (id ${offer.id})`);
		if (offer.id === 0) {
			systemMessage("This offer isn't set up yet — check back later.");
			return;
		}
		MarketplaceService.PromptProductPurchase(player, offer.id);
	};

	btn.Activated.Connect(promptOffer);
	const buy = btn.FindFirstChild("Buy") as ImageButton | undefined;
	buy?.Activated.Connect(promptOffer);
	// print(`[Shop] Wired product ${offer.button} → id ${offer.id}`);
}

function productParent(_offer: CoinOffer): Instance {
	return productsTab;
}

for (const offer of CoinProducts) {
	wireOffer(productParent(offer), offer);
}

// Gamepasses ------------------------------------------------------------

const ownedGamepasses = new Set<string>();

function gamepassFrame(gp: GamepassOffer): Instance | undefined {
	return gamepassesContent.FindFirstChild(GAMEPASS_CARDS[gp.key] ?? gp.key);
}

// the gamepass cards carry their name + price, fill them from the Gamepasses table
for (const gp of Gamepasses) {
	const frame = gamepassFrame(gp);
	if (frame === undefined) continue;

	const title = frame.FindFirstChild("Title") as TextLabel | undefined;
	if (title !== undefined) title.Text = gp.name.upper();

	const buy = frame.FindFirstChild("Buy");
	const priceLabel = buy?.FindFirstChild("TextLabel") as TextLabel | undefined;
	if (priceLabel !== undefined && gp.price !== undefined) priceLabel.Text = `R$${gp.price}`;
}

// Roblox already blocks a duplicate purchase server-side; this is just so the
// button reads "OWNED" instead of prompting a purchase that'll get refused.
function markOwned(key: string) {
	ownedGamepasses.add(key);

	const gp = findGamepassByKey(key);
	if (gp === undefined) return;

	const frame = gamepassFrame(gp);
	const button = frame?.FindFirstChild("Buy") as ImageButton | undefined;
	const label = button?.FindFirstChild("TextLabel") as TextLabel | undefined;
	if (label !== undefined) label.Text = "OWNED";
	if (button !== undefined) button.Active = false;

	// unlock any case that requires this gamepass (e.g. PlusCase -> "Plus")
	for (const [caseId, def] of Cases) {
		if (def.requiredGamepass === key) refreshCaseLock(caseId);
	}
}

function wireGamepass(gp: GamepassOffer) {
	const frame = gamepassFrame(gp);
	const button = frame?.FindFirstChild("Buy") as ImageButton | undefined;
	if (button === undefined) {
		warn(`[Shop] no Buy button in gamepass card "${gp.key}"`);
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
	// print(`[Shop] Wired gamepass ${gp.key} → id ${gp.id}`);
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

// Gifting -----------------------------------------------------------------

interface GiftSession {
	label: string; // for failure/toast messages, e.g. "gamepass" or "bundle"
	name: string; // display name shown in GiftGUI
	price: number; // Robux price shown in GiftGUI
	productId: number; // PromptProductPurchase target once the intent is recorded
	requestIntent: (target: Player) => { ok: boolean; reason?: string } | undefined;
}

let currentGift: GiftSession | undefined;
let pendingGiftProductId: number | undefined; // set right before prompting a gift purchase

function includesSubstring(haystack: string, needle: string): boolean {
	if (needle === "") return true;
	return haystack.lower().find(needle.lower(), 1, true)[0] !== undefined;
}

function avatarThumb(userId: number): string {
	const [ok, url] = pcall(() =>
		Players.GetUserThumbnailAsync(userId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100),
	);
	return ok ? (url as string) : "";
}

function giftFailureMessage(reason: string | undefined, label: string): string {
	if (reason === "SELF") return `You can't gift yourself a ${label}.`;
	if (reason === "ALREADY_OWNS") return `That player already owns this ${label}.`;
	if (reason === "NOT_GIFTABLE") return `This ${label} isn't giftable yet — check back later.`;
	return "Couldn't send that gift right now.";
}

function sendGift(target: Player) {
	const session = currentGift;
	if (session === undefined) return;

	const [ok, result] = pcall(() => session.requestIntent(target));
	if (!ok || result === undefined) {
		systemMessage("Couldn't reach the server — try again.");
		return;
	}
	if (!result.ok) {
		systemMessage(giftFailureMessage(result.reason, session.label));
		return;
	}

	giftGui.Visible = false;
	pendingGiftProductId = session.productId;
	MarketplaceService.PromptProductPurchase(player, session.productId);
}

function renderGiftList(filter: string) {
	for (const child of serverPlayerScroll.GetChildren()) {
		if (child !== giftPlayerTemplate && child.IsA("GuiObject")) child.Destroy();
	}
	giftPlayerTemplate.Visible = false;

	for (const target of Players.GetPlayers()) {
		if (target === player) continue;
		if (!includesSubstring(target.Name, filter) && !includesSubstring(target.DisplayName, filter)) continue;

		const row = giftPlayerTemplate.Clone();
		row.Name = tostring(target.UserId);
		row.Visible = true;
		row.Parent = serverPlayerScroll;

		(row.FindFirstChild("Name") as TextLabel).Text = target.DisplayName;
		(row.FindFirstChild("DisplayName") as TextLabel).Text = `@${target.Name}`;
		(row.FindFirstChild("ImageLabel") as ImageLabel).Image = avatarThumb(target.UserId);

		const giftButton = row.FindFirstChild("ImageButton") as ImageButton;
		giftButton.Activated.Connect(() => sendGift(target));
	}
}

giftSearchBox.GetPropertyChangedSignal("Text").Connect(() => {
	if (currentGift !== undefined) renderGiftList(giftSearchBox.Text);
});

function openGiftGui(session: GiftSession) {
	currentGift = session;
	if (giftTitle !== undefined) giftTitle.Text = `GIFT ${session.label.upper()}`;
	giftNameLabel.Text = session.name.upper();
	giftPriceLabel.Text = `${session.price}`;
	giftRobuxIcon.Visible = true;
	giftSearchBox.Text = "";
	renderGiftList("");
	giftGui.Visible = true;
}

// live Robux price for a dev product, falling back to a known price if the lookup fails
function robuxPrice(productId: number, fallback: number): number {
	const [ok, info] = pcall(() => MarketplaceService.GetProductInfo(productId, Enum.InfoType.Product));
	const price = ok ? (info as { PriceInRobux?: number }).PriceInRobux : undefined;
	return price ?? fallback;
}

// gift price is always 10% off the base price
function giftPrice(basePrice: number): number {
	return math.floor(basePrice * 0.9);
}

function wireGamepassGiftButton(gp: GamepassOffer) {
	const frame = gamepassFrame(gp);
	const giftBtn = frame?.FindFirstChild("Gift") as ImageButton | undefined;
	if (giftBtn === undefined) {
		warn(`[Shop] no Gift button in gamepass frame "${gp.key}"`);
		return;
	}

	giftBtn.Activated.Connect(() => {
		if (gp.giftProductId === undefined || gp.giftProductId === 0) {
			systemMessage("Gifting isn't set up for this gamepass yet — check back later.");
			return;
		}
		openGiftGui({
			label: "gamepass",
			name: gp.name,
			price: giftPrice(gp.price ?? 0),
			productId: gp.giftProductId,
			requestIntent: (target) =>
				requestGift.InvokeServer(target.UserId, gp.key) as { ok: boolean; reason?: string },
		});
	});
}

for (const gp of Gamepasses) wireGamepassGiftButton(gp);

function wireLimitedGiftButton(offer: LimitedOffer) {
	const frame = limitedFrame(offer);
	const giftBtn = frame?.FindFirstChild("Gift") as ImageButton | undefined;
	if (giftBtn === undefined) {
		warn(`[Shop] no Gift button for limited "${offer.key}"`);
		return;
	}

	giftBtn.Activated.Connect(() => {
		if (offer.giftProductId === undefined || offer.giftProductId === 0) {
			systemMessage("Gifting isn't set up for this item yet — check back later.");
			return;
		}
		openGiftGui({
			label: "bundle",
			name: offer.name,
			price: giftPrice(robuxPrice(offer.id, 0)),
			productId: offer.giftProductId,
			requestIntent: (target) =>
				requestLimitedGift.InvokeServer(target.UserId, offer.key) as { ok: boolean; reason?: string },
		});
	});
}

for (const offer of Limiteds) wireLimitedGiftButton(offer);

// buyer-side confirmation once the Robux prompt resolves — only for a gift purchase we
// ourselves just started (pendingGiftProductId), never a plain self-purchase of the same item
MarketplaceService.PromptProductPurchaseFinished.Connect((userId, productId, isPurchased) => {
	if (userId !== player.UserId || productId !== pendingGiftProductId) return;
	pendingGiftProductId = undefined;
	systemMessage(isPurchased ? "Gift sent!" : "Gift purchase cancelled.");
});

// server tells us what we got (or why it failed) as a chat message
caseResult.OnClientEvent.Connect((text: string, payload?: CaseResultPayload) => {
	systemMessage(text);
	requesting = false;

	if (payload?.ok !== true || payload.skinId === undefined) return;

	shop.Visible = false;
	const started = CratePresenter.present(payload.caseId, payload.skinId, payload.rarity, () => {
		shop.Visible = WindowManager.open("Shop");
	});
	if (!started) {
		shop.Visible = WindowManager.open("Shop"); // presenter refused, put the shop back
		systemMessage(`Error: the ${payload.caseId} crate does not exist.`);
	}
});

// type shop in chat to toggle the shop open/closed
player.Chatted.Connect((msg) => {
	if (msg.lower() === "shop") {
		if (shop.Visible) {
			WindowManager.closed("Shop");
			shop.Visible = false;
		} else if (!WindowManager.open("Shop")) {
			systemMessage("Finish or cancel your trade first.");
		} else {
			shop.Visible = true;
		}
	}
});

// Logic for close button
const closeBtn = shop.FindFirstChild("CloseButton") as GuiButton | undefined;
if (closeBtn !== undefined) {
	closeBtn.MouseButton1Click.Connect(() => {
		WindowManager.closed("Shop");
		(closeBtn.Parent as GuiObject).Visible = false;
	});
}

// scroll the shop so a section card sits at the top (positions depend on screen size in the new UI)
function scrollToSection(section: GuiObject) {
	const y = section.AbsolutePosition.Y - container.AbsolutePosition.Y + container.CanvasPosition.Y;
	container.CanvasPosition = new Vector2(0, math.max(0, y));
}

// the coin display doubles as a shop shortcut
const moneyBuyBtn = gui
	.WaitForChild("MainFrame")
	.WaitForChild("MoneyBackground")
	.WaitForChild("BuyButton") as ImageButton;
moneyBuyBtn.Activated.Connect(() => {
	if (!WindowManager.open("Shop")) {
		systemMessage("Finish or cancel your trade first.");
		return;
	}
	shop.Visible = true;
	scrollToSection(tabScrollValues.coins);
	highlightTab(coinsTab);
});

// Menu -> Store button (toggles open/closed on repeated clicks)
const menuShopBtn = gui
	.WaitForChild("MainFrame")
	.WaitForChild("Right")
	.WaitForChild("Fondo")
	.WaitForChild("Store") as ImageButton;
menuShopBtn.Activated.Connect(() => {
	if (shop.Visible) {
		WindowManager.closed("Shop");
		shop.Visible = false;
		return;
	}

	if (!WindowManager.open("Shop")) {
		systemMessage("Finish or cancel your trade first.");
		return;
	}
	shop.Visible = true;
	scrollToSection(tabScrollValues.limiteds);
	highlightTab(limitedsTab);
});

// Opens the shop scrolled to a given tab, respecting the trade block guard.
function openShopTab(scroll: GuiObject, tab: ImageButton) {
	if (shop.Visible) return;
	if (!WindowManager.open("Shop")) {
		systemMessage("Finish or cancel your trade first.");
		return;
	}
	shop.Visible = true;
	scrollToSection(scroll);
	highlightTab(tab);
}

const SHOP_PROMPTS: { [promptName: string]: () => void } = {
	OpenShopPrompt: () => openShopTab(tabScrollValues.cases, casesTab), // ShopProximityPart
	OpenBundlePrompt: () => openShopTab(tabScrollValues.limiteds, limitedsTab), // BundleProximityPart
	OpenGamepassPrompt: () => openShopTab(tabScrollValues.gamepasses, gamepassesTab), // GamepassProximityPart
};

ProximityPromptService.PromptTriggered.Connect((prompt) => {
	SHOP_PROMPTS[prompt.Name]?.();
});

// Logic for tab buttons
const tabs = shop.WaitForChild("ContainerButtons_v1") as Frame;
const casesTab = tabs.WaitForChild("Cases") as ImageButton;
const coinsTab = tabs.WaitForChild("Coins") as ImageButton;
const gamepassesTab = tabs.WaitForChild("Gamepass") as ImageButton;
const limitedsTab = tabs.WaitForChild("Limited") as ImageButton;

const ACTIVE_TAB = "rbxassetid://101263624536319";
const INACTIVE_TAB = "rbxassetid://119379906708598";

let currentTab: ImageButton | undefined = undefined;

function highlightTab(active: ImageButton) {
	if (currentTab === active) return;
	currentTab = active;

	for (const b of tabs.GetChildren()) {
		if (b.IsA("ImageButton")) {
			if (b === active) {
				b.Image = ACTIVE_TAB;
				const title = b.FindFirstChild("TextLabel") as TextLabel;
				title.TextColor3 = new Color3(1, 1, 1);
			} else {
				b.Image = INACTIVE_TAB;
				const title1 = b.FindFirstChild("TextLabel") as TextLabel;
				title1.TextColor3 = new Color3(0.45, 0.45, 0.45);
			}
		}
	}
}

const tabScrollValues = {
	cases,
	coins: productsTab,
	gamepasses: gamepassesContent,
	limiteds: limitedsContent,
};

casesTab.MouseButton1Click.Connect(() => {
	scrollToSection(tabScrollValues.cases);
	highlightTab(casesTab);
});

coinsTab.MouseButton1Click.Connect(() => {
	scrollToSection(tabScrollValues.coins);
	highlightTab(coinsTab);
});

gamepassesTab.MouseButton1Click.Connect(() => {
	scrollToSection(tabScrollValues.gamepasses);
	highlightTab(gamepassesTab);
});

limitedsTab.MouseButton1Click.Connect(() => {
	scrollToSection(tabScrollValues.limiteds);
	highlightTab(limitedsTab);
});

export {};
