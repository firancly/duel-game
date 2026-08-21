// Builds the 3D crate the player clicks open. Client-only, purely cosmetic.
//
// Asset lookup walks SEARCH_ROOTS under ReplicatedStorage (Assets/Cases first)
// looking for a child named after the case — `modelName`, the id, or the display
// name with or without spaces, case-insensitive. Models, single MeshParts and
// folders of parts all work. If nothing matches, a crate is built out of Parts
// so the feature still runs.
//
// What a Studio model needs (everything else is figured out or normalized here):
//   - a child BasePart named "Lid" — this is the piece that pops off
// PrimaryPart is optional: without one the biggest non-lid part becomes the body.
// Existing ParticleEmitters in the model are reused instead of adding sparkles.

import { ReplicatedStorage } from "@rbxts/services";
import { CaseDef } from "shared/Cases";

const SPARKLE = "rbxasset://textures/particles/sparkles_main.dds";

export interface Crate {
	model: Model;
	root: BasePart; // PrimaryPart, the crate body
	lid: BasePart;
	lidRest: CFrame; // lid CFrame in root's object space, at rest
	light: PointLight;
	burst: ParticleEmitter[];
	centerOffset: Vector3; // bounding-box centre in pivot space, so spin stays centred
	radius: number; // largest extent, drives how far the camera pulls back
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

// Names we accept for a case: the explicit override, the id, and the display
// name with/without spaces — so "Green Case" in Studio still matches "GreenCase".
function aliases(def: CaseDef): string[] {
	const names = [def.id, def.name, def.name.gsub(" ", "")[0] as string];
	if (def.modelName !== undefined) names.unshift(def.modelName);
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
			`put a Model named "${def.id}" in ReplicatedStorage/Assets/Cases. Using the procedural crate.`,
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

function part(name: string, size: Vector3, cf: CFrame, color: Color3, parent: Instance): Part {
	const p = new Instance("Part");
	p.Name = name;
	p.Size = size;
	p.CFrame = cf;
	p.Color = color;
	p.Material = Enum.Material.SmoothPlastic;
	p.Anchored = true;
	p.CanCollide = false;
	p.CanQuery = true;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = parent;
	return p;
}

// Fallback crate: body + lid + trim, tinted by the case colour.
function buildProcedural(def: CaseDef): Model {
	const color = def.color ?? Color3.fromRGB(150, 150, 155);
	const dark = color.Lerp(new Color3(0, 0, 0), 0.55);
	const light = color.Lerp(new Color3(1, 1, 1), 0.35);

	const model = new Instance("Model");
	model.Name = def.id;

	// Body sits with its centre on the origin; the lid rides on top.
	const body = part("Body", new Vector3(4, 2.6, 4), new CFrame(0, 0, 0), color, model);
	body.Material = Enum.Material.Metal;
	body.Reflectance = 0.05;

	part("Trim", new Vector3(4.1, 0.35, 4.1), new CFrame(0, 0.4, 0), dark, model);
	part("Latch", new Vector3(0.6, 0.9, 0.25), new CFrame(0, 1.1, -2.05), light, model);

	const lid = part("Lid", new Vector3(4.2, 0.7, 4.2), new CFrame(0, 1.65, 0), dark, model);
	lid.Material = Enum.Material.Metal;
	lid.Reflectance = 0.08;

	model.PrimaryPart = body;
	return model;
}

// Anchor everything, kill collisions, keep parts raycastable for the click test.
function normalize(model: Model) {
	for (const d of model.GetDescendants()) {
		if (d.IsA("BasePart")) {
			d.Anchored = true;
			d.CanCollide = false;
			d.CanQuery = true;
			d.CanTouch = false;
		}
	}
}

// The body is whichever part is biggest — never the lid, since the lid is the
// piece that flies off. Studio models usually ship with no PrimaryPart set.
function pickRoot(model: Model): BasePart | undefined {
	if (model.PrimaryPart !== undefined) return model.PrimaryPart;

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

// Reuse whatever emitters the model already ships with (the "Particles"
// attachment on the real crates). Only if there are none do we add sparkles.
function collectEmitters(model: Model, lid: BasePart, def: CaseDef): ParticleEmitter[] {
	const found: ParticleEmitter[] = [];
	for (const d of model.GetDescendants()) if (d.IsA("ParticleEmitter")) found.push(d);
	if (found.size() > 0) return found;

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

export function build(def: CaseDef): Crate | undefined {
	const asset = findAsset(def);
	const model = asset !== undefined ? asModel(asset, def.id) : buildProcedural(def);
	if (asset !== undefined) print(`[Crate] ${def.id} → ${asset.GetFullName()}`);

	normalize(model);

	const root = pickRoot(model);
	if (root === undefined) {
		warn(`[Crate] model for ${def.id} has no BasePart`);
		model.Destroy();
		return undefined;
	}
	model.PrimaryPart = root;

	const lid = pickLid(model, root);

	// Reveal light lives in the body, off until the crate opens.
	const light = new Instance("PointLight");
	light.Brightness = 0;
	light.Range = 18;
	light.Color = def.color ?? new Color3(1, 1, 1);
	light.Parent = root;

	const burst = collectEmitters(model, lid, def);

	// Where the visual centre sits relative to the pivot, and how big the crate
	// is — the presenter needs both to spin it in place and frame it properly.
	const [boxCF, boxSize] = model.GetBoundingBox();
	const centerOffset = model.GetPivot().ToObjectSpace(boxCF).Position;
	const radius = math.max(boxSize.X, boxSize.Y, boxSize.Z);

	return {
		centerOffset,
		radius,
		model,
		root,
		lid,
		lidRest: root.CFrame.ToObjectSpace(lid.CFrame),
		light,
		burst,
	};
}
