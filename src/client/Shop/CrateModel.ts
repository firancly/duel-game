import { KeyframeSequenceProvider, ReplicatedStorage } from "@rbxts/services";
import { CaseDef } from "shared/Cases";

const SPARKLE = "rbxasset://textures/particles/sparkles_main.dds";

// The marker that means "the crate is open" cues the reward reveal. Particle
// timing does NOT come from markers; it's the timeline in shared/CrateVFX.ts.
export const OPEN_MARKER = "Crate";

export interface Crate {
	model: Model;
	root: BasePart; // anchored; everything else hangs off it
	radius: number; // largest extent, drives staging distance
	centerOffset: Vector3; // bounding-box centre in root space, so spin stays centred
	light: PointLight;
	burst: ParticleEmitter[]; // generic burst emitters (static crates)
	rigged: boolean;
	track?: AnimationTrack; // rigged crates only
	effects: Map<string, ParticleEmitter[]>; // effect part name (lowercased) -> its emitters
	display: CFrame; // authored orientation correction, see displayOffset()
	lid?: BasePart; // static crates only
	lidRest?: CFrame;
}

// Folders we'll look inside, in order. First hit wins.
const SEARCH_ROOTS = ["Assets/Cases", "Assets/Crates", "Assets", "Cases", "Crates"];

function resolve(path: string): Instance | undefined {
	let current: Instance = ReplicatedStorage;
	for (const segment of path.split("/")) {
		const child = current.FindFirstChild(segment);
		if (child === undefined) return undefined;
		current = child;
	}
	return current;
}

// A crate asset may be a Model, a single MeshPart/Part, or a Folder of parts.
function usable(inst: Instance | undefined): boolean {
	if (inst === undefined) return false;
	if (inst.IsA("Model") || inst.IsA("BasePart")) return true;
	if (inst.IsA("Folder")) {
		for (const d of inst.GetDescendants()) if (d.IsA("BasePart")) return true;
	}
	return false;
}

function matches(inst: Instance, names: string[]): boolean {
	const lower = inst.Name.lower();
	for (const n of names) if (lower === n.lower()) return true;
	return false;
}

// Names we accept for a case. The id goes first so a model named after the case
// ("GreenCase") wins over a legacy `modelName` alias ("BaseCrate").
function aliases(def: CaseDef): string[] {
	const names = [def.id, def.name, def.name.gsub(" ", "")[0] as string];
	if (def.modelName !== undefined) names.push(def.modelName);
	return names;
}

function findAsset(def: CaseDef): Instance | undefined {
	const names = aliases(def);

	// 1. the known folders, case-insensitive on the child name
	for (const rootPath of SEARCH_ROOTS) {
		const root = resolve(rootPath);
		if (root === undefined) continue;
		for (const child of root.GetChildren()) {
			if (matches(child, names) && usable(child)) return child;
		}
	}

	// 2. last resort: scan ReplicatedStorage, skipping the compiled/module trees
	for (const child of ReplicatedStorage.GetChildren()) {
		if (child.Name === "rbxts_include" || child.Name === "TS" || child.Name === "Remotes") continue;
		if (matches(child, names) && usable(child)) return child;
		for (const d of child.GetDescendants()) {
			if (matches(d, names) && usable(d)) return d;
		}
	}

	warn(
		`[Crate] no asset found for "${def.id}" (tried names: ${names.join(", ")}) — ` +
			`put a Model named "${def.id}" in ReplicatedStorage/Assets/Cases.`,
	);
	return undefined;
}

// Wrap a lone part / a folder of parts into a Model so the rest of the code
// only ever deals with Models.
function asModel(source: Instance, name: string): Model {
	if (source.IsA("Model")) return source.Clone();

	const model = new Instance("Model");
	model.Name = name;

	if (source.IsA("BasePart")) {
		const p = source.Clone();
		p.Parent = model;
		model.PrimaryPart = p;
		return model;
	}

	for (const child of source.GetChildren()) child.Clone().Parent = model;
	return model;
}

// Every part a Motor6D drives — these are the ones the animation moves, and the
// only ones that may stay unanchored (they hang off the anchored root).
function rigParts(model: Model): Set<BasePart> {
	const driven = new Set<BasePart>();
	for (const d of model.GetDescendants()) {
		if (!d.IsA("Motor6D")) continue;
		if (d.Part0 !== undefined) driven.add(d.Part0);
		if (d.Part1 !== undefined) driven.add(d.Part1);
	}
	return driven;
}

// A rigged crate must keep its Motor6D chain free to move, so only the root is
// anchored. Loose parts (VFX emitters in the effects folder) are NOT joined to
// the rig, so they stay anchored or they'd simply fall. Static crates anchor
// everything, since code moves those parts directly.
function normalize(model: Model, root: BasePart, rigged: boolean) {
	const driven = rigged ? rigParts(model) : new Set<BasePart>();

	for (const d of model.GetDescendants()) {
		if (!d.IsA("BasePart")) continue;

		const animated = rigged && d !== root && driven.has(d);
		d.Anchored = !animated;
		d.CanCollide = false;
		d.CanTouch = false;
		d.CanQuery = true; // the click test raycasts against these
		if (animated) d.Massless = true;
	}
	root.Anchored = true;
}

// Prefer an explicit PrimaryPart, then the rig root the animation is authored
// against, then the biggest part that isn't the lid (the lid flies off).
function pickRoot(model: Model): BasePart | undefined {
	if (model.PrimaryPart !== undefined) return model.PrimaryPart;

	for (const name of ["RootPart", "HumanoidRootPart"]) {
		const named = model.FindFirstChild(name);
		if (named !== undefined && named.IsA("BasePart")) return named;
	}

	let best: BasePart | undefined;
	let fallback: BasePart | undefined;
	for (const d of model.GetDescendants()) {
		if (!d.IsA("BasePart")) continue;
		if (fallback === undefined) fallback = d;
		if (d.Name.lower() === "lid") continue;
		if (best === undefined || d.Size.Magnitude > best.Size.Magnitude) best = d;
	}
	return best ?? fallback;
}

// "Lid" by name, otherwise whatever part sits highest.
function pickLid(model: Model, root: BasePart): BasePart {
	const named = model.FindFirstChild("Lid");
	if (named !== undefined && named.IsA("BasePart")) return named;

	let best: BasePart | undefined;
	for (const d of model.GetDescendants()) {
		if (d.IsA("BasePart") && d !== root) {
			if (best === undefined || d.Position.Y > best.Position.Y) best = d;
		}
	}
	return best ?? root;
}

// Group the emitters sitting in the model's effect folder (e.g. "Green") by the
// part that holds them, and switch them off — markers turn them on later.
function gatherEffects(model: Model): Map<string, ParticleEmitter[]> {
	const groups = new Map<string, ParticleEmitter[]>();

	for (const child of model.GetChildren()) {
		if (!child.IsA("Folder")) continue;
		for (const effectPart of child.GetChildren()) {
			const emitters: ParticleEmitter[] = [];
			for (const d of effectPart.GetDescendants()) {
				if (d.IsA("ParticleEmitter")) {
					d.Enabled = false;
					emitters.push(d);
				}
			}
			if (emitters.size() > 0) groups.set(effectPart.Name.lower(), emitters);
		}
	}
	return groups;
}

// Anything not already claimed as a marker effect, used for click feedback on
// static crates. If the model ships no emitters at all, add sparkles.
function collectEmitters(
	model: Model,
	lid: BasePart,
	def: CaseDef,
	claimed: Map<string, ParticleEmitter[]>,
): ParticleEmitter[] {
	const taken = new Set<ParticleEmitter>();
	for (const [, emitters] of claimed) for (const e of emitters) taken.add(e);

	const found: ParticleEmitter[] = [];
	for (const d of model.GetDescendants()) {
		if (d.IsA("ParticleEmitter") && !taken.has(d)) found.push(d);
	}
	if (found.size() > 0 || claimed.size() > 0) return found;

	const attach = new Instance("Attachment");
	attach.Parent = lid;

	const burst = new Instance("ParticleEmitter");
	burst.Texture = SPARKLE;
	burst.Rate = 0;
	burst.Enabled = false;
	burst.Lifetime = new NumberRange(0.4, 0.9);
	burst.Speed = new NumberRange(6, 14);
	burst.SpreadAngle = new Vector2(180, 180);
	burst.Size = new NumberSequence(0.7, 0);
	burst.Color = new ColorSequence(def.color ?? new Color3(1, 1, 1));
	burst.Parent = attach;
	return [burst];
}

// AnimSaves often holds more than one take — the real animation plus the
// editor's "Automatic Save" scratch copy. Prefer an explicitly named take, then
// anything that isn't the autosave, and only use the autosave as a last resort.
function pickSequence(model: Model, def: CaseDef): KeyframeSequence | undefined {
	const found: KeyframeSequence[] = [];
	for (const d of model.GetDescendants()) if (d.IsA("KeyframeSequence")) found.push(d);
	if (found.size() === 0) return undefined;

	if (def.animationName !== undefined) {
		for (const s of found) if (s.Name.lower() === def.animationName.lower()) return s;
		warn(`[Crate] ${def.id}: no take named "${def.animationName}" in AnimSaves`);
	}

	for (const s of found) if (s.Name.lower() !== "automatic save") return s;
	return found[0];
}

// config id -> a shipped Animation instance -> registering the raw KeyframeSequence.
function resolveAnimationId(model: Model, def: CaseDef): string | undefined {
	if (def.animationId !== undefined && def.animationId !== "") return def.animationId;

	const existing = model.FindFirstChildWhichIsA("Animation", true);
	if (existing !== undefined && existing.AnimationId !== "") return existing.AnimationId;

	const sequence = pickSequence(model, def);
	if (sequence === undefined) return undefined;

	// Registering an AnimSaves KeyframeSequence gives a local-only "hash://" id.
	// Handy in Studio, but publish the animation and set CaseDef.animationId for
	// anything shipping — this call is not guaranteed outside Studio.
	const found = sequence;
	const [ok, id] = pcall(() => KeyframeSequenceProvider.RegisterKeyframeSequence(found));
	if (!ok) {
		warn(`[Crate] could not register KeyframeSequence for ${def.id} — publish it and set animationId.`);
		return undefined;
	}
	return id as string;
}

// An animated prop can be rigged either way: Humanoid > Animator (what the
// animation editor gives you by default) or AnimationController > Animator
// (leaner, and the better choice for something that isn't a character).
function findAnimator(model: Model): Animator | undefined {
	const holder =
		model.FindFirstChildOfClass("AnimationController") ??
		(model.FindFirstChildOfClass("Humanoid") as Instance | undefined);
	return holder?.FindFirstChildOfClass("Animator");
}

function attrNumber(inst: Instance | undefined, name: string): number | undefined {
	if (inst === undefined) return undefined;
	const value = inst.GetAttribute(name);
	return typeIs(value, "number") ? value : undefined;
}

/**
 * How the crate has to be turned to face the player, in degrees.
 *
 * The presenter overwrites the root's CFrame every frame to stage and spin the
 * crate, so rotating RootPart in Studio has no effect at runtime — that edit is
 * simply overwritten. Set it here instead. In order of precedence:
 *
 *   1. a DisplayYaw / DisplayPitch / DisplayRoll attribute on the Model or its root
 *   2. CaseDef.displayYaw in shared/Cases.ts
 *
 * Attributes are the quick path: select the crate Model in Studio, add a number
 * attribute "DisplayYaw", and try 90 / 180 / 270 until it faces front. It sticks
 * because this reads it, unlike the RootPart's own orientation.
 */
function displayOffset(model: Model, root: BasePart, def: CaseDef): CFrame {
	const yaw = attrNumber(model, "DisplayYaw") ?? attrNumber(root, "DisplayYaw") ?? def.displayYaw ?? 0;
	const pitch = attrNumber(model, "DisplayPitch") ?? attrNumber(root, "DisplayPitch") ?? 0;
	const roll = attrNumber(model, "DisplayRoll") ?? attrNumber(root, "DisplayRoll") ?? 0;

	return CFrame.Angles(math.rad(pitch), math.rad(yaw), math.rad(roll));
}

// Measure the crate body only. VFX parts (ray planes, flares) live in the
// effects folder and are often tens of studs wide — letting them into the
// bounding box throws the staging distance out and pushes the crate off-screen.
function measure(model: Model, root: BasePart): { center: Vector3; radius: number } {
	let min: Vector3 | undefined;
	let max: Vector3 | undefined;

	for (const d of model.GetDescendants()) {
		if (!d.IsA("BasePart")) continue;
		if (d.FindFirstAncestorOfClass("Folder") !== undefined) continue; // effects folder
		if (d.Transparency >= 1) continue; // invisible rig roots

		const half = d.Size.mul(0.5);
		const lo = d.Position.sub(half);
		const hi = d.Position.add(half);
		min = min === undefined ? lo : min.Min(lo);
		max = max === undefined ? hi : max.Max(hi);
	}

	if (min === undefined || max === undefined) {
		return { center: root.Position, radius: math.max(1, root.Size.Magnitude) };
	}

	const size = max.sub(min);
	return { center: min.add(size.mul(0.5)), radius: math.max(1, math.max(size.X, size.Y, size.Z)) };
}

/**
 * Load the opening animation. Must be called AFTER the model is parented into
 * the world — Animator:LoadAnimation fails on a rig that isn't in the DataModel,
 * which silently drops the crate back to the coded open.
 */
export function bindAnimation(crate: Crate, def: CaseDef): AnimationTrack | undefined {
	if (!crate.rigged) return undefined;

	const animator = findAnimator(crate.model);
	if (animator === undefined) return undefined;

	crate.track = loadTrack(crate.model, animator, def);
	return crate.track;
}

function loadTrack(model: Model, animator: Animator, def: CaseDef): AnimationTrack | undefined {
	const id = resolveAnimationId(model, def);
	if (id === undefined) {
		warn(`[Crate] ${def.id} is rigged but has no animation — falling back to the coded open.`);
		return undefined;
	}

	const animation = new Instance("Animation");
	animation.AnimationId = id;
	animation.Parent = model;

	const [ok, track] = pcall(() => animator.LoadAnimation(animation));
	if (!ok) {
		warn(`[Crate] failed to load animation ${id} for ${def.id}`);
		return undefined;
	}

	const loaded = track as AnimationTrack;
	loaded.Looped = false;
	loaded.Priority = Enum.AnimationPriority.Action;
	return loaded;
}

export function build(def: CaseDef): Crate | undefined {
	const asset = findAsset(def);
	if (asset === undefined) return undefined; // no fallback — caller reports the error

	const model = asModel(asset, def.id);
	print(`[Crate] ${def.id} → ${asset.GetFullName()}`);

	const root = pickRoot(model);
	if (root === undefined) {
		warn(`[Crate] model for ${def.id} has no BasePart`);
		model.Destroy();
		return undefined;
	}

	// Rigged is decided by the rig itself, not by whether the animation loaded —
	// the track is bound later, once the model is in the world.
	const rigged = findAnimator(model) !== undefined && rigParts(model).size() > 0;

	// A prop humanoid has no business running the state machine. Crates rigged
	// with an AnimationController have nothing to switch off.
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid !== undefined) humanoid.EvaluateStateMachine = false;

	normalize(model, root, rigged);
	model.PrimaryPart = root;

	const effects = gatherEffects(model);
	const lid = rigged ? undefined : pickLid(model, root);

	// Reveal light lives in the body, off until the crate opens.
	const light = new Instance("PointLight");
	light.Brightness = 0;
	light.Range = 18;
	light.Color = def.color ?? new Color3(1, 1, 1);
	light.Parent = root;

	const burst = lid !== undefined ? collectEmitters(model, lid, def, effects) : [];

	// Where the visual centre sits relative to the root, and how big the crate
	// is — the presenter needs both to spin it in place and stage it properly.
	const { center, radius } = measure(model, root);
	const centerOffset = root.CFrame.ToObjectSpace(new CFrame(center)).Position;

	print(`[Crate] ${def.id}: rigged=${rigged}, radius=${string.format("%.1f", radius)}`);

	return {
		model,
		root,
		radius,
		centerOffset,
		light,
		burst,
		rigged,
		track: undefined, // bound after the model is parented, see bindAnimation
		effects,
		display: displayOffset(model, root, def),
		lid,
		lidRest: lid !== undefined ? root.CFrame.ToObjectSpace(lid.CFrame) : undefined,
	};
}
