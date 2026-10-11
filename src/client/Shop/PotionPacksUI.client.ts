import { MarketplaceService, Players } from "@rbxts/services";
import { PotionPacks } from "shared/Monetization";
import { trackTagged } from "../UI/Tags";

// Potion pack buttons, found by tag. Each pack in shared/Monetization.ts names its own
// tag (PotionPackSmall, PotionPackMedium, ...); pressing a tagged button prompts that
// pack's Robux purchase. The server credits the potions when the receipt arrives and
// the balance reaches the UI through the normal PotionsUpdate event.

const player = Players.LocalPlayer;

// A tag can fire for an instance more than once; never bind the same button twice.
const bound = new Set<GuiButton>();

for (const pack of PotionPacks) {
	trackTagged<GuiButton>(pack.tag, (button) => {
		if (bound.has(button)) return;
		bound.add(button);

		button.Activated.Connect(() => {
			MarketplaceService.PromptProductPurchase(player, pack.id);
		});
	});
}
