import { ReplicatedStorage, RunService, Workspace } from "@rbxts/services";

// A kill plays the shooters equipped death effect on the victim the effect is placed on
// the victims root part and follows it until it is cleaned up

// How long the effect stays in the world
const DURATION = 4;

// Death effects folder
const SEARCH_ROOT = "Assets/DeathEffects";

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
	return resolve(SEARCH_ROOT)?.FindFirstChild(name);
}

function playEffect(position: Vector3, modelName: string, root: BasePart | undefined) {
	const source = findEffectModel(modelName);
	if (source === undefined) {
		warn(`[DeathEffect] no asset named "${modelName}". Put it in ReplicatedStorage/Assets/DeathEffects.`);
		return;
	}
	if (!source.IsA("Model") && !source.IsA("BasePart")) {
		warn(`[DeathEffect] "${modelName}" is a ${source.ClassName}, expected a Model or BasePart.`);
		return;
	}

	const instance = source.Clone();
	const rootAlive = () => root !== undefined && root.Parent !== undefined;
	const place = () => {
		const at = new CFrame(root !== undefined && rootAlive() ? root.Position : position);
		if (instance.IsA("Model")) instance.PivotTo(at);
		else instance.CFrame = at;
	};
	place();

	// only visual, remove physics load
	for (const d of instance.GetDescendants()) {
		if (d.IsA("BasePart")) {
			d.Anchored = true;
			d.CanCollide = false;
			d.CanTouch = false;
			d.CanQuery = false;
		}
	}

	instance.Parent = Workspace;

	// enable every emitter
	for (const d of instance.GetDescendants()) {
		if (d.IsA("ParticleEmitter")) {
			d.Enabled = true;
			if (d.Rate <= 0) d.Emit(20);
		} else if (d.IsA("Sound")) {
			d.Play();
		}
	}

	// Anchored and moved every frame. Once the root part is gone it holds its last spot
	const follow = RunService.RenderStepped.Connect(() => {
		if (rootAlive()) place();
	});
	task.delay(DURATION, () => {
		follow.Disconnect();
		instance.Destroy();
	});
}

deathEffect.OnClientEvent.Connect((position: unknown, modelName: unknown, root: unknown) => {
	if (!typeIs(position, "Vector3")) return;
	if (!typeIs(modelName, "string") || modelName === "") return;
	const rootPart = typeIs(root, "Instance") && root.IsA("BasePart") ? root : undefined;
	playEffect(position, modelName, rootPart);
});

export {};
