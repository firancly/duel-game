import { Players, ReplicatedStorage, TextChatService } from "@rbxts/services";
import { PresenceState } from "shared/Presence";
import { TradePlayerInfo, MAX_OFFER } from "shared/types/Trade";
import { getDef } from "shared/Catalog";
import { Store } from "../Inventory/Store";
import * as WindowManager from "../UI/WindowManager";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("NEW_MAIN_UI");
const mainFrame = gui.WaitForChild("MainFrame");
const menu = mainFrame.WaitForChild("Right").WaitForChild("Fondo");

// player-list window
const tradeGui = mainFrame.WaitForChild("TradeGUI") as ImageLabel;
const allPlayerFrame = tradeGui.WaitForChild("AllPlayerFrame");
const listScroll = allPlayerFrame.WaitForChild("AllplayerScroll") as ScrollingFrame;
const listTemplate = listScroll.WaitForChild("TradePlayers") as ImageLabel;
// the new UI uses the bottom "ACTUALIZANDO..." label as the list status / empty indicator
const emptyIndicator = allPlayerFrame.FindFirstChild("Title") as TextLabel | undefined;
const searchBox = allPlayerFrame.FindFirstChild("TextBox") as TextBox | undefined;

for (const child of listScroll.GetChildren()) {
	if (child !== listTemplate && child.IsA("GuiObject")) child.Destroy();
}
listTemplate.Visible = false;

// trade window (Player1 = you, Player2 = them)
const tradeSecond = mainFrame.WaitForChild("TradeSecondGUI") as ImageLabel;
const youPanel = tradeSecond.WaitForChild("Player1");
const theirPanel = tradeSecond.WaitForChild("Player2");

const offerScroll = youPanel.WaitForChild("Offers").WaitForChild("Scroll") as ScrollingFrame;
const offerTemplate = offerScroll.WaitForChild("Template") as ImageButton;
const theirScroll = theirPanel.WaitForChild("Offers").WaitForChild("Scroll") as ScrollingFrame;
const theirTemplate = theirScroll.WaitForChild("Template") as ImageButton;
const inventoryScroll = youPanel.WaitForChild("Inventory").WaitForChild("Scroll") as ScrollingFrame;
const inventoryTemplate = inventoryScroll.WaitForChild("Template") as ImageButton;

// drop the mockup items / "+" placeholders shipped with the design
for (const s of [offerScroll, theirScroll, inventoryScroll]) {
	for (const child of s.GetChildren()) {
		if (child.IsA("GuiButton") && child.Name !== "Template") child.Destroy();
	}
}
offerTemplate.Visible = false;
theirTemplate.Visible = false;
inventoryTemplate.Visible = false;

const theirChat = theirPanel.FindFirstChild("Chat") as GuiObject | undefined;
if (theirChat !== undefined) theirChat.Visible = false;

// ready state is shown with the isConnected dot on each avatar
const youReadyLabel = youPanel.WaitForChild("LogoPlayer").WaitForChild("isConnected") as GuiObject;
const theirReadyLabel = theirPanel.WaitForChild("LogoPlayer").WaitForChild("isConnected") as GuiObject;

// offer counts go into each offer box title
const offerCount = youPanel.WaitForChild("Offers").WaitForChild("title") as TextLabel;
const theirCount = theirPanel.WaitForChild("Offers").WaitForChild("title") as TextLabel;

const acceptButton = tradeSecond.WaitForChild("AcceptTrade") as ImageButton;
const cancelButton = tradeSecond.WaitForChild("AcceptTrade1") as ImageButton;
const tradeStateLabel = tradeSecond.WaitForChild("TradeTitle1") as TextLabel;

// incoming-request popup (shared with party invites, see the "Kind" attribute)
const notification = mainFrame.WaitForChild("Notification") as Frame;
const notifFondo = notification.WaitForChild("Fondo");
const notifAvatar = notifFondo.WaitForChild("Avatar") as ImageLabel;
const notifText = notifFondo.WaitForChild("InviteText") as TextLabel;
const notifAccept = notifFondo.WaitForChild("Buttons").WaitForChild("Accept") as ImageButton;
const notifDecline = notifFondo.WaitForChild("Buttons").WaitForChild("Deny") as ImageButton;
notification.Visible = false;

// remotes
const remotes = ReplicatedStorage.WaitForChild("Remotes");
const getTradePlayers = remotes.WaitForChild("GetTradePlayers") as RemoteFunction;
const sendTradeRequest = remotes.WaitForChild("SendTradeRequest") as RemoteEvent;
const incomingTradeRequest = remotes.WaitForChild("IncomingTradeRequest") as RemoteEvent;
const tradeStarted = remotes.WaitForChild("TradeStarted") as RemoteEvent;
const updateOffer = remotes.WaitForChild("UpdateOffer") as RemoteEvent;
const offerUpdated = remotes.WaitForChild("OfferUpdated") as RemoteEvent;
const confirmTrade = remotes.WaitForChild("ConfirmTrade") as RemoteEvent;
const cancelTrade = remotes.WaitForChild("CancelTrade") as RemoteEvent;
const tradeConfirmed = remotes.WaitForChild("TradeConfirmed") as RemoteEvent;
const tradeComplete = remotes.WaitForChild("TradeComplete") as RemoteEvent;
const tradeState = remotes.WaitForChild("TradeState") as RemoteEvent;
const respondTradeRequest = remotes.WaitForChild("RespondTradeRequest") as RemoteEvent;

// helpers
function avatar(userId: number): string {
	const [ok, url] = pcall(() =>
		Players.GetUserThumbnailAsync(userId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100),
	);
	return ok ? (url as string) : "";
}

function statusText(state: PresenceState): string {
	return state === PresenceState.Lobby ? "IN LOBBY" : "IN MATCH";
}

const TRADE_AVAILABLE_IMAGE = "rbxassetid://114902166859839";
const TRADE_UNAVAILABLE_IMAGE = "rbxassetid://82739869529740";

// small "xN" badge for stacked items (the new item template has no text label)
function setItemCount(entry: GuiObject, count: number) {
	let badge = entry.FindFirstChild("Count") as TextLabel | undefined;

	if (count <= 1) {
		badge?.Destroy();
		return;
	}

	if (badge === undefined) {
		badge = new Instance("TextLabel");
		badge.Name = "Count";
		badge.AnchorPoint = new Vector2(1, 1);
		badge.Position = UDim2.fromScale(0.95, 0.95);
		badge.Size = UDim2.fromScale(0.5, 0.3);
		badge.BackgroundTransparency = 1;
		badge.Font = Enum.Font.GothamBlack;
		badge.TextScaled = true;
		badge.TextXAlignment = Enum.TextXAlignment.Right;
		badge.TextColor3 = new Color3(1, 1, 1);
		badge.TextStrokeTransparency = 0.3;
		badge.ZIndex = entry.ZIndex + 1;
		badge.Parent = entry;
	}

	badge.Text = `x${count}`;
}

function systemMessage(text: string) {
	const channels = TextChatService.FindFirstChild("TextChannels");
	const general = channels?.FindFirstChild("RBXGeneral") as TextChannel | undefined;
	general?.DisplaySystemMessage(text);
}

function recordFromMap(m: Map<string, number>): { [id: string]: number } {
	const out: { [id: string]: number } = {};
	for (const [k, v] of m) out[k] = v;
	return out;
}

// state
enum Tabs {
	All,
	Friends,
	Server,
}
let currentTab: Tabs = Tabs.All; // active tab

// does this player belong in the active tab?
function passesTab(info: TradePlayerInfo): boolean {
	if (currentTab === Tabs.All) return true;

	// Friends / Server both need the friendship check
	const [ok, isFriend] = pcall(() => player.IsFriendsWithAsync(info.userId as unknown as User));
	if (!ok) return false;

	return currentTab === Tabs.Friends ? (isFriend as boolean) : !(isFriend as boolean);
}

// player list
function matchesSearch(info: TradePlayerInfo): boolean {
	const term = searchBox !== undefined ? searchBox.Text.lower() : "";
	if (term === "") return true;
	return (
		info.displayName.lower().find(term, 1, true)[0] !== undefined ||
		info.name.lower().find(term, 1, true)[0] !== undefined
	);
}

function refreshList() {
	for (const child of listScroll.GetChildren()) {
		if (child !== listTemplate && child.IsA("GuiObject")) child.Destroy();
	}
	listTemplate.Visible = false;

	if (emptyIndicator !== undefined) {
		emptyIndicator.Text = "ACTUALIZANDO...";
		emptyIndicator.Visible = true;
	}

	const players = getTradePlayers.InvokeServer() as TradePlayerInfo[];
	let shown = 0;
	for (const info of players) {
		if (!passesTab(info) || !matchesSearch(info)) continue;
		shown++;

		const row = listTemplate.Clone();
		row.Name = tostring(info.userId);
		row.Visible = true;
		row.Parent = listScroll;

		(row.FindFirstChild("Name") as TextLabel).Text = info.displayName;
		(row.FindFirstChild("DisplayName") as TextLabel).Text = `@${info.name}`;
		(row.FindFirstChild("Status") as TextLabel).Text = statusText(info.state);
		(row.FindFirstChild("PlayerLogo") as ImageLabel).Image = avatar(info.userId);

		const available = info.state === PresenceState.Lobby;
		const tradeBtn = row.FindFirstChild("ImageButton") as ImageButton;
		(tradeBtn.FindFirstChild("Title") as TextLabel).Text = available ? "TRADE" : "NOT AVAILABLE";
		tradeBtn.Image = available ? TRADE_AVAILABLE_IMAGE : TRADE_UNAVAILABLE_IMAGE;
		tradeBtn.Active = available;
		if (available) {
			tradeBtn.Activated.Connect(() => {
				sendTradeRequest.FireServer(info.userId);
				systemMessage(`Trade request sent to ${info.displayName}.`);
			});
		}
	}

	// show the empty indicator when the active tab has nobody
	if (emptyIndicator !== undefined) {
		emptyIndicator.Text = "NO PLAYERS IN GAME";
		emptyIndicator.Visible = shown === 0;
	}
}

if (searchBox !== undefined) {
	searchBox.GetPropertyChangedSignal("Text").Connect(() => {
		if (tradeGui.Visible) refreshList();
	});
}

function setTradeTab(tab: Tabs) {
	currentTab = tab;
	refreshList();
}

WindowManager.register("Trade", () => {
	tradeGui.Visible = false;
	tradeSecond.Visible = false;
	listOpen = false;
});

let listOpen = false;
(menu.WaitForChild("Trades") as ImageButton).Activated.Connect(() => {
	if (!listOpen && WindowManager.isBlocked()) {
		systemMessage("Finish or cancel your trade first.");
		return;
	}

	listOpen = !listOpen;
	if (listOpen) {
		WindowManager.open("Trade");
		refreshList();
	} else {
		WindowManager.closed("Trade");
	}
	tradeGui.Visible = listOpen;
});

// tab buttons (ContainerButtons: "All" = All, "Friends" = Friends, "Server" = Server)
const TAB_ACTIVE = "rbxassetid://114902166859839";
const TAB_INACTIVE = "rbxassetid://79223329675877";

const tradeTabs = tradeGui.WaitForChild("ContainerButtons");
const tabButtons: ImageButton[] = [];

function highlightTradeTab(active: ImageButton) {
	for (const b of tabButtons) b.Image = b === active ? TAB_ACTIVE : TAB_INACTIVE;
}

function wireTradeTab(name: string, tab: Tabs): ImageButton | undefined {
	const btn = tradeTabs.FindFirstChild(name) as ImageButton | undefined;
	if (btn === undefined) return undefined;
	tabButtons.push(btn);
	btn.Activated.Connect(() => {
		setTradeTab(tab);
		highlightTradeTab(btn);
	});
	return btn;
}

const allBtn = wireTradeTab("All", Tabs.All);
wireTradeTab("Friends", Tabs.Friends);
wireTradeTab("Server", Tabs.Server);
if (allBtn !== undefined) highlightTradeTab(allBtn); // All is the default tab

// incoming request opens the notification popup
let requestFrom: number | undefined;

incomingTradeRequest.OnClientEvent.Connect((fromUserId: number, fromName: string) => {
	requestFrom = fromUserId;
	notification.SetAttribute("Kind", "Trade");
	notifText.Text = `${fromName.upper()} WANTS TO TRADE WITH YOU!`;
	notifAvatar.Image = avatar(fromUserId);
	notification.Visible = true;
});

notifAccept.Activated.Connect(() => {
	if (notification.GetAttribute("Kind") !== "Trade") return;
	if (requestFrom !== undefined) respondTradeRequest.FireServer(requestFrom, true);
	notification.Visible = false;
	requestFrom = undefined;
});

notifDecline.Activated.Connect(() => {
	if (notification.GetAttribute("Kind") !== "Trade") return;
	if (requestFrom !== undefined) respondTradeRequest.FireServer(requestFrom, false);
	notification.Visible = false;
	requestFrom = undefined;
});

// your offer
const offer = new Map<string, number>();

function syncOffer() {
	updateOffer.FireServer(recordFromMap(offer));
}

function clearEntries(scroll: ScrollingFrame, keep: Instance) {
	for (const child of scroll.GetChildren()) {
		if (child !== keep && child.IsA("GuiObject")) child.Destroy();
	}
}

function totalCount(m: Map<string, number>): number {
	let n = 0;
	for (const [, c] of m) n += c;
	return n;
}

// your inventory: click a skin to move one copy into the offer
function renderInventory() {
	clearEntries(inventoryScroll, inventoryTemplate);
	for (const [id, owned] of Store.owned) {
		const def = getDef(id);
		if (def === undefined || !def.tradeable) continue;
		const remaining = owned - (offer.get(id) ?? 0);
		if (remaining <= 0) continue; // all copies already offered

		const entry = inventoryTemplate.Clone();
		entry.Name = `inv_${id}`;
		entry.Visible = true;
		entry.Active = true;
		entry.Image = def.image;
		setItemCount(entry, remaining);
		entry.Activated.Connect(() => {
			if (totalCount(offer) >= MAX_OFFER) return; // offer is full
			offer.set(id, (offer.get(id) ?? 0) + 1);
			renderAll();
			syncOffer();
		});
		entry.Parent = inventoryScroll;
	}
}

// your offer: click a skin to take one copy back out
function renderOffer() {
	clearEntries(offerScroll, offerTemplate);
	for (const [id, count] of offer) {
		if (count <= 0) continue;
		const def = getDef(id);
		if (def === undefined) continue;

		const entry = offerTemplate.Clone();
		entry.Name = `entry_${id}`;
		entry.Visible = true;
		entry.Active = true;
		entry.Image = def.image;
		setItemCount(entry, count);
		entry.Activated.Connect(() => {
			const left = count - 1;
			if (left <= 0) offer.delete(id);
			else offer.set(id, left);
			renderAll();
			syncOffer();
		});
		entry.Parent = offerScroll;
	}
	offerCount.Text = `YOUR OFFER (${totalCount(offer)}/${MAX_OFFER})`;
}

function renderAll() {
	renderInventory();
	renderOffer();
}

// their offer (read-only)
function renderTheirOffer(record: { [id: string]: number }) {
	clearEntries(theirScroll, theirTemplate);
	let total = 0;
	for (const [rawId, count] of pairs(record)) {
		const id = tostring(rawId);
		total += count;
		const def = getDef(id);
		if (def === undefined) continue;
		const entry = theirTemplate.Clone();
		entry.Name = `their_${id}`;
		entry.Visible = true;
		entry.Image = def.image;
		setItemCount(entry, count);
		entry.Parent = theirScroll;
	}
	theirCount.Text = `OFFER (${total}/${MAX_OFFER})`;
}
offerUpdated.OnClientEvent.Connect((record: unknown) => renderTheirOffer(record as { [id: string]: number }));

// confirm / cancel / complete
acceptButton.Activated.Connect(() => {
	confirmTrade.FireServer();
	systemMessage("You accepted. Waiting for the other player...");
});

cancelButton.Activated.Connect(() => cancelTrade.FireServer());

const READY_COLOR = Color3.fromRGB(46, 222, 41);
const NOT_READY_COLOR = Color3.fromRGB(204, 23, 23);

// personalized: (youReady, theirReady) from this viewer's side
tradeConfirmed.OnClientEvent.Connect((youReady: boolean, theirReady: boolean) => {
	youReadyLabel.BackgroundColor3 = youReady ? READY_COLOR : NOT_READY_COLOR;
	theirReadyLabel.BackgroundColor3 = theirReady ? READY_COLOR : NOT_READY_COLOR;
});

// server drives the state label: "Waiting" or the 10-to-0 countdown
tradeState.OnClientEvent.Connect((text: string) => (tradeStateLabel.Text = text));

tradeComplete.OnClientEvent.Connect((success: boolean) => {
	WindowManager.setBlocked(false); // free to open other windows again
	WindowManager.closed("Trade");
	tradeSecond.Visible = false;
	offer.clear();
	systemMessage(success ? "Trade complete!" : "Trade cancelled.");
});

// trade started, open the window
function resetOffer() {
	offer.clear();
	renderAll(); // draw inventory + empty offer (updates your Count)
	clearEntries(theirScroll, theirTemplate);
	theirCount.Text = `OFFER (0/${MAX_OFFER})`;
	youReadyLabel.BackgroundColor3 = NOT_READY_COLOR;
	theirReadyLabel.BackgroundColor3 = NOT_READY_COLOR;
	syncOffer(); // clear the other side's view too
}

tradeStarted.OnClientEvent.Connect((otherUserId: number, otherDisplayName: string) => {
	WindowManager.open("Trade"); // covers accepting an invite while the list was never opened
	WindowManager.setBlocked(true); // pinned — no Shop/Inventory until this trade ends
	tradeGui.Visible = false;
	listOpen = false;

	const other = Players.GetPlayerByUserId(otherUserId);
	(youPanel.WaitForChild("DisplayName") as TextLabel).Text = player.DisplayName;
	(youPanel.WaitForChild("Username") as TextLabel).Text = `@${player.Name}`;
	(youPanel.WaitForChild("LogoPlayer") as ImageLabel).Image = avatar(player.UserId);
	(theirPanel.WaitForChild("DisplayName") as TextLabel).Text = otherDisplayName;
	(theirPanel.WaitForChild("Username") as TextLabel).Text = other !== undefined ? `@${other.Name}` : "";
	(theirPanel.WaitForChild("LogoPlayer") as ImageLabel).Image = avatar(otherUserId);

	resetOffer();
	tradeSecond.Visible = true;
});

// Logic for close button
const closeBtn = tradeGui.WaitForChild("CloseButton") as GuiButton;
closeBtn.MouseButton1Click.Connect(() => {
	WindowManager.closed("Trade");
	listOpen = false;
	(closeBtn.Parent as GuiObject).Visible = false;
});
