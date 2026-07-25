import { HttpService } from "@rbxts/services";

export default function Generate(): string {
	return HttpService.GenerateGUID(false);
};