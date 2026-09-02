import { Players } from "@rbxts/services";
import { getDef, WeaponSlot } from "shared/Catalog";
import * as WindowManager from "../UI/WindowManager";
import { Store } from "./Store";

const EQUIPPED_IMAGE = "rbxassetid://126931322651156";
const UNEQUIPPED_IMAGE = "rbxassetid://100260658216025";

const ACTIVE_TAB = "rbxassetid://92004645740900";
const INACTIVE_TAB = "rbxassetid://118371499551965";

// reference
const gui = Players.LocalPlayer.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const invGui = gui.WaitForChild("MainFrame").WaitForChild("InventoryGUI") as ImageLabel;
const scroll = invGui.WaitForChild("InventoryScroll") as ScrollingFrame;
const tabs = invGui.WaitForChild("ContainerButtons");

const RARITY_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Exclusive"];
const templates = new Map<string, ImageLabel>();
for (const name of RARITY_NAMES) {
	const t = scroll.FindFirstChild(name) as ImageLabel | undefined;
	if (t !== undefined) {
		t.Visible = false; // keep templates hidden
		templates.set(name, t);
	}
}

// state
let currentSlots: WeaponSlot[] = [WeaponSlot.Rifle]; // active tab slots
let fireEquip: (id: string) => void = () => {}; // set in init()

// redraw grid
function render() {
	// clear old cards keep the rarity templates
	for (const child of scroll.GetChildren()) {
		if (child.IsA("ImageLabel") && !templates.has(child.Name)) child.Destroy();
	}

	for (const [id, count] of Store.owned) {
		const def = getDef(id);
		if (def === undefined) continue;
		if (!currentSlots.includes(def.slot)) continue; // filter by active tab

		// choose the box for this skin's rarity
		const template = templates.get(def.rarity);
		if (template === undefined) continue;

		const card = template.Clone();
		card.Name = id;
		card.Visible = true;
		card.Parent = scroll;

		const icon = card.FindFirstChild("IconWeapon") as ImageLabel;
		const title = card.FindFirstChild("WeaponTitle") as TextLabel;
		const btn = card.FindFirstChild("EquippedButton") as ImageButton;
		const btnText = btn.FindFirstChild("EquippedText") as TextLabel;

		icon.Image = def.image;
		title.Text = count > 1 ? `${def.name} x${count}` : def.name;

		const isEquipped = Store.equipped.get(def.slot) === id;
		btnText.Text = isEquipped ? "EQUIPPED" : "EQUIP";
		btn.Image = isEquipped ? EQUIPPED_IMAGE : UNEQUIPPED_IMAGE;
		btnText.FontFace = new Font("Roboto", Enum.FontWeight.Bold, Enum.FontStyle.Normal);

		btn.Activated.Connect(() => fireEquip(id));
	}
}

// tab switching
const tabButtons: ImageButton[] = [];

function highlightTab(active: ImageButton) {
	for (const b of tabButtons) b.Image = b === active ? ACTIVE_TAB : INACTIVE_TAB;
}

function setTab(slots: WeaponSlot[], button: ImageButton) {
	currentSlots = slots;
	highlightTab(button);
	render();
}

function wireTab(name: string, slots: WeaponSlot[]): ImageButton | undefined {
	const btn = tabs.FindFirstChild(name) as ImageButton | undefined;
	if (btn === undefined) return undefined;
	tabButtons.push(btn);
	btn.Activated.Connect(() => setTab(slots, btn));
	return btn;
}

// wire tabs + subscribe
export function init(requestEquip: (id: string) => void) {
	fireEquip = requestEquip;

	wireTab("KnifeButton", [WeaponSlot.Knife]);
	const rifleBtn = wireTab("RifleButton", [WeaponSlot.Rifle]);
	wireTab("GunButton", [WeaponSlot.Revolver]);
	// OtherButton wire when that slot exists

	if (rifleBtn !== undefined) highlightTab(rifleBtn); // Rifle is the default tab

	Store.subscribe(render); // re-render on every delta
	render(); // first draw
}

// Logic to open/close the inventory GUI
WindowManager.register("Inventory", () => (invGui.Visible = false));

const inventoryBtn = gui.WaitForChild("MainFrame").WaitForChild("Menu").WaitForChild("Inventory") as ImageButton;
inventoryBtn.MouseButton1Click.Connect(() => {
	if (invGui.Visible) {
		WindowManager.closed("Inventory");
		invGui.Visible = false;
	} else {
		WindowManager.open("Inventory");
		invGui.Visible = true;
	}
});

// Logic for close button
const closeBtn = invGui.WaitForChild("CloseButton") as GuiButton;
closeBtn.MouseButton1Click.Connect(() => {
	WindowManager.closed("Inventory");
	(closeBtn.Parent as GuiObject).Visible = false;
});
