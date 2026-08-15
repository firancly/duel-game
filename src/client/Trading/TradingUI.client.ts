// Trade player-list screen. Rename this file to TradingUI.client.ts so it runs
// as a LocalScript (a plain .ts is a ModuleScript and won't start on its own).
//
// Add a hidden row named "Template" inside TradeGUI.AllPlayerFrame.AllplayerScroll
// with these children (rename to match, or tell the code your names):
//   Avatar      : ImageLabel   (player thumbnail)
//   Name        : TextLabel    (display name)
//   Handle      : TextLabel    (@username)
//   Status      : TextLabel    (EN LOBBY / EN PARTIDA)
//   TradeButton : ImageButton  -> Title : TextLabel   (the red TRADE / grey NO DISPONIBLE)

import { Players, ReplicatedStorage } from "@rbxts/services";
import { PresenceState } from "shared/Presence";
import { TradePlayerInfo } from "shared/types/Trade";

const player = Players.LocalPlayer;
const gui = player.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const mainFrame = gui.WaitForChild("MainFrame");
const menu = gui.WaitForChild("Menu");

const tradeGui = mainFrame.WaitForChild("TradeGUI") as ImageLabel;
const scroll = tradeGui.WaitForChild("AllPlayerFrame").WaitForChild("AllplayerScroll") as ScrollingFrame;
const template = scroll.WaitForChild("Template") as ImageLabel;

// ── remotes ───────────────────────────────────────────────────────
const remotes = ReplicatedStorage.WaitForChild("Remotes");
const getTradePlayers = remotes.WaitForChild("GetTradePlayers") as RemoteFunction;
const sendTradeRequest = remotes.WaitForChild("SendTradeRequest") as RemoteEvent;
const incomingTradeRequest = remotes.WaitForChild("IncomingTradeRequest") as RemoteEvent;

// ── helpers ───────────────────────────────────────────────────────
function avatar(userId: number): string {
	const [ok, url] = pcall(() =>
		Players.GetUserThumbnailAsync(userId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100),
	);
	return ok ? (url as string) : "";
}

function statusText(state: PresenceState): string {
	return state === PresenceState.Lobby ? "EN LOBBY" : "EN PARTIDA";
}

// ── render the list ───────────────────────────────────────────────
function refresh() {
	// clear old rows, keep the template
	for (const child of scroll.GetChildren()) {
		if (child.Name !== "Template" && child.IsA("GuiObject")) child.Destroy();
	}

	const players = getTradePlayers.InvokeServer() as TradePlayerInfo[];
	for (const info of players) {
		const row = template.Clone();
		row.Name = tostring(info.userId);
		row.Visible = true;
		row.Parent = scroll;

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
				print(`sent trade request to ${info.displayName}`);
			});
		}
	}
}

// ── open/close the screen from the menu ─────────────────────────────
let tradeGuiVisible = false;
(menu.WaitForChild("Trade") as ImageButton).Activated.Connect(() => {
	tradeGuiVisible = !tradeGuiVisible;
	tradeGui.Visible = tradeGuiVisible;
	if (tradeGuiVisible) refresh(); // only re-fetch the player list on open
});

// ── someone wants to trade with us (the "another gui") ────────────
incomingTradeRequest.OnClientEvent.Connect((fromUserId: number, fromName: string) => {
	// NEXT PHASE: show an accept/decline popup with their name + avatar,
	// then RespondTradeRequest → open TradeSecondGUI.
	print(`[Trade] ${fromName} (id ${fromUserId}) wants to trade`);
});

export {};
