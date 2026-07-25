import js from "@eslint/js";
import tseslint from "typescript-eslint";
import robloxTs from "eslint-plugin-roblox-ts";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
	{ ignores: ["out/**"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	robloxTs.configs.recommended,
	prettierRecommended,
	{
		rules: {
			"prettier/prettier": "warn",
			"@typescript-eslint/no-unused-vars": "warn",
		},
	},
);
