import { HttpService } from "@rbxts/services";

export default function generate(): string {
	return HttpService.GenerateGUID(false);
}
