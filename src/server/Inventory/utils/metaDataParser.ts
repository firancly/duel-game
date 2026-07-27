// src/server/StowayServerV1.2/Utils/MetadataParser.luau
// Parses metadata from Tool attributes
// Note: "Amount" is extracted separately and excluded from metadata

import { ServerStorage } from "@rbxts/services";
const ToolStorage = ServerStorage.FindFirstChild("Tools") as Folder | undefined;

// Fields that should NOT be in metadata (they're used as item properties)
const EXCLUDED_FIELDS: Record<string, boolean> = {
	Amount: true, // Amount is item.Amount, not metadata
	StackAmount: true, // Legacy drop attribute, normalize to Amount
};
export class MetaDataParser {
	// Parse metadata from a Tool's attributes (excludes Amount and other reserved fields)
	static fromTool(tool: Tool): [Map<string, unknown> | undefined, number | undefined] {
		if (!tool.IsA("Tool")) {
			return [undefined, undefined];
		}

		const attributes = tool.GetAttributes();
		const metadata = new Map<string, unknown>();

		let amount = attributes.get("Amount");
		if (amount === undefined) {
			// Backward compatibility for older dropped pickups.
			amount = attributes.get("StackAmount");
		}

		if (typeIs(amount, "string")) amount = tonumber(amount);
		if (!typeIs(amount, "number")) amount = undefined;
		if (tool.TextureId !== "") metadata.set("Image", tool.TextureId);

		for (const [key, value] of attributes) {
			if (EXCLUDED_FIELDS[key] === undefined) {
				metadata.set(key, value);
			}
		}

		// Return undefined if no metadata keys, otherwise return the table
		const finalMeta = metadata.size() > 0 ? metadata : undefined;
		return [finalMeta, amount as number | undefined];
	}

	// Get metadata from a tool template by itemId
	// Returns: metadata, defaultAmount
	static fromItemId(itemId: string): [Map<string, unknown> | undefined, number | undefined] {
		if (ToolStorage === undefined) {
			warn("[MetadataParser] Tools folder not found in ServerStorage");
			return [undefined, undefined];
		}

		const toolTemplate = ToolStorage.FindFirstChild(itemId);
		if (toolTemplate?.IsA("Tool")) {
			return this.fromTool(toolTemplate);
		}

		return [undefined, undefined];
	}

	// Merge base metadata with overrides
	static merge(base?: Map<string, unknown>, overrides?: Map<string, unknown>): Map<string, unknown> {
		const result = new Map<string, unknown>();

		// Copy base
		if (base) {
			for (const [k, v] of base) {
				result.set(k, v);
			}
		}

		// Apply overrides
		if (overrides) {
			for (const [k, v] of overrides) {
				result.set(k, v);
			}
		}

		return result;
	}
}
