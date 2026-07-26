import { Debris, ServerStorage } from "@rbxts/services";
import Settings from "shared/Settings";
import { Workspace } from "@rbxts/services";

const toolStorage = ServerStorage.FindFirstChild("Tools") as Folder | undefined;

export class ItemSpawner {
	// Spawn tool in player's character
	static spawnTool(player: Player, itemId: string, metadata?: Map<string, unknown>): Tool | undefined {
		if (player.Character === undefined) {
			warn("[ItemSpawner] Cannot spawn tool - player has no character:", player.Name);
			return undefined;
		}

		if (toolStorage === undefined) {
			warn("[ItemSpawner] Tools folder not found in ServerStorage");
			return undefined;
		}

		const toolTemplate = toolStorage.FindFirstChild(itemId) as Tool | undefined;
		if (toolTemplate === undefined) {
			warn("[ItemSpawner] Tool not found in storage:", itemId);
			return undefined;
		}

		const toolClone = toolTemplate.Clone();

		// Apply metadata as attributes
		if (metadata !== undefined) {
			for (const [key, value] of metadata) {
				toolClone.SetAttribute(key, value as AttributeValue | undefined);
			}
		}

		toolClone.Parent = player.Character ?? player.CharacterAdded.Wait()[0];
		return toolClone;
	}

	// Despawn tool for player
	static despawnTool(player: Player, tool: Tool) {
		if (tool !== undefined && tool.Parent === player.Character) {
			Debris.AddItem(tool, 0);
		}
	}

	// Drop tool into world
	static dropTool(player: Player, itemId: string, amount: number, metadata?: Map<string, unknown>) {
		const character = player.Character;
		if (character === undefined) {
			return;
		}

		const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (hrp === undefined) {
			return;
		}

		if (toolStorage === undefined) {
			warn("[ItemSpawner] Tools folder not found in ServerStorage");
			return;
		}

		const toolTemplate = toolStorage.FindFirstChild(itemId);
		if (toolTemplate === undefined) {
			warn("[ItemSpawner] Tool not found for drop:", itemId);
			return;
		}

		const pickup = toolTemplate.Clone() as Tool;

		// Apply metadata
		if (metadata !== undefined) {
			for (const [key, value] of metadata) {
				pickup.SetAttribute(key, value as AttributeValue | undefined);
			}
		}

		// Set amount attribute for pickup (parser expects Amount)
		pickup.SetAttribute("Amount", amount);

		// Calculate drop position
		const rootCframe = hrp.CFrame;
		const dropOffset = rootCframe.LookVector.mul(Settings.Gameplay.dropDistance);
		const dropPosition = rootCframe.Position.add(dropOffset);

		// Position and parent to workspace
		if (pickup.IsA("Tool")) {
			const handle = pickup.FindFirstChild("Handle") as BasePart;
			if (handle !== undefined && handle.IsA("BasePart")) {
				handle.CFrame = new CFrame(dropPosition);
			} else {
				pickup.PivotTo(new CFrame(dropPosition));
			}
		}

		pickup.Parent = Workspace;

		// TODO: Add pickup interaction script or CollectionService tag
	}
}
