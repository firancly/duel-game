import { ReplicatedStorage, TextChatService } from "@rbxts/services";

// Server-broadcast system messages (party/matchmaking/etc) arrive here and get
// displayed locally — DisplaySystemMessage only works from the client.
const announceRemote = ReplicatedStorage.WaitForChild("Remotes").WaitForChild("Announce") as RemoteEvent;

announceRemote.OnClientEvent.Connect((msg: string) => {
	const channels = TextChatService.FindFirstChild("TextChannels");
	const general = channels?.FindFirstChild("RBXGeneral") as TextChannel | undefined;
	general?.DisplaySystemMessage(msg);
});
