import { Players, ReplicatedStorage, TextChatService } from "@rbxts/services";
import { PresenceState } from "shared/Presence";
import { TradePlayerInfo, MAX_OFFER } from "shared/types/Trade";
import { getDef } from "shared/Catalog";
import { Store } from "../Inventory/Store";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const mainFrame = gui.WaitForChild("MainFrame");
const menu = mainFrame.WaitForChild("Menu");

// player-list window
const tradeGui = mainFrame.WaitForChild("TradeGUI") as ImageLabel;
const listScroll = tradeGui.WaitForChild("AllPlayerFrame").WaitForChild("AllplayerScroll") as ScrollingFrame;
const listTemplate = listScroll.WaitForChild("Template") as ImageLabel;
const emptyIndicator = tradeGui.WaitForChild("AllPlayerFrame").WaitForChild("Empty", 5) as TextLabel | undefined;

// trade window
const tradeSecond = mainFrame.WaitForChild("TradeSecondGUI") as ImageLabel;
const upParts = tradeSecond.WaitForChild("UpParts");
const offerScroll = tradeSecond.WaitForChild("BackgroundOffer").WaitForChild("ScrollingFrame") as ScrollingFrame;
const offerTemplate = offerScroll.WaitForChild("ImageLabel") as ImageButton;
const theirScroll = tradeSecond.WaitForChild("BackgroundTheirOffer").WaitForChild("ScrollingFrame") as ScrollingFrame;
const theirTemplate = theirScroll.WaitForChild("ImageLabel") as ImageButton;
const inventoryScroll = tradeSecond.WaitForChild("YouInventory").WaitForChild("ScrollingFrame") as ScrollingFrame;
const inventoryTemplate = inventoryScroll.WaitForChild("ImageLabel") as ImageButton;
const offerCount = tradeSecond.WaitForChild("BackgroundOffer").WaitForChild("Count") as TextLabel;
const theirCount = tradeSecond.WaitForChild("BackgroundTheirOffer").WaitForChild("Count") as TextLabel;
const acceptButton = tradeSecond.WaitForChild("AcceptTrade") as ImageButton;
const cancelButton = tradeSecond.WaitForChild("CancelTrade") as ImageButton;
const tradeStateLabel = tradeSecond.WaitForChild("TradeState") as TextLabel;

// incoming-request popup (under MainFrame)
const notification = mainFrame.WaitForChild("Notification") as Frame;
const notifAvatar = notification.WaitForChild("AvatarBackground").WaitForChild("Avatar") as ImageLabel;
const notifText = notification.WaitForChild("Text") as TextLabel;
const notifAccept = notification.WaitForChild("Accept") as ImageButton;
const notifDecline = notification.WaitForChild("Decline") as ImageButton;
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
	return state === PresenceState.Lobby ? "EN LOBBY" : "EN PARTIDA";
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
function refreshList() {
	for (const child of listScroll.GetChildren()) {
		if (child.Name !== "Template" && child.IsA("GuiObject")) child.Destroy();
	}
	listTemplate.Visible = false;

	const players = getTradePlayers.InvokeServer() as TradePlayerInfo[];
	let shown = 0;
	for (const info of players) {
		if (!passesTab(info)) continue;
		shown++;

		const row = listTemplate.Clone();
		row.Name = tostring(info.userId);
		row.Visible = true;
		row.Parent = listScroll;

		(row.FindFirstChild("Name") as TextLabel).Text = info.displayName;
		(row.FindFirstChild("Handle") as TextLabel).Text = `@${info.name}`;
		(row.FindFirstChild("Status") as TextLabel).Text = statusText(info.state);
		(row.FindFirstChild("Avatar") as ImageLabel).Image = avatar(info.userId);

		const available = info.state === PresenceState.Lobby;
		const tradeBtn = row.FindFirstChild("TradeButton") as ImageButton;
		(tradeBtn.FindFirstChild("Title") as TextLabel).Text = available ? "TRADE" : "NO DISPONIBLE";
		tradeBtn.Active = available;
		if (available) {
			tradeBtn.Activated.Connect(() => {
				sendTradeRequest.FireServer(info.userId);
				systemMessage(`Trade request sent to ${info.displayName}.`);
			});
		}
	}

	// show the empty indicator when the active tab has nobody
	if (emptyIndicator !== undefined) emptyIndicator.Visible = shown === 0;
}

function setTradeTab(tab: Tabs) {
	currentTab = tab;
	refreshList();
}

let listOpen = false;
(menu.WaitForChild("Trades") as ImageButton).Activated.Connect(() => {
	listOpen = !listOpen;
	tradeGui.Visible = listOpen;
	if (listOpen) refreshList();
});

// tab buttons (ContainerButtons: "AllButton" = All, FriendButton = Friends, ServerButton = Server)
const TAB_ACTIVE = "rbxassetid://92004645740900";
const TAB_INACTIVE = "rbxassetid://118371499551965";

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

const allBtn = wireTradeTab("AllButton", Tabs.All);
wireTradeTab("FriendButton", Tabs.Friends);
wireTradeTab("ServerButton", Tabs.Server);
if (allBtn !== undefined) highlightTradeTab(allBtn); // All is the default tab

// incoming request opens the notification popup
let requestFrom: number | undefined;

incomingTradeRequest.OnClientEvent.Connect((fromUserId: number, fromName: string) => {
	requestFrom = fromUserId;
	notifText.Text = `${fromName} wants to trade`;
	notifAvatar.Image = avatar(fromUserId);
	notification.Visible = true;
});

notifAccept.Activated.Connect(() => {
	if (requestFrom !== undefined) respondTradeRequest.FireServer(requestFrom, true);
	notification.Visible = false;
	requestFrom = undefined;
});

notifDecline.Activated.Connect(() => {
	if (requestFrom !== undefined) respondTradeRequest.FireServer(requestFrom, false);
	notification.Visible = false;
	requestFrom = undefined;
});

// your offer
// The offer scroll shows your tradeable skins. Click one to cycle how many
// copies you're offering: 0, 1, 2, ... up to owned, then back to 0. (No + button in this layout.)
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
		(entry.FindFirstChild("TextLabel") as TextLabel).Text = remaining > 1 ? `${def.name} x${remaining}` : def.name;
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
		(entry.FindFirstChild("TextLabel") as TextLabel).Text = count > 1 ? `${def.name} x${count}` : def.name;
		entry.Activated.Connect(() => {
			const left = count - 1;
			if (left <= 0) offer.delete(id);
			else offer.set(id, left);
			renderAll();
			syncOffer();
		});
		entry.Parent = offerScroll;
	}
	offerCount.Text = `${totalCount(offer)}/${MAX_OFFER}`;
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
		(entry.FindFirstChild("TextLabel") as TextLabel).Text = count > 1 ? `${def.name} x${count}` : def.name;
		entry.Parent = theirScroll;
	}
	theirCount.Text = `${total}/${MAX_OFFER}`;
}
offerUpdated.OnClientEvent.Connect((record: unknown) => renderTheirOffer(record as { [id: string]: number }));

// confirm / cancel / complete
acceptButton.Activated.Connect(() => {
	confirmTrade.FireServer();
	systemMessage("You accepted. Waiting for the other player...");
});

cancelButton.Activated.Connect(() => cancelTrade.FireServer());

tradeConfirmed.OnClientEvent.Connect(() => systemMessage("The other player accepted the trade."));

// server drives the state label: "Waiting" or the 10-to-0 countdown
tradeState.OnClientEvent.Connect((text: string) => (tradeStateLabel.Text = text));

tradeComplete.OnClientEvent.Connect((success: boolean) => {
	tradeSecond.Visible = false;
	offer.clear();
	systemMessage(success ? "Trade complete!" : "Trade cancelled.");
});

// trade started, open the window
function resetOffer() {
	offer.clear();
	renderAll(); // draw inventory + empty offer (updates your Count)
	clearEntries(theirScroll, theirTemplate);
	theirCount.Text = `0/${MAX_OFFER}`;
	syncOffer(); // clear the other side's view too
}

tradeStarted.OnClientEvent.Connect((otherUserId: number, otherDisplayName: string) => {
	tradeGui.Visible = false;
	listOpen = false;

	const other = Players.GetPlayerByUserId(otherUserId);
	(upParts.WaitForChild("DisplayName") as TextLabel).Text = player.DisplayName;
	(upParts.WaitForChild("Name") as TextLabel).Text = `@${player.Name}`;
	(upParts.WaitForChild("YouIcon") as ImageLabel).Image = avatar(player.UserId);
	(upParts.WaitForChild("DisplayName2") as TextLabel).Text = otherDisplayName;
	(upParts.WaitForChild("Name2") as TextLabel).Text = other ? `@${other.Name}` : "";
	(upParts.WaitForChild("TheirIcon") as ImageLabel).Image = avatar(otherUserId);

	resetOffer();
	tradeSecond.Visible = true;
});

export {};

// Logic for close button
const closeBtn = tradeGui.WaitForChild("CloseButton") as GuiButton;
closeBtn.MouseButton1Click.Connect(() => {
	(closeBtn.Parent as GuiObject).Visible = false;
});
