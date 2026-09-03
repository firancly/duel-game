import { Debris, ReplicatedStorage, Workspace } from "@rbxts/services";

// How long the effect stays in the world before it's cleaned up.
const DURATION = 4;

// Folders tried in order for a death-effect model, first hit wins — same convention as
// CrateModel.ts's weapon/case lookups.
const SEARCH_ROOTS = ["Assets/DeathEffects", "Assets/Effects", "Assets"];

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const deathEffect = remotes.WaitForChild("DeathEffect") as RemoteEvent;

function resolve(path: string): Instance | undefined {
	let current: Instance = ReplicatedStorage;
	for (const segment of path.split("/")) {
		const child = current.FindFirstChild(segment);
		if (child === undefined) return undefined;
		current = child;
	}
	return current;
}

function findEffectModel(name: string): Instance | undefined {
	for (const rootPath of SEARCH_ROOTS) {
		const found = resolve(rootPath)?.FindFirstChild(name);
		if (found !== undefined) return found;
	}
	return undefined;
}

function playEffect(position: Vector3, modelName: string) {
	const source = findEffectModel(modelName);
	if (source === undefined) {
		warn(`[DeathEffect] no asset named "${modelName}" — put it in ReplicatedStorage/Assets/DeathEffects.`);
		return;
	}
	if (!source.IsA("Model") && !source.IsA("BasePart")) {
		warn(`[DeathEffect] "${modelName}" is a ${source.ClassName}, expected a Model or BasePart.`);
		return;
	}

	const instance = source.Clone();
	if (instance.IsA("Model")) instance.PivotTo(new CFrame(position));
	else instance.CFrame = new CFrame(position);

	// purely visual — no physics, no interaction
	for (const d of instance.GetDescendants()) {
		if (d.IsA("BasePart")) {
			d.Anchored = true;
			d.CanCollide = false;
			d.CanTouch = false;
			d.CanQuery = false;
		}
	}

	instance.Parent = Workspace;

	// enable every emitter; burst the ones authored as one-shot (Rate <= 0) so they're not silent
	for (const d of instance.GetDescendants()) {
		if (d.IsA("ParticleEmitter")) {
			d.Enabled = true;
			if (d.Rate <= 0) d.Emit(20);
		} else if (d.IsA("Sound")) {
			d.Play();
		}
	}

	Debris.AddItem(instance, DURATION);
}

deathEffect.OnClientEvent.Connect((position: unknown, modelName: unknown) => {
	if (!typeIs(position, "Vector3") || !typeIs(modelName, "string") || modelName === "") return;
	playEffect(position, modelName);
});

export {};
