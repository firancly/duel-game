import { Players, ReplicatedStorage, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { Cases, CLICKS_TO_OPEN } from "shared/Cases";
import { getDef, Rarity, RarityColor } from "shared/Catalog";
import { ANIMATION_SPEED, ANIMATION_WEIGHT, CrateVFX, VfxTiming } from "shared/CrateVFX";
import * as CrateModel from "./CrateModel";
import { Crate } from "./CrateModel";

const player = Players.LocalPlayer;

// tuning
const CRATE_DIST_SCALE = 2.6; // how far ahead of the camera, as a multiple of the crate's largest extent
const CRATE_MIN_DIST = 10;
const CRATE_MAX_DIST = 40; // never stage so far out
const CRATE_DROP = 0; // studs the crate is staged below eye level
const DRAG_SENSITIVITY = 0.006; // radians per pixel
const PITCH_LIMIT = 1.0; // radians
const CLICK_SLOP = 8; // pixels of movement still counted as a click, not a drag
const REVEAL_HOLD = 4; // seconds the reward stays up before auto-closing
const CRATE_SEQUENCE_FOLDER = "CratesSequence"; // Workspace folder with the authored parts
const CRATE_CAMERA_PART = "CrateCamera"; // camera position + orientation
const CRATE_SPAWN_PART = "CrateSpawn"; // where the crate sits

// Drag-to-spin is parked, not deleted — bring it back (ALLOW_DRAG_ROTATE = true)
// once skins can walk out of the opened crate and need to be looked at.
const ALLOW_DRAG_ROTATE = false;

// Name + rarity text shown at the bottom of the screen on reveal. Off = the weapon
// and the rarity-coloured light carry the reveal on their own.
const SHOW_REWARD_TEXT = true;

// Optional sfx — drop your own rbxassetid in, empty string means silent.
const SOUND_CLICK = "";
const SOUND_OPEN = "";

type State = "Idle" | "Presenting" | "Revealed" | "Closing";

let state: State = "Idle";
let session = 0; // bumped on every teardown, invalidates pending task.delay callbacks
let onDone: (() => void) | undefined;

let crate: Crate | undefined;
let folder: Folder | undefined;
let connections: RBXScriptConnection[] = [];

// camera / character state we borrowed and must hand back
let savedCameraType: Enum.CameraType | undefined;
let savedCameraCF: CFrame | undefined;
let savedCameraSubject: Humanoid | BasePart | undefined;
let savedWalkSpeed: number | undefined;
let savedJumpPower: number | undefined;
let savedJumpHeight: number | undefined;

// live animation state
let baseCF = new CFrame();
let yaw = 0;
let pitch = 0;
let dragging = false;
let dragDistance = 0;
let punch = 0; // click recoil, decays to 0
let clicks = 0;
let lidLift = 0;
let lidLiftTarget = 0;
let lidTilt = 0;
let lidTiltTarget = 0;
let lidDetached = false;
let elapsed = 0;
let lastPos = new Vector2();
let savedMouseBehavior: Enum.MouseBehavior | undefined;

// Pin the cursor in place for the duration of a drag, so Delta reports movement
// and the pointer can't wander off the screen edge mid-spin.
function lockMouse() {
	if (savedMouseBehavior === undefined) savedMouseBehavior = UserInputService.MouseBehavior;
	UserInputService.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition;
}

function unlockMouse() {
	if (savedMouseBehavior === undefined) return;
	UserInputService.MouseBehavior = savedMouseBehavior;
	savedMouseBehavior = undefined;
}

export function isBusy(): boolean {
	return state !== "Idle";
}

function playSound(id: string, parent: Instance) {
	if (id === "") return;
	const s = new Instance("Sound");
	s.SoundId = id;
	s.Parent = parent;
	s.Play();
	s.Ended.Connect(() => s.Destroy());
}

function camera(): Camera | undefined {
	return Workspace.CurrentCamera;
}

function humanoid(): Humanoid | undefined {
	return player.Character?.FindFirstChildOfClass("Humanoid");
}

function levelCamera(cam: Camera) {
	const look = cam.CFrame.LookVector;
	const flat = new Vector3(look.X, 0, look.Z);
	const facing = flat.Magnitude > 0.01 ? flat.Unit : new Vector3(0, 0, -1);
	cam.CFrame = CFrame.lookAt(cam.CFrame.Position, cam.CFrame.Position.add(facing));
}

// Workspace.CratesSequence holds two authored parts: CrateCamera (where the camera
// sits) and CrateSpawn (where the crate's centre goes, with the part's rotation).
// Either one missing falls back to staging in front of the player's own camera.
function sequencePart(name: string): BasePart | undefined {
	const part = Workspace.FindFirstChild(CRATE_SEQUENCE_FOLDER)?.FindFirstChild(name);
	if (part === undefined || !part.IsA("BasePart")) return undefined;
	return part;
}

function stageCFrame(cam: Camera, radius: number, ignore?: Instance): CFrame {
	let dist = math.clamp(radius * CRATE_DIST_SCALE, CRATE_MIN_DIST, CRATE_MAX_DIST);

	// If the view is blocked by a wall, pull the crate in so it doesn't stage inside it.
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const excluded: Instance[] = [];
	if (player.Character !== undefined) excluded.push(player.Character);
	if (ignore !== undefined) excluded.push(ignore);
	params.FilterDescendantsInstances = excluded;

	const hit = Workspace.Raycast(cam.CFrame.Position, cam.CFrame.LookVector.mul(dist), params);
	if (hit !== undefined) dist = math.max(radius * 0.75 + 2, hit.Distance - radius * 0.6);

	const position = cam.CFrame.Position.add(cam.CFrame.LookVector.mul(dist)).sub(new Vector3(0, CRATE_DROP, 0));

	// Face the camera on the horizontal plane only, keeping world up as up.
	const back = cam.CFrame.Position.sub(position);
	const flat = new Vector3(back.X, 0, back.Z);
	const facing = flat.Magnitude > 0.01 ? flat.Unit : new Vector3(0, 0, -1);

	return CFrame.lookAt(position, position.add(facing));
}

// Belt and braces: on a close camera the character can still poke into shot, so
// make it locally invisible for the duration. Re-applied every frame because the
// engine rewrites LocalTransparencyModifier as the camera moves.
function setCharacterHidden(hidden: boolean) {
	const character = player.Character;
	if (character === undefined) return;

	const value = hidden ? 1 : 0;
	for (const d of character.GetDescendants()) {
		if (d.IsA("BasePart")) d.LocalTransparencyModifier = value;
		else if (d.IsA("Decal")) d.LocalTransparencyModifier = value;
	}
}

// the nametag billboard would otherwise float in shot over the hidden character
function setNameTagEnabled(enabled: boolean) {
	const nameTag = player.Character?.FindFirstChild("Head")?.FindFirstChild("NameTagUI") as BillboardGui | undefined;
	if (nameTag !== undefined) nameTag.Enabled = enabled;
}

function registerClick() {
	if (crate === undefined) return;

	clicks += 1;
	playSound(SOUND_CLICK, crate.root);

	// Rigged crate: each click releases the next slice of the authored animation,
	// which the render loop pauses at. The last click lets it run to the end.
	if (crate.track !== undefined) {
		if (!crate.track.IsPlaying) crate.track.Play(0);
		crate.track.AdjustSpeed(ANIMATION_SPEED);
		return;
	}

	// Rigged but the animation never loaded: no lid to move by hand, so the
	// clicks just count down to the reveal.
	if (crate.rigged) {
		if (clicks >= CLICKS_TO_OPEN) reveal();
		return;
	}

	// Static crate: the lid creeps open a little more with every hit.
	punch = 1;
	for (const e of crate.burst) e.Emit(12);
	const progress = math.min(clicks / CLICKS_TO_OPEN, 1);
	lidLiftTarget = progress * 0.35;
	lidTiltTarget = progress * 0.12;

	if (clicks >= CLICKS_TO_OPEN) reveal();
}

function rarityColorFor(skinId: string, rarity: string | undefined): Color3 {
	const def = getDef(skinId);
	return RarityColor.get((rarity ?? def?.rarity ?? Rarity.Common) as Rarity) ?? new Color3(1, 1, 1);
}

// Screen-space reveal text pinned to the bottom of the screen: skin name, with
// its rarity underneath in the rarity colour. Torn down in finish().
let rewardGui: ScreenGui | undefined;

function makeRewardLabel(
	parent: Instance,
	text: string,
	color: Color3,
	font: Enum.Font,
	y: number,
	height: number,
): TextLabel {
	const label = new Instance("TextLabel");
	label.Size = UDim2.fromScale(1, height);
	label.Position = UDim2.fromScale(0, y);
	label.BackgroundTransparency = 1;
	label.Text = text;
	label.TextColor3 = color;
	label.TextScaled = true;
	label.Font = font;
	label.TextTransparency = 1; // faded in by showRewardText
	label.Parent = parent;

	const stroke = new Instance("UIStroke");
	stroke.Color = Color3.fromRGB(0, 0, 0);
	stroke.Thickness = 2;
	stroke.Transparency = 1;
	stroke.Parent = label;

	return label;
}

function showRewardText(skinId: string, rarity: string | undefined, color: Color3) {
	const playerGui = player.FindFirstChildOfClass("PlayerGui");
	if (playerGui === undefined) return;

	const def = getDef(skinId);

	const gui = new Instance("ScreenGui");
	gui.Name = "CrateRewardText";
	gui.IgnoreGuiInset = true;
	gui.ResetOnSpawn = false;
	gui.DisplayOrder = 100;
	gui.Parent = playerGui;

	const holder = new Instance("Frame");
	holder.AnchorPoint = new Vector2(0.5, 1);
	holder.Position = new UDim2(0.5, 0, 1, -48);
	holder.Size = new UDim2(0.5, 0, 0, 120);
	holder.BackgroundTransparency = 1;
	holder.Parent = gui;

	const nameLabel = makeRewardLabel(holder, def?.name ?? skinId, new Color3(1, 1, 1), Enum.Font.GothamBold, 0, 0.6);
	const rarityLabel = makeRewardLabel(holder, rarity ?? def?.rarity ?? "", color, Enum.Font.GothamMedium, 0.62, 0.34);

	const fade = new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
	for (const label of [nameLabel, rarityLabel]) {
		TweenService.Create(label, fade, { TextTransparency: 0 }).Play();
		const stroke = label.FindFirstChildOfClass("UIStroke");
		if (stroke !== undefined) TweenService.Create(stroke, fade, { Transparency: 0 }).Play();
	}

	rewardGui = gui;
}

let pendingSkinId: string | undefined;
let pendingRarity: string | undefined;

// The revealed weapon model, popped out of the crate at the end of the
// animation. Parented under `folder`, so finish()'s folder?.Destroy() cleans
// it up too — no separate teardown needed.
let rewardWeapon: Model | undefined;
let rewardWeaponBase: CFrame | undefined; // rest CFrame (no spin), set once the pop-out tween lands
let rewardWeaponSpin = false;

// One scheduled effect part: when it starts, when it stops, when it next pulses.
interface VfxLane {
	emitters: ParticleEmitter[];
	timing: VfxTiming;
	started: boolean;
	finished: boolean;
	nextEmit: number;
}

let vfxLanes: VfxLane[] = [];
let vfxClock = 0; // animation seconds, frozen while the crate waits on a click

function setEnabled(emitters: ParticleEmitter[], enabled: boolean) {
	for (const e of emitters) e.Enabled = enabled;
}

function emit(emitters: ParticleEmitter[], amount: number) {
	for (const e of emitters) if (e.Parent !== undefined) e.Emit(amount);
}

// Match each effect part in the model to its timing from the animator's config.
function buildVfxSchedule() {
	vfxLanes = [];
	vfxClock = 0;
	if (crate === undefined) return;

	for (const [name, emitters] of crate.effects) {
		const timing = CrateVFX.get(name);
		if (timing === undefined) {
			warn(`[Crate] no VFX timing for "${name}" — add it to shared/CrateVFX.ts`);
			continue;
		}
		setEnabled(emitters, false);
		vfxLanes.push({ emitters, timing, started: false, finished: false, nextEmit: timing.delay });
	}
}

// Runs every frame while the animation is moving. Mirrors the animator's looper:
// enable at `delay`, Emit(amount) every `step`, disable after `duration`.
function stepVfx(dt: number) {
	if (vfxLanes.size() === 0) return;
	vfxClock += dt;

	for (const lane of vfxLanes) {
		if (lane.finished) continue;
		const { amount, delay, duration, step } = lane.timing;
		if (vfxClock < delay) continue;

		// amount <= 0 in the config means the part is deliberately silent
		if (amount <= 0) {
			setEnabled(lane.emitters, false);
			lane.finished = true;
			continue;
		}

		if (!lane.started) {
			lane.started = true;
			setEnabled(lane.emitters, true);
		}

		if (vfxClock >= delay + duration) {
			setEnabled(lane.emitters, false);
			lane.finished = true;
			continue;
		}

		if (vfxClock >= lane.nextEmit) {
			emit(lane.emitters, amount);
			lane.nextEmit += math.max(step, 1 / 60);
		}
	}
}

// Nothing matched the config: fire everything once so the crate isn't silent.
function playAllEffects() {
	if (crate === undefined) return;
	for (const [, emitters] of crate.effects) {
		setEnabled(emitters, true);
		emit(emitters, 20);
	}
}

function stopAllEffects() {
	if (crate === undefined) return;
	for (const [, emitters] of crate.effects) setEnabled(emitters, false);
}

// Static crates only: pop the lid off in code. Rigged crates do this in the
// authored animation, so they go straight to reveal().
function popLid() {
	if (crate === undefined) return;
	const c = crate;
	if (c.lid === undefined) return;

	// lid leaves the model so it can fly off independently of the crate's spin
	lidDetached = true;
	c.lid.Parent = folder;
	for (const e of c.burst) e.Emit(60);

	const flyTo = c.lid.CFrame.mul(new CFrame(0, math.max(6, c.radius * 1.5), 0)).mul(
		CFrame.Angles(math.rad(140), math.rad(60), 0),
	);
	TweenService.Create(c.lid, new TweenInfo(0.9, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), {
		CFrame: flyTo,
		Transparency: 1,
	}).Play();
}

// Resolve a skin's actual weapon model, ReplicatedStorage/Assets/Weapons/<SkinDef.model>.
function findWeaponModel(skinId: string): Model | undefined {
	const def = getDef(skinId);
	if (def === undefined) {
		warn(`[Crate] getDef("${skinId}") returned nothing — no Catalog entry for that id`);
		return undefined;
	}
	const name = def.model;
	if (name === undefined) {
		warn(`[Crate] Catalog entry "${skinId}" has no "model" field set`);
		return undefined;
	}

	const assets = ReplicatedStorage.FindFirstChild("Assets");
	if (assets === undefined) {
		warn(`[Crate] ReplicatedStorage has no "Assets" folder`);
		return undefined;
	}
	const weapons = assets.FindFirstChild("Weapons");
	if (weapons === undefined) {
		warn(`[Crate] ReplicatedStorage.Assets has no "Weapons" folder`);
		return undefined;
	}
	const found = weapons.FindFirstChild(name);
	if (found === undefined) {
		warn(`[Crate] ReplicatedStorage.Assets.Weapons has no child "${name}" (skin "${skinId}")`);
		return undefined;
	}
	if (!found.IsA("Model")) {
		warn(`[Crate] ReplicatedStorage.Assets.Weapons.${name} is a ${found.ClassName}, not a Model`);
		return undefined;
	}
	return found;
}

// Pop the won weapon out of the crate: rises from the root to hover above it,
// then spins slowly in place for the rest of the reveal.
function spawnRewardWeapon(root: BasePart, radius: number, skinId: string) {
	const source = findWeaponModel(skinId);
	if (source === undefined) return;

	const weapon = source.Clone();
	for (const d of weapon.GetDescendants()) {
		if (d.IsA("BasePart")) {
			d.Anchored = true;
			d.CanCollide = false;
			d.CanTouch = false;
			d.CanQuery = false;
			d.Massless = true;
		}
	}
	weapon.Parent = folder;

	const startCF = root.CFrame;
	const restCF = root.CFrame.mul(new CFrame(0, math.max(2.4, radius * 0.9), 0));
	weapon.PivotTo(startCF);

	// TweenService can't animate Model:PivotTo directly, so drive it through a
	// CFrameValue and re-pivot on every step of the tween.
	const driver = new Instance("CFrameValue");
	driver.Value = startCF;
	driver.Parent = weapon;
	driver.Changed.Connect((v) => weapon.PivotTo(v));

	const tween = TweenService.Create(driver, new TweenInfo(0.9, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Value: restCF,
	});
	tween.Completed.Connect(() => {
		rewardWeaponBase = restCF;
		rewardWeaponSpin = true;
	});
	tween.Play();

	rewardWeapon = weapon;
	rewardWeaponBase = undefined;
	rewardWeaponSpin = false;

	print(`[Crate] reward weapon "${skinId}" -> ${source.Name}, popping to ${tostring(restCF.Position)}`);
}

function reveal() {
	if (crate === undefined || state !== "Presenting") return;
	state = "Revealed";

	const c = crate;
	const skinId = pendingSkinId;

	playSound(SOUND_OPEN, c.root);
	popLid();
	if (skinId !== undefined) spawnRewardWeapon(c.root, c.radius, skinId);
	// A crate whose effect parts aren't in the config would otherwise be silent.
	if (vfxLanes.size() === 0) playAllEffects();

	let color = c.light.Color;
	if (skinId !== undefined) {
		color = rarityColorFor(skinId, pendingRarity);
		if (SHOW_REWARD_TEXT) showRewardText(skinId, pendingRarity, color);
	}

	c.light.Color = color;
	c.light.Brightness = 8;
	TweenService.Create(c.light, new TweenInfo(1.2), { Brightness: 2 }).Play();

	const token = session;
	task.delay(REVEAL_HOLD, () => {
		if (session === token) finish();
	});
}

function onInputBegan(input: InputObject, gameProcessed: boolean) {
	if (gameProcessed) return;
	if (input.UserInputType !== Enum.UserInputType.MouseButton1 && input.UserInputType !== Enum.UserInputType.Touch)
		return;

	// during the reveal any click just closes the ceremony
	if (state === "Revealed") {
		finish();
		return;
	}

	dragging = true;
	dragDistance = 0;
	lastPos = new Vector2(input.Position.X, input.Position.Y);

	// A free mouse reports Delta as (0,0) — only a locked one gives real movement.
	// Locking also means the drag never runs out of screen to travel across.
	if (input.UserInputType === Enum.UserInputType.MouseButton1) lockMouse();
}

function onInputChanged(input: InputObject) {
	if (!dragging) return;
	if (input.UserInputType !== Enum.UserInputType.MouseMovement && input.UserInputType !== Enum.UserInputType.Touch)
		return;

	// Prefer Delta (correct while the mouse is locked, and always right for
	// touch); fall back to the change in position if it came back empty.
	let dx = input.Delta.X;
	let dy = input.Delta.Y;
	if (dx === 0 && dy === 0) {
		dx = input.Position.X - lastPos.X;
		dy = input.Position.Y - lastPos.Y;
	}
	lastPos = new Vector2(input.Position.X, input.Position.Y);

	dragDistance += new Vector2(dx, dy).Magnitude;

	// Rotation itself is disabled (see ALLOW_DRAG_ROTATE) but dragDistance still
	// has to accumulate above so onInputEnded can tell a click from a drag.
	if (!ALLOW_DRAG_ROTATE) return;
	yaw -= dx * DRAG_SENSITIVITY;
	pitch = math.clamp(pitch - dy * DRAG_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
}

function onInputEnded(input: InputObject) {
	if (input.UserInputType !== Enum.UserInputType.MouseButton1 && input.UserInputType !== Enum.UserInputType.Touch)
		return;
	if (!dragging) return;

	const wasClick = dragDistance < CLICK_SLOP;
	dragging = false;
	unlockMouse();

	if (wasClick && state === "Presenting") registerClick();
}

// Freeze just short of the animation's last frame instead of letting it run
// to the actual end — keeps the crate sitting open (lid up) rather than
// whatever the clip's final frame happens to be. Length reads 0 until the
// animation finishes loading, hence the guard. Clamped to half the clip's
// length so a short animation can't get held before it's even opened.
const END_HOLD = 0.15; // seconds before the end to freeze at
function holdBeforeEnd() {
	const track = crate?.track;
	if (track === undefined || !track.IsPlaying || track.Speed <= 0 || track.Length <= 0) return;

	const buffer = math.min(END_HOLD, track.Length * 0.5);
	if (track.TimePosition >= track.Length - buffer) {
		track.AdjustSpeed(0);
		reveal();
	}
}

function onRender(dt: number) {
	if (crate === undefined) return;
	elapsed += dt;

	// The crate only ever moves because the player dragged or clicked it.
	setCharacterHidden(true);

	punch = math.max(0, punch - dt * 4);
	const shake = crate.rigged ? 0 : punch * 0.1;

	// Rotate about the crate's bounding-box centre: models whose pivot sits at
	// the base would otherwise swing in a circle instead of spinning in place.
	const spin = baseCF
		.mul(CFrame.Angles(0, yaw, 0))
		.mul(CFrame.Angles(pitch, 0, 0))
		.mul(CFrame.Angles(math.sin(elapsed * 60) * shake, 0, math.cos(elapsed * 50) * shake));

	// stage/spin -> the model's own orientation fix -> recentre on the stage point
	const placed = spin.mul(crate.display).mul(new CFrame(crate.centerOffset.mul(-1)));

	// A rig is posed by its Motor6Ds off the anchored root, so move the root and
	// let the animation place everything else. PivotTo would fight it.
	if (crate.rigged) crate.root.CFrame = placed;
	else crate.model.PivotTo(placed);

	holdBeforeEnd();

	// The VFX clock only advances while the crate is actually opening, so a
	// timeline authored against a continuous play still lines up when the
	// player leaves the crate paused between clicks.
	const track = crate.track;
	if (track === undefined || (track.IsPlaying && track.Speed > 0) || state === "Revealed") stepVfx(dt);

	// Slow showcase spin once the pop-out tween has landed the weapon at rest.
	if (rewardWeaponSpin && rewardWeapon !== undefined && rewardWeaponBase !== undefined) {
		rewardWeapon.PivotTo(rewardWeaponBase.mul(CFrame.Angles(0, elapsed * 1.1, 0)));
	}

	// Static crates carry their lid by hand; a rig has no loose lid to place.
	const lid = crate.lid;
	const lidRest = crate.lidRest;
	if (!lidDetached && lid !== undefined && lidRest !== undefined) {
		const a = math.min(1, dt * 8);
		lidLift += (lidLiftTarget - lidLift) * a;
		lidTilt += (lidTiltTarget - lidTilt) * a;
		lid.CFrame = crate.root.CFrame.mul(lidRest)
			.mul(new CFrame(0, lidLift, 0))
			.mul(CFrame.Angles(lidTilt, 0, 0));
	}
}

function connectAll() {
	connections.push(UserInputService.InputBegan.Connect(onInputBegan));
	connections.push(UserInputService.InputChanged.Connect(onInputChanged));
	connections.push(UserInputService.InputEnded.Connect(onInputEnded));
	connections.push(RunService.RenderStepped.Connect(onRender));
	// a respawn mid-ceremony must never strand the camera in Scriptable
	connections.push(player.CharacterRemoving.Connect(() => finish()));

	const hum = humanoid();
	if (hum !== undefined) connections.push(hum.Died.Connect(() => finish()));

	// VFX are on the timeline in shared/CrateVFX.ts, not on markers.
	const track = crate?.track;
	if (track === undefined) return;

	// Normal path: holdBeforeEnd() (in onRender) freezes the track just short
	// of its last frame and reveals then, so the crate ends up sitting open
	// instead of on whatever the clip's actual final frame is. This is only a
	// backstop for the case that never happens — Length staying 0 forever, or
	// something Stopping the track before holdBeforeEnd caught it.
	// (Deliberately not using OPEN_MARKER — see holdBeforeEnd.)
	connections.push(track.Stopped.Connect(() => reveal()));
}

function disconnectAll() {
	for (const c of connections) c.Disconnect();
	connections = [];
}

// Single teardown path — every exit goes through here.
export function finish() {
	if (state === "Idle" || state === "Closing") return;
	state = "Closing";
	session += 1;

	disconnectAll();

	const hum = humanoid();
	if (hum !== undefined) {
		if (savedWalkSpeed !== undefined) hum.WalkSpeed = savedWalkSpeed;
		if (savedJumpPower !== undefined) hum.JumpPower = savedJumpPower;
		if (savedJumpHeight !== undefined) hum.JumpHeight = savedJumpHeight;
	}
	savedWalkSpeed = undefined;
	savedJumpPower = undefined;
	savedJumpHeight = undefined;

	setCharacterHidden(false);
	setNameTagEnabled(true);
	dragging = false;
	unlockMouse();
	stopAllEffects();
	vfxLanes = [];
	crate?.track?.Stop(0);

	// The camera never moved, so handing it back is just restoring the mode.
	const cam = camera();
	if (cam !== undefined) {
		if (savedCameraCF !== undefined) cam.CFrame = savedCameraCF;
		cam.CameraType = savedCameraType ?? Enum.CameraType.Custom;
		if (savedCameraSubject !== undefined) cam.CameraSubject = savedCameraSubject;
	}
	savedCameraType = undefined;
	savedCameraCF = undefined;
	savedCameraSubject = undefined;

	rewardGui?.Destroy();
	rewardGui = undefined;
	folder?.Destroy();
	folder = undefined;
	crate = undefined;
	rewardWeapon = undefined;
	rewardWeaponBase = undefined;
	rewardWeaponSpin = false;

	state = "Idle";
	const cb = onDone;
	onDone = undefined;
	cb?.();
}

/**
 * Start the ceremony. Only call once the server has confirmed the roll —
 * `skinId` is what gets revealed at the end.
 */
export function present(caseId: string, skinId: string, rarity: string | undefined, done?: () => void): boolean {
	if (isBusy()) return false;

	const def = Cases.get(caseId);
	const cam = camera();
	if (def === undefined || cam === undefined) {
		done?.();
		return false;
	}

	const built = CrateModel.build(def);
	if (built === undefined) {
		done?.();
		return false;
	}

	state = "Presenting";
	onDone = done;
	pendingSkinId = skinId;
	pendingRarity = rarity;

	// reset animation state
	yaw = 0;
	pitch = 0;
	dragging = false;
	dragDistance = 0;
	punch = 0;
	clicks = 0;
	lidLift = 0;
	lidLiftTarget = 0;
	lidTilt = 0;
	lidTiltTarget = 0;
	lidDetached = false;
	elapsed = 0;
	rewardWeapon = undefined;
	rewardWeaponBase = undefined;
	rewardWeaponSpin = false;

	folder = new Instance("Folder");
	folder.Name = "CratePresentation";
	folder.Parent = Workspace;

	// Lock the camera where it stands, then hang the crate in front of it.
	savedCameraType = cam.CameraType;
	savedCameraCF = cam.CFrame;
	savedCameraSubject = cam.CameraSubject;
	cam.CameraType = Enum.CameraType.Scriptable;

	const cameraPart = sequencePart(CRATE_CAMERA_PART);
	const spawnPart = sequencePart(CRATE_SPAWN_PART);

	if (cameraPart !== undefined) {
		cam.CFrame = cameraPart.CFrame; // authored position and orientation, used exactly
	} else {
		warn(`[Crate] Workspace.${CRATE_SEQUENCE_FOLDER}.${CRATE_CAMERA_PART} not found - using the player's camera`);
		levelCamera(cam); // horizontal + straight ahead, regardless of where the player was looking
	}

	crate = built;
	if (spawnPart !== undefined) {
		baseCF = spawnPart.CFrame; // crate centre lands on the part, rotated to match it
	} else {
		warn(
			`[Crate] Workspace.${CRATE_SEQUENCE_FOLDER}.${CRATE_SPAWN_PART} not found - staging in front of the camera`,
		);
		baseCF = stageCFrame(cam, built.radius, cameraPart);
	}
	print(
		`[Crate] staged ${caseId} at ${string.format("%.1f", cam.CFrame.Position.sub(baseCF.Position).Magnitude)} studs`,
	);
	built.model.Parent = folder;
	built.model.PivotTo(baseCF.mul(built.display).mul(new CFrame(built.centerOffset.mul(-1))));

	// The rig has to be in the world before its animation will load. Then hold it
	// on frame 0 so the crate starts closed rather than in its saved bind pose.
	const track = CrateModel.bindAnimation(built, def);
	if (track !== undefined) {
		track.Play(0);
		track.AdjustWeight(ANIMATION_WEIGHT, 0);
		track.AdjustSpeed(0);
		track.TimePosition = 0;
	}

	buildVfxSchedule();

	setCharacterHidden(true);
	setNameTagEnabled(false);

	// freeze the player so they can't walk away from their own crate
	const hum = humanoid();
	if (hum !== undefined) {
		savedWalkSpeed = hum.WalkSpeed;
		savedJumpPower = hum.JumpPower;
		savedJumpHeight = hum.JumpHeight; // whichever of the two the rig uses
		hum.WalkSpeed = 0;
		hum.JumpPower = 0;
		hum.JumpHeight = 0;
	}

	connectAll();
	return true;
}
