import { Players } from "@rbxts/services";

const gui = Players.LocalPlayer.WaitForChild("PlayerGui").WaitForChild("MainScreen");
const invGui = gui.WaitForChild("MainFrame").WaitForChild("InventoryGUI") as GuiObject;
const tradeGui = gui.WaitForChild("MainFrame").WaitForChild("TradeGUI") as GuiObject;
const closeBtn = invGui.WaitForChild("Close") as GuiButton;

closeBtn.MouseButton1Click.Connect(() => {
	(closeBtn.Parent as GuiObject).Visible = false;
});

const inventoryBtn = gui.WaitForChild("Menu").WaitForChild("Inventory") as ImageButton;
let inventoryGuiVisible = false;
inventoryBtn.MouseButton1Click.Connect(() => {
	inventoryGuiVisible = !inventoryGuiVisible;
	invGui.Visible = inventoryGuiVisible;
});

// const tradeBtn = gui.WaitForChild("Menu").WaitForChild("Trade") as ImageButton;
// print(tradeGui);
// let tradeGuiVisible = false;
// tradeBtn.MouseButton1Click.Connect(() => {
// 	tradeGuiVisible = !tradeGuiVisible;
// 	print(tradeGuiVisible);
// 	tradeGui.Visible = tradeGuiVisible;
// 	print(`Trade GUI visibility: ${tradeGuiVisible}`);
// });
