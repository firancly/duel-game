import { Players } from "@rbxts/services";
import { getDef, WeaponSlot } from "shared/Catalog";
import { Store } from "./Store";

// reference
const gui = Players.LocalPlayer.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const invGui = gui.WaitForChild("MainFrame").WaitForChild("InventoryGUI");
const scroll = invGui.WaitForChild("InventoryScroll") as ScrollingFrame;
const template = scroll.WaitForChild("Template") as ImageLabel;
const tabs = invGui.WaitForChild("ContainerButtons");

// state
let currentSlots: WeaponSlot[] = [WeaponSlot.Rifle]; // active tab's slots
let fireEquip: (id: string) => void = () => {}; // set in init()

// redraw grid
function render() {
	// clear old cards (keep the hidden template)
	for (const child of scroll.GetChildren()) {
		if (child.IsA("ImageLabel") && child.Name !== "Template") child.Destroy();
	}

	for (const [id, count] of Store.owned) {
		const def = getDef(id);
		if (def === undefined) continue;
		if (!currentSlots.includes(def.slot)) continue; // filter by active tab

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

		btn.Activated.Connect(() => fireEquip(id));
	}
}

// tab switching
function setTab(slots: WeaponSlot[]) {
	currentSlots = slots;
	render();
}

// init: wire tabs + subscribe
export function init(requestEquip: (id: string) => void) {
	fireEquip = requestEquip;

	(tabs.WaitForChild("RifleButton") as ImageButton).Activated.Connect(() => setTab([WeaponSlot.Rifle]));
	(tabs.WaitForChild("KnifeButton") as ImageButton).Activated.Connect(() => setTab([WeaponSlot.Knife]));
	(tabs.WaitForChild("GunButton") as ImageButton).Activated.Connect(() => setTab([WeaponSlot.Revolver]));
	// OtherButton wire when those slots exist

	Store.subscribe(render); // re render on every delta
	render(); // first draw
}
