import { Players, ReplicatedStorage } from "@rbxts/services";
import { MAX_PARTY_SIZE } from "shared/Party";
import { onTaggedButton, trackTagged } from "../UI/Tags";
import * as WindowManager from "../UI/WindowManager";

// Every piece is picked up at its authored path under NEW_MAIN_UI.MainFrame. tagging is unecessary
//   PartyPanel         the Party frame that opens and closes
//   PartyOpen          the button that toggles it
//   PartySlots         the PartyPlayers frame holding the member slot buttons
//   PartyInviteList    the FriendplayerScroll listing the players you can invite
//   PartyLeave         the Disband button
//   PartyInviteAccept / PartyInviteDecline   the Notification popup's two buttons
//
// An incoming invite uses the shared Notification popup, marked Kind = "Party" so the
// trade request code sharing that popup leaves it alone (and this leaves trade's alone).

const TAG_PANEL = "PartyPanel";
const TAG_OPEN = "PartyOpen";
const TAG_SLOTS = "PartySlots";
const TAG_INVITE_LIST = "PartyInviteList";
const TAG_LEAVE = "PartyLeave";
const TAG_INVITE_ACCEPT = "PartyInviteAccept";
const TAG_INVITE_DECLINE = "PartyInviteDecline";

const ROW_TEMPLATE_NAME = "GiftPlayers"; // the authored row in the invite list that gets cloned
const SLOT_AVATAR_NAME = "Avatar";
const DEFAULT_THUMBNAIL = "rbxasset://textures/ui/GuiImagePlaceholder.png";
const POPUP_KIND = "Party";
const INVITE_COOLDOWN = 10; // seconds a row shows SENT before it can be pressed again
const DIAGNOSTIC_DELAY = 5; // seconds after start before missing pieces are reported

const player = Players.LocalPlayer;
const mainFrame = player.WaitForChild("PlayerGui").WaitForChild("NEW_MAIN_UI").WaitForChild("MainFrame");

// where the old script found each piece
const authoredPanel = mainFrame.FindFirstChild("Party");
const authoredInvite = authoredPanel?.FindFirstChild("PartyInvite");
const authoredOpenButton = mainFrame.FindFirstChild("Right")?.FindFirstChild("Fondo")?.FindFirstChild("Party");

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const partyUpdated = remotes.WaitForChild("PartyUpdated") as RemoteEvent;
const partyInvited = remotes.WaitForChild("PartyInvited") as RemoteEvent;
const inviteRequest = remotes.WaitForChild("PartyInviteRequest") as RemoteEvent;
const inviteResponse = remotes.WaitForChild("PartyInviteResponse") as RemoteEvent;
const leaveRequest = remotes.WaitForChild("PartyLeaveRequest") as RemoteEvent;

// The party as the server last sent it, leader first. Empty while not in one.
let members: Player[] = [];
let panelOpen = false;
// target -> os.clock() of the last invite sent to them
const invitedAt = new Map<Player, number>();
const thumbnails = new Map<number, string>();

function isInParty(): boolean {
	return members.size() > 1;
}

function isLeader(): boolean {
	return members[0] === player;
}

// Anyone on their own can start a party by inviting; inside one, only the leader can.
function canInvite(): boolean {
	return !isInParty() || isLeader();
}

// Shows the placeholder straight away and swaps in the headshot once it has loaded
function loadAvatar(image: ImageLabel, userId: number) {
	image.SetAttribute("UserId", userId);

	const cached = thumbnails.get(userId);
	if (cached !== undefined) {
		image.Image = cached;
		return;
	}

	image.Image = DEFAULT_THUMBNAIL;
	task.spawn(() => {
		const [ok, url] = pcall(() =>
			Players.GetUserThumbnailAsync(userId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size100x100),
		);
		if (!ok) return;

		thumbnails.set(userId, url as string);
		if (image.Parent !== undefined && image.GetAttribute("UserId") === userId) image.Image = url as string;
	});
}

// member slots

// BackGround, BackGround1, BackGround2, ... in that order.
function slotOrder(slot: Instance): number {
	const [digits] = slot.Name.match("%d+$");
	return tonumber(digits) ?? 0;
}

function slotsOf(container: Instance): GuiButton[] {
	const slots: GuiButton[] = [];
	for (const child of container.GetChildren()) {
		if (child.IsA("GuiButton")) slots.push(child);
	}
	slots.sort((a, b) => slotOrder(a) < slotOrder(b));
	return slots;
}

function createSlotAvatar(slot: GuiButton): ImageLabel {
	const avatar = new Instance("ImageLabel");
	avatar.Name = SLOT_AVATAR_NAME;
	avatar.AnchorPoint = new Vector2(0.5, 0.5);
	avatar.Position = UDim2.fromScale(0.5, 0.5);
	avatar.Size = UDim2.fromScale(0.8, 0.8);
	avatar.BackgroundTransparency = 1;
	avatar.ZIndex = slot.ZIndex + 1;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(1, 0);
	corner.Parent = avatar;

	avatar.Parent = slot;
	return avatar;
}

// A filled slot shows the member's headshot an empty one shows its authored "+" label.
function renderSlot(slot: GuiButton, member: Player | undefined) {
	const plus = slot.FindFirstChild("TextLabel");
	if (plus !== undefined && plus.IsA("GuiObject")) plus.Visible = member === undefined;

	const existing = slot.FindFirstChild(SLOT_AVATAR_NAME);
	if (member === undefined) {
		existing?.Destroy();
		return;
	}

	const avatar = existing !== undefined && existing.IsA("ImageLabel") ? existing : createSlotAvatar(slot);
	loadAvatar(avatar, member.UserId);
}

const boundSlots = new Set<GuiButton>();

function renderSlots(container: Instance) {
	const shown = isInParty() ? members : [player];
	slotsOf(container).forEach((slot, i) => {
		// pressing any slot refreshes the invite list
		if (!boundSlots.has(slot)) {
			boundSlots.add(slot);
			slot.Activated.Connect(() => renderLists());
		}
		renderSlot(slot, shown[i]);
	});
}

// invite list

const rowTemplates = new Map<Instance, GuiObject>();

// Keeps the authored row as the template and drops the other mockup rows.
function prepareList(list: Instance): GuiObject | undefined {
	const known = rowTemplates.get(list);
	if (known !== undefined) return known;

	const template = list.FindFirstChild(ROW_TEMPLATE_NAME);
	if (template === undefined || !template.IsA("GuiObject")) {
		warn(`[Party] ${list.GetFullName()} has no "${ROW_TEMPLATE_NAME}" row to clone`);
		return undefined;
	}

	for (const child of list.GetChildren()) {
		if (child.IsA("GuiObject") && child !== template) child.Destroy();
	}
	template.Visible = false;
	rowTemplates.set(list, template);
	return template;
}

function inviteState(target: Player): { text: string; enabled: boolean } {
	if (!canInvite()) return { text: "LEADER ONLY", enabled: false };
	if (members.size() >= MAX_PARTY_SIZE) return { text: "FULL", enabled: false };

	const sentAt = invitedAt.get(target);
	if (sentAt !== undefined && os.clock() - sentAt < INVITE_COOLDOWN) return { text: "SENT", enabled: false };
	return { text: "INVITE", enabled: true };
}

function fillRow(row: GuiObject, target: Player) {
	// in this UI the "Name" label carries the display name and "DisplayName" the @handle
	const nameLabel = row.FindFirstChild("Name");
	if (nameLabel !== undefined && nameLabel.IsA("TextLabel")) nameLabel.Text = target.DisplayName;

	const handleLabel = row.FindFirstChild("DisplayName");
	if (handleLabel !== undefined && handleLabel.IsA("TextLabel")) handleLabel.Text = `@${target.Name}`;

	const avatar = row.FindFirstChild("ImageLabel");
	if (avatar !== undefined && avatar.IsA("ImageLabel")) loadAvatar(avatar, target.UserId);

	const invite = row.FindFirstChild("Invite");
	if (invite === undefined || !invite.IsA("GuiButton")) return;

	const state = inviteState(target);
	const title = invite.FindFirstChild("Title");
	if (title !== undefined && title.IsA("TextLabel")) title.Text = state.text;
	invite.Active = state.enabled;
	if (!state.enabled) return;

	invite.Activated.Connect(() => {
		inviteRequest.FireServer(target);
		invitedAt.set(target, os.clock());
		renderLists();
		task.delay(INVITE_COOLDOWN, renderLists); // let the row be pressed again
	});
}

function renderList(list: Instance) {
	const template = prepareList(list);
	if (template === undefined) return;

	for (const child of list.GetChildren()) {
		if (child.IsA("GuiObject") && child !== template) child.Destroy();
	}
	if (!panelOpen) return; // rows are rebuilt when the window opens

	for (const other of Players.GetPlayers()) {
		if (other === player || members.includes(other)) continue;

		const row = template.Clone();
		row.Name = tostring(other.UserId);
		row.Visible = true;
		fillRow(row, other);
		row.Parent = list;
	}
}

// leave / disband

function renderLeaveButton(button: GuiButton) {
	button.Visible = isInParty();

	const title = button.FindFirstChild("Title");
	if (title !== undefined && title.IsA("TextLabel")) {
		title.Text = isLeader() ? "DISBAND THE PARTY" : "LEAVE THE PARTY";
	}
}

// the pieces, by tag or at their authored path

const panels = trackTagged<GuiObject>(TAG_PANEL, (panel) => (panel.Visible = panelOpen), authoredPanel);
const slotFrames = trackTagged<Instance>(TAG_SLOTS, renderSlots, authoredPanel?.FindFirstChild("PartyPlayers"));
const inviteLists = trackTagged<Instance>(
	TAG_INVITE_LIST,
	renderList,
	authoredInvite?.FindFirstChild("FriendplayerScroll"),
);
const leaveButtons = onTaggedButton(
	TAG_LEAVE,
	() => {
		if (isInParty()) leaveRequest.FireServer();
	},
	authoredInvite?.FindFirstChild("Disband"),
);

function renderLists() {
	for (const list of inviteLists) renderList(list);
}

function renderAll() {
	for (const frame of slotFrames) renderSlots(frame);
	for (const button of leaveButtons) renderLeaveButton(button);
	renderLists();
}

// opening and closing

function setPanelOpen(open: boolean) {
	panelOpen = open;
	for (const panel of panels) panel.Visible = open;
	renderAll();
}

WindowManager.register("Party", () => setPanelOpen(false));

const openButtons = onTaggedButton(
	TAG_OPEN,
	() => {
		if (panelOpen) {
			WindowManager.closed("Party");
			setPanelOpen(false);
			return;
		}
		if (!WindowManager.open("Party")) return; // pinned in a trade
		setPanelOpen(true);
	},
	authoredOpenButton,
);

// server updates

partyUpdated.OnClientEvent.Connect((list: unknown) => {
	const received: Player[] = [];
	if (typeIs(list, "table")) {
		for (const entry of list as unknown[]) {
			if (typeIs(entry, "Instance") && entry.IsA("Player")) received.push(entry);
		}
	}
	// a list we are not on means we are no longer in that party
	members = received.includes(player) ? received : [];
	renderAll();
});

// the invite list shows everyone in the server, so it follows joins and leaves
Players.PlayerAdded.Connect(() => renderLists());
Players.PlayerRemoving.Connect((leaving) => {
	invitedAt.delete(leaving);
	thumbnails.delete(leaving.UserId);
	task.defer(renderLists); // after they are out of Players:GetPlayers()
});

renderAll();

// Tags and paths both fail silently, so say so when a piece was found by neither.
task.delay(DIAGNOSTIC_DELAY, () => {
	const missing = (what: string, tag: string) => warn(`[Party] no ${what} found - tag one "${tag}"`);
	if (panels.size() === 0) missing("party panel", TAG_PANEL);
	if (openButtons.size() === 0) missing("button to open the party panel", TAG_OPEN);
	if (slotFrames.size() === 0) missing("member slots frame", TAG_SLOTS);
	if (inviteLists.size() === 0) missing("invite list", TAG_INVITE_LIST);
});

// incoming invite popup. Kept last: the waits below must not hold up the window above.

const popup = mainFrame.WaitForChild("Notification") as GuiObject;
const popupFondo = popup.WaitForChild("Fondo");
const popupText = popupFondo.WaitForChild("InviteText") as TextLabel;
const popupAvatar = popupFondo.WaitForChild("Avatar") as ImageLabel;
const popupButtons = popupFondo.FindFirstChild("Buttons");

let inviteFrom: Player | undefined;

function answerInvite(accept: boolean) {
	if (popup.GetAttribute("Kind") !== POPUP_KIND) return; // the popup is showing something else
	if (inviteFrom !== undefined) inviteResponse.FireServer(inviteFrom, accept);
	inviteFrom = undefined;
	popup.Visible = false;
}

onTaggedButton(TAG_INVITE_ACCEPT, () => answerInvite(true), popupButtons?.FindFirstChild("Accept"));
onTaggedButton(TAG_INVITE_DECLINE, () => answerInvite(false), popupButtons?.FindFirstChild("Deny"));

partyInvited.OnClientEvent.Connect((inviter: unknown) => {
	if (!typeIs(inviter, "Instance") || !inviter.IsA("Player")) return;

	inviteFrom = inviter;
	popup.SetAttribute("Kind", POPUP_KIND);
	popupText.Text = `${inviter.DisplayName.upper()} HAS INVITED YOU TO JOIN THEIR PARTY!`;
	loadAvatar(popupAvatar, inviter.UserId);
	popup.Visible = true;
});
