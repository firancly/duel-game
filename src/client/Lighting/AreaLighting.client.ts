import { Lighting, Players, TweenService, Workspace } from "@rbxts/services";

// Lighting is global per client, so "area lighting" is faked: while the player's
// character is inside the lobby part the lighting is whatever Studio has set (captured
// at startup), and anywhere else it tweens to the OUTSIDE_LIGHTING values below.

const AREAS_FOLDER_NAME = "LightingAreas"; // Workspace folder holding the area parts
const LOBBY_AREA_NAME = "Lobby"; // part in it enclosing the lobby (invisible, non-collidable)
const CHECK_INTERVAL = 0.25; // seconds between inside/outside checks
const TWEEN_SECONDS = 0.6;

interface LightingValues {
	Ambient: Color3;
	OutdoorAmbient: Color3;
	Brightness: number;
	ClockTime: number;
	ExposureCompensation: number;
}

// Applied when the player is NOT inside the lobby area. Anything left out keeps the
// lobby's value. TEST values (bright midday sun) - tune these to the look you want.
const OUTSIDE_LIGHTING: Partial<LightingValues> = {
	Ambient: Color3.fromRGB(190, 190, 190),
	OutdoorAmbient: Color3.fromRGB(215, 215, 205),
	Brightness: 4,
	ClockTime: 12,
	ExposureCompensation: 0.4,
};

const player = Players.LocalPlayer;
const tweenInfo = new TweenInfo(TWEEN_SECONDS, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);

function captureLighting(): LightingValues {
	return {
		Ambient: Lighting.Ambient,
		OutdoorAmbient: Lighting.OutdoorAmbient,
		Brightness: Lighting.Brightness,
		ClockTime: Lighting.ClockTime,
		ExposureCompensation: Lighting.ExposureCompensation,
	};
}

// Whatever Studio had set is the lobby look.
const lobbyLighting = captureLighting();
const outsideLighting: LightingValues = { ...lobbyLighting, ...OUTSIDE_LIGHTING };

let lobbyArea: BasePart | undefined;
let warnedMissing = false;
let current: "lobby" | "outside" | undefined;

function findLobbyArea(): BasePart | undefined {
	if (lobbyArea !== undefined && lobbyArea.Parent !== undefined) return lobbyArea;

	const found = Workspace.FindFirstChild(AREAS_FOLDER_NAME)?.FindFirstChild(LOBBY_AREA_NAME);
	lobbyArea = found !== undefined && found.IsA("BasePart") ? found : undefined;
	return lobbyArea;
}

function isInside(part: BasePart, position: Vector3): boolean {
	const offset = part.CFrame.PointToObjectSpace(position);
	const half = part.Size.div(2);
	return math.abs(offset.X) <= half.X && math.abs(offset.Y) <= half.Y && math.abs(offset.Z) <= half.Z;
}

function apply(area: "lobby" | "outside") {
	if (current === area) return;
	current = area;
	TweenService.Create(Lighting, tweenInfo, area === "lobby" ? lobbyLighting : outsideLighting).Play();
}

task.spawn(() => {
	while (true) {
		task.wait(CHECK_INTERVAL);

		const root = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (root === undefined) continue;

		const area = findLobbyArea();
		if (area === undefined) {
			if (!warnedMissing) {
				warnedMissing = true;
				warn(
					`[AreaLighting] Workspace.${AREAS_FOLDER_NAME}.${LOBBY_AREA_NAME} not found - lighting left as is`,
				);
			}
			continue;
		}

		apply(isInside(area, root.Position) ? "lobby" : "outside");
	}
});
