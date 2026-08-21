// The case-opening ceremony. Entirely client-side and cosmetic: the server has
// already charged the player, rolled the skin and granted it by the time this
// runs, so nothing here can be exploited for loot.
//
// present() -> the camera locks where it stands and the crate is staged dead
// ahead of it (character hidden locally, so nothing blocks the view). The crate
// sits still until touched: dragging rotates it, and CLICKS_TO_OPEN clicks pop
// the lid. The skin is revealed on a billboard, then finish() tears it all down.
//
// The crate is created on the client inside Workspace, so it is local-only and
// never replicates to other players.

import { Players, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { Cases, CLICKS_TO_OPEN } from "shared/Cases";
import { getDef, Rarity, RarityColor } from "shared/Catalog";
import * as CrateModel from "./CrateModel";
import { Crate } from "./CrateModel";

const player = Players.LocalPlayer;

// tuning
const CRATE_DIST_SCALE = 2.6; // how far ahead of the camera, as a multiple of the crate's largest extent
const CRATE_MIN_DIST = 10;
const DRAG_SENSITIVITY = 0.006; // radians per pixel
const PITCH_LIMIT = 1.0; // radians
const CLICK_SLOP = 8; // pixels of movement still counted as a click, not a drag
const REVEAL_HOLD = 4; // seconds the reward stays up before auto-closing

// Optional sfx — drop your own rbxassetid in, empty string means silent.
const SOUND_CLICK = "";
const SOUND_OPEN = "";

type State = "Idle" | "Presenting" | "Revealed" | "Closing";

let state: State = "Idle";
let session = 0; // bumped on every teardown, invalidates pending task.delay callbacks
let onDone: (() => void) | undefined;

let crate: Crate | undefined;
let folder: Folder | undefined;
let rayParams: RaycastParams | undefined;
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
let pressedOnCrate = false;
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

// The crate is staged directly ahead of the camera, dead centre of the screen.
// The camera itself never moves, so the character stays behind it and out of
// frame — distance back off is driven by how big the crate actually is.
function stageCFrame(cam: Camera, radius: number): CFrame {
	let dist = math.max(CRATE_MIN_DIST, radius * CRATE_DIST_SCALE);

	// If the player is facing a wall, pull the crate in so it doesn't stage inside it.
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = player.Character !== undefined ? [player.Character] : [];

	const hit = Workspace.Raycast(cam.CFrame.Position, cam.CFrame.LookVector.mul(dist), params);
	if (hit !== undefined) dist = math.max(radius * 0.75 + 2, hit.Distance - radius * 0.6);

	return cam.CFrame.mul(new CFrame(0, 0, -dist));
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

// is the player's cursor/finger over the crate?
function hitsCrate(screenPos: Vector3): boolean {
	const cam = camera();
	if (cam === undefined || rayParams === undefined) return false;

	const ray = cam.ViewportPointToRay(screenPos.X, screenPos.Y);
	return Workspace.Raycast(ray.Origin, ray.Direction.mul(60), rayParams) !== undefined;
}

function registerClick() {
	if (crate === undefined) return;

	clicks += 1;
	punch = 1;
	playSound(SOUND_CLICK, crate.root);
	for (const e of crate.burst) e.Emit(12);

	// lid creeps open a little more with every hit
	const progress = math.min(clicks / CLICKS_TO_OPEN, 1);
	lidLiftTarget = progress * 0.35;
	lidTiltTarget = progress * 0.12;

	if (clicks >= CLICKS_TO_OPEN) reveal();
}

function buildBillboard(parent: BasePart, skinId: string, rarity: string | undefined, radius: number) {
	const def = getDef(skinId);
	const color = RarityColor.get((rarity ?? def?.rarity ?? Rarity.Common) as Rarity) ?? new Color3(1, 1, 1);

	const billboard = new Instance("BillboardGui");
	billboard.Name = "Reward";
	billboard.Size = new UDim2(0, 190, 0, 230);
	billboard.StudsOffset = new Vector3(0, math.max(3.4, radius * 0.9), 0);
	billboard.AlwaysOnTop = true;
	billboard.Parent = parent;

	const frame = new Instance("Frame");
	frame.Size = UDim2.fromScale(1, 1);
	frame.BackgroundColor3 = Color3.fromRGB(20, 20, 26);
	frame.BackgroundTransparency = 0.25;
	frame.Parent = billboard;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 12);
	corner.Parent = frame;

	const stroke = new Instance("UIStroke");
	stroke.Color = color;
	stroke.Thickness = 3;
	stroke.Parent = frame;

	const image = new Instance("ImageLabel");
	image.Size = UDim2.fromScale(0.85, 0.6);
	image.Position = UDim2.fromScale(0.075, 0.06);
	image.BackgroundTransparency = 1;
	image.Image = def?.image ?? "";
	image.ScaleType = Enum.ScaleType.Fit;
	image.Parent = frame;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Size = UDim2.fromScale(1, 0.18);
	nameLabel.Position = UDim2.fromScale(0, 0.66);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = def?.name ?? skinId;
	nameLabel.TextColor3 = new Color3(1, 1, 1);
	nameLabel.TextScaled = true;
	nameLabel.Font = Enum.Font.GothamBold;
	nameLabel.Parent = frame;

	const rarityLabel = new Instance("TextLabel");
	rarityLabel.Size = UDim2.fromScale(1, 0.14);
	rarityLabel.Position = UDim2.fromScale(0, 0.83);
	rarityLabel.BackgroundTransparency = 1;
	rarityLabel.Text = rarity ?? def?.rarity ?? "";
	rarityLabel.TextColor3 = color;
	rarityLabel.TextScaled = true;
	rarityLabel.Font = Enum.Font.GothamMedium;
	rarityLabel.Parent = frame;

	// pop in
	billboard.Size = new UDim2(0, 0, 0, 0);
	TweenService.Create(billboard, new TweenInfo(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Size: new UDim2(0, 190, 0, 230),
	}).Play();

	return color;
}

let pendingSkinId: string | undefined;
let pendingRarity: string | undefined;

function reveal() {
	if (crate === undefined || state !== "Presenting") return;
	state = "Revealed";

	const c = crate;
	const skinId = pendingSkinId;

	// lid leaves the model so it can fly off independently of the crate's spin
	lidDetached = true;
	c.lid.Parent = folder;
	playSound(SOUND_OPEN, c.root);
	for (const e of c.burst) e.Emit(60);

	const flyTo = c.lid.CFrame.mul(new CFrame(0, math.max(6, c.radius * 1.5), 0)).mul(
		CFrame.Angles(math.rad(140), math.rad(60), 0),
	);
	TweenService.Create(c.lid, new TweenInfo(0.9, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), {
		CFrame: flyTo,
		Transparency: 1,
	}).Play();

	const color = skinId !== undefined ? buildBillboard(c.root, skinId, pendingRarity, c.radius) : c.light.Color;

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
	pressedOnCrate = hitsCrate(input.Position);

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
	yaw -= dx * DRAG_SENSITIVITY;
	pitch = math.clamp(pitch - dy * DRAG_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
}

function onInputEnded(input: InputObject) {
	if (input.UserInputType !== Enum.UserInputType.MouseButton1 && input.UserInputType !== Enum.UserInputType.Touch)
		return;
	if (!dragging) return;

	const wasClick = dragDistance < CLICK_SLOP && pressedOnCrate;
	dragging = false;
	pressedOnCrate = false;
	unlockMouse();

	if (wasClick && state === "Presenting") registerClick();
}

function onRender(dt: number) {
	if (crate === undefined) return;
	elapsed += dt;

	// The crate only ever moves because the player dragged or clicked it.
	setCharacterHidden(true);

	punch = math.max(0, punch - dt * 4);
	const shake = punch * 0.1;

	// Rotate about the crate's bounding-box centre: models whose pivot sits at
	// the base would otherwise swing in a circle instead of spinning in place.
	const spin = baseCF
		.mul(CFrame.Angles(0, yaw, 0))
		.mul(CFrame.Angles(pitch, 0, 0))
		.mul(CFrame.Angles(math.sin(elapsed * 60) * shake, 0, math.cos(elapsed * 50) * shake));
	crate.model.PivotTo(spin.mul(new CFrame(crate.centerOffset.mul(-1))));

	if (!lidDetached) {
		const a = math.min(1, dt * 8);
		lidLift += (lidLiftTarget - lidLift) * a;
		lidTilt += (lidTiltTarget - lidTilt) * a;
		crate.lid.CFrame = crate.root.CFrame.mul(crate.lidRest)
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
	dragging = false;
	unlockMouse();

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

	folder?.Destroy();
	folder = undefined;
	crate = undefined;
	rayParams = undefined;

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
	pressedOnCrate = false;
	punch = 0;
	clicks = 0;
	lidLift = 0;
	lidLiftTarget = 0;
	lidTilt = 0;
	lidTiltTarget = 0;
	lidDetached = false;
	elapsed = 0;

	folder = new Instance("Folder");
	folder.Name = "CratePresentation";
	folder.Parent = Workspace;

	// Lock the camera where it stands, then hang the crate in front of it.
	savedCameraType = cam.CameraType;
	savedCameraCF = cam.CFrame;
	savedCameraSubject = cam.CameraSubject;
	cam.CameraType = Enum.CameraType.Scriptable;

	crate = built;
	baseCF = stageCFrame(cam, built.radius);
	built.model.Parent = folder;
	built.model.PivotTo(baseCF.mul(new CFrame(built.centerOffset.mul(-1))));

	rayParams = new RaycastParams();
	rayParams.FilterType = Enum.RaycastFilterType.Include;
	rayParams.FilterDescendantsInstances = [built.model];

	setCharacterHidden(true);

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
