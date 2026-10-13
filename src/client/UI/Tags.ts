import { CollectionService, Players } from "@rbxts/services";

/**
 * Live list of every instance carrying `tag` inside the local player's PlayerGui.
 *
 * The array is kept up to date as tagged instances appear and disappear (UI being
 * cloned in, destroyed, reparented), so callers just loop over it. `onAdded` runs
 * once per instance, including the ones that already exist when this is called.
 *
 * StarterGui keeps its own tagged originals on the client; those are skipped, only
 * the copies actually living in PlayerGui count.
 *
 * `fallback` is an authored instance to include even though it carries no tag, so UI works
 * at its original path before anyone has tagged it.
 */
export function trackTagged<T extends Instance>(
	tag: string,
	onAdded?: (instance: T) => void,
	fallback?: Instance,
): T[] {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
	const tracked: T[] = [];

	const add = (instance: Instance) => {
		if (!instance.IsDescendantOf(playerGui)) return;
		const typed = instance as T;
		if (tracked.includes(typed)) return;

		tracked.push(typed);
		onAdded?.(typed);
	};

	for (const instance of CollectionService.GetTagged(tag)) add(instance);
	if (fallback !== undefined) add(fallback);

	CollectionService.GetInstanceAddedSignal(tag).Connect(add);
	CollectionService.GetInstanceRemovedSignal(tag).Connect((instance) => {
		const index = tracked.indexOf(instance as T);
		if (index !== -1) tracked.remove(index);
	});

	return tracked;
}

/**
 * Calls `onPressed` whenever a button carrying `tag` is activated, including buttons that
 * get tagged or cloned in later. `fallback` is an authored button to bind as well, for UI
 * that hasn't been tagged yet. A button is bound once, even if it is both.
 */
export function onTaggedButton(tag: string, onPressed: () => void, fallback?: Instance): GuiButton[] {
	const bound = new Set<GuiButton>();
	const bind = (button: GuiButton) => {
		if (bound.has(button)) return;
		bound.add(button);
		button.Activated.Connect(onPressed);
	};

	const button = fallback !== undefined && fallback.IsA("GuiButton") ? fallback : undefined;
	return trackTagged<GuiButton>(tag, bind, button);
}
