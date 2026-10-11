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
 */
export function trackTagged<T extends Instance>(tag: string, onAdded?: (instance: T) => void): T[] {
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

	CollectionService.GetInstanceAddedSignal(tag).Connect(add);
	CollectionService.GetInstanceRemovedSignal(tag).Connect((instance) => {
		const index = tracked.indexOf(instance as T);
		if (index !== -1) tracked.remove(index);
	});

	return tracked;
}
