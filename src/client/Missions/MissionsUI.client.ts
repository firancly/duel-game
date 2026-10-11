import { ReplicatedStorage, TweenService, Workspace } from "@rbxts/services";
import { MissionView } from "shared/types/Missions";
import { trackTagged } from "../UI/Tags";

// Drives the mission UI through CollectionService tags set in Studio, so the layout
// can be moved around without touching this script. Tags used:
//   DailyMissionList      the frame holding the daily mission rows
//   MissionResetTimer     "00:00:00" label counting down to the daily reset
//   MissionProgressCount  "0/5" missions-completed label
//   MissionProgressFill   the progress bar's fill frame
//   PotionsLabel          every label that shows the potion balance

const TAG_DAILY_LIST = "DailyMissionList";
const TAG_RESET_TIMER = "MissionResetTimer";
const TAG_PROGRESS_COUNT = "MissionProgressCount";
const TAG_PROGRESS_FILL = "MissionProgressFill";
const TAG_POTIONS = "PotionsLabel";

const CHECKED_IMAGE = "rbxassetid://91577716565256";
const UNCHECKED_IMAGE = "rbxassetid://110688563767818";
const ROW_COLOR = Color3.fromRGB(20, 20, 20);
const ROW_DONE_COLOR = Color3.fromRGB(5, 22, 0);

const SECONDS_PER_DAY = 86400; // missions reset at 00:00 UTC
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const BAR_TWEEN = new TweenInfo(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const missionsUpdate = remotes.WaitForChild("MissionsUpdate") as RemoteEvent;
const askForMissions = remotes.WaitForChild("AskForMissions") as RemoteFunction;
const potionsUpdate = remotes.WaitForChild("PotionsUpdate") as RemoteEvent;
const askForPotions = remotes.WaitForChild("AskForPotions") as RemoteFunction;

// Latest server data. Newly tagged UI that shows up later is filled from these.
let latestMissions: MissionView[] = [];
let latestPotions = 0;

// The authored rows (template, template1, ...) of a list, in display order.
function getRows(list: GuiObject): Frame[] {
	const rows: Frame[] = [];
	for (const child of list.GetChildren()) {
		if (child.IsA("Frame")) rows.push(child);
	}
	rows.sort((a, b) => a.Name < b.Name);
	return rows;
}

function renderRow(row: Frame, mission: MissionView | undefined) {
	row.Visible = mission !== undefined;
	if (mission === undefined) return;

	const title = row.FindFirstChild("Title") as TextLabel | undefined;
	if (title !== undefined) title.Text = mission.description.upper();

	const count = row.FindFirstChild("Count") as TextLabel | undefined;
	if (count !== undefined) count.Text = `${mission.progress}/${mission.target}`;

	// the checkmark is the only ImageButton in a row (named differently per row in Studio)
	const checkmark = row.FindFirstChildOfClass("ImageButton");
	if (checkmark !== undefined) checkmark.Image = mission.completed ? CHECKED_IMAGE : UNCHECKED_IMAGE;

	row.BackgroundColor3 = mission.completed ? ROW_DONE_COLOR : ROW_COLOR;

	// the reward label is named differently per row in Studio: it's the text label that isn't Title/Count
	for (const child of row.GetChildren()) {
		if (child.IsA("TextLabel") && child.Name !== "Title" && child.Name !== "Count") {
			child.Text = tostring(mission.reward);
		}
	}
}

function renderList(list: GuiObject) {
	getRows(list).forEach((row, i) => renderRow(row, latestMissions[i]));
}

function completedCount(): number {
	return latestMissions.filter((m) => m.completed).size();
}

function renderProgressCount(label: TextLabel) {
	label.Text = `${completedCount()}/${latestMissions.size()}`;
}

function renderProgressFill(fill: Frame) {
	const total = latestMissions.size();
	const fraction = total > 0 ? completedCount() / total : 0;
	TweenService.Create(fill, BAR_TWEEN, { Size: UDim2.fromScale(fraction, 1) }).Play();
}

function renderPotions(label: TextLabel) {
	label.Text = tostring(latestPotions);
}

function secondsUntilReset(): number {
	return SECONDS_PER_DAY - (math.floor(Workspace.GetServerTimeNow()) % SECONDS_PER_DAY);
}

function formatClock(totalSeconds: number): string {
	const hours = math.floor(totalSeconds / SECONDS_PER_HOUR);
	const minutes = math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const seconds = totalSeconds % SECONDS_PER_MINUTE;
	return string.format("%02d:%02d:%02d", hours, minutes, seconds);
}

const dailyLists = trackTagged<GuiObject>(TAG_DAILY_LIST, renderList);
const resetTimers = trackTagged<TextLabel>(TAG_RESET_TIMER);
const progressCounts = trackTagged<TextLabel>(TAG_PROGRESS_COUNT, renderProgressCount);
const progressFills = trackTagged<Frame>(TAG_PROGRESS_FILL, renderProgressFill);
const potionLabels = trackTagged<TextLabel>(TAG_POTIONS, renderPotions);

function renderMissions() {
	for (const list of dailyLists) renderList(list);
	for (const label of progressCounts) renderProgressCount(label);
	for (const fill of progressFills) renderProgressFill(fill);
}

function renderAllPotions() {
	for (const label of potionLabels) renderPotions(label);
}

function setMissions(missions: MissionView[]) {
	latestMissions = missions;
	renderMissions();
}

function setPotions(amount: number) {
	latestPotions = amount;
	renderAllPotions();
}

// Listen first so a push that lands during the initial request isn't lost.
missionsUpdate.OnClientEvent.Connect((missions: MissionView[]) => setMissions(missions));
potionsUpdate.OnClientEvent.Connect((amount: number) => setPotions(amount));

task.spawn(() => setMissions(askForMissions.InvokeServer() as MissionView[]));
task.spawn(() => setPotions(askForPotions.InvokeServer() as number));

task.spawn(() => {
	while (true) {
		const clock = formatClock(secondsUntilReset());
		for (const label of resetTimers) label.Text = clock;
		task.wait(1);
	}
});
