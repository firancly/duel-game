import { Players } from "@rbxts/services";

const gui = Players.LocalPlayer.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const invGui = gui.WaitForChild("MainFrame").WaitForChild("InventoryGUI");
const closeBtn = invGui.WaitForChild("Close") as GuiButton;

closeBtn.MouseButton1Click.Connect(() => {
	const parent = closeBtn.Parent as GuiObject;
	parent.Visible = false;
});

const inventoryBtn = gui.WaitForChild("Menu").WaitForChild("Inventory") as ImageButton;

inventoryBtn.MouseButton1Click.Connect(() => {
	const parent = closeBtn.Parent as GuiObject;
	parent.Visible = true;
});
