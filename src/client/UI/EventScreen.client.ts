import { TweenService } from "@rbxts/services";
import { trackTagged } from "./Tags";

// Tab switching and button hover effects for the event screen, driven by tags set in
// Studio instead of hard-coded paths:
//   EventScreen  the ScreenGui root. Every button inside it gets the hover effect.
//   EventTab     a button that switches page when pressed.
//   EventPage    a page frame; exactly one is visible at a time.
//   EventOpen    a button, anywhere in the UI, that shows the window panel ("Fondo").
//   EventClose   a button that hides that panel again.
// A tab and a page are paired by their name ("Home" tab -> "Home" page), or by a
// string "Page" attribute on either one when the name can't match.

const TAG_SCREEN = "EventScreen";
const TAG_TAB = "EventTab";
const TAG_PAGE = "EventPage";
const TAG_CLOSE = "EventClose";
const TAG_OPEN = "EventOpen";
const PANEL_NAME = "Fondo"; // the window panel directly under the tagged ScreenGui
const PAGE_ATTRIBUTE = "Page";
const DEFAULT_PAGE = "Home";
const DIAGNOSTIC_DELAY = 5; // seconds after start before missing tags are reported

const HOVER_TWEEN = new TweenInfo(0.5, Enum.EasingStyle.Quint, Enum.EasingDirection.Out);
const HOVER_STROKE_COLOR = Color3.fromRGB(255, 255, 255);
const HOVER_SCALE = 1.1;

let currentPage = DEFAULT_PAGE;

function pageIdOf(instance: Instance): string {
	const attribute = instance.GetAttribute(PAGE_ATTRIBUTE);
	return typeIs(attribute, "string") ? attribute : instance.Name;
}

// Pages that show up later (UI cloned in after this script ran) still land on the right state.
const pages = trackTagged<GuiObject>(TAG_PAGE, (page) => {
	page.Visible = pageIdOf(page) === currentPage;
});

function switchPage(id: string) {
	if (id === currentPage) return;
	if (!pages.some((page) => pageIdOf(page) === id)) {
		warn(`[EventScreen] no "${TAG_PAGE}" page named "${id}" - tag it, or set a "${PAGE_ATTRIBUTE}" attribute`);
		return;
	}

	currentPage = id;
	for (const page of pages) page.Visible = pageIdOf(page) === id;
}

// A destroyed-and-restored instance fires "added" again; never bind the same one twice.
const boundTabs = new Set<GuiButton>();
const tabs = trackTagged<GuiButton>(TAG_TAB, (tab) => {
	if (boundTabs.has(tab)) return;
	boundTabs.add(tab);
	tab.Activated.Connect(() => switchPage(pageIdOf(tab)));
});

const hoverButtons = new Set<GuiButton>();

function setupHover(button: GuiButton) {
	if (hoverButtons.has(button)) return;
	hoverButtons.add(button);

	const stroke = button.FindFirstChildWhichIsA("UIStroke");
	const originalColor = stroke?.Color;

	let scale = button.FindFirstChildWhichIsA("UIScale");
	if (scale === undefined) {
		scale = new Instance("UIScale");
		scale.Scale = 1;
		scale.Parent = button;
	}
	const uiScale = scale;

	button.MouseEnter.Connect(() => {
		if (stroke !== undefined) TweenService.Create(stroke, HOVER_TWEEN, { Color: HOVER_STROKE_COLOR }).Play();
		TweenService.Create(uiScale, HOVER_TWEEN, { Scale: HOVER_SCALE }).Play();
	});

	button.MouseLeave.Connect(() => {
		if (stroke !== undefined && originalColor !== undefined) {
			TweenService.Create(stroke, HOVER_TWEEN, { Color: originalColor }).Play();
		}
		TweenService.Create(uiScale, HOVER_TWEEN, { Scale: 1 }).Play();
	});
}

const screens = trackTagged<ScreenGui>(TAG_SCREEN, (screen) => {
	for (const descendant of screen.GetDescendants()) {
		if (descendant.IsA("GuiButton")) setupHover(descendant);
	}

	screen.DescendantAdded.Connect((descendant) => {
		if (descendant.IsA("GuiButton")) setupHover(descendant);
	});
});

// Opening and closing show and hide the window panel inside each tagged screen, not the
// ScreenGui itself, so anything else living in that ScreenGui stays up.
function setWindowVisible(visible: boolean) {
	for (const screen of screens) {
		const panel = screen.FindFirstChild(PANEL_NAME);
		if (panel === undefined || !panel.IsA("GuiObject")) {
			warn(`[EventScreen] ${screen.GetFullName()} has no "${PANEL_NAME}" panel to ${visible ? "open" : "close"}`);
			continue;
		}

		if (visible) screen.Enabled = true; // the panel can't show inside a disabled ScreenGui
		panel.Visible = visible;
	}
}

const boundWindowButtons = new Set<GuiButton>();
function bindWindowButton(button: GuiButton, visible: boolean) {
	if (boundWindowButtons.has(button)) return;
	boundWindowButtons.add(button);
	button.Activated.Connect(() => setWindowVisible(visible));
}

const openers = trackTagged<GuiButton>(TAG_OPEN, (opener) => bindWindowButton(opener, true));
const closers = trackTagged<GuiButton>(TAG_CLOSE, (closer) => bindWindowButton(closer, false));

// Tags fail silently, so say so when one of them matched nothing.
task.delay(DIAGNOSTIC_DELAY, () => {
	if (openers.size() === 0) warn(`[EventScreen] nothing tagged "${TAG_OPEN}" in PlayerGui - no way to open it`);
	if (screens.size() === 0) warn(`[EventScreen] nothing tagged "${TAG_SCREEN}" in PlayerGui - no hover effects`);
	if (tabs.size() === 0) warn(`[EventScreen] nothing tagged "${TAG_TAB}" in PlayerGui - tabs can't switch`);
	if (closers.size() === 0) warn(`[EventScreen] nothing tagged "${TAG_CLOSE}" in PlayerGui - no close button`);
	if (pages.size() === 0) warn(`[EventScreen] nothing tagged "${TAG_PAGE}" in PlayerGui - no pages to show`);
});
