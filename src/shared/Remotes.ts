import { ReplicatedStorage } from "@rbxts/services";

function remotesFolder(): Folder {
	let f = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (f === undefined) {
		f = new Instance("Folder");
		f.Name = "Remotes";
		f.Parent = ReplicatedStorage;
	}
	return f;
}

const remotes = remotesFolder();

// Find-or-create a remote by name + class. One shared "Remotes" folder for every system.
export function remote<T extends keyof CreatableInstances>(name: string, cls: T): CreatableInstances[T] {
	let r = remotes.FindFirstChild(name) as CreatableInstances[T] | undefined;
	if (r === undefined) {
		r = new Instance(cls);
		r.Name = name;
		r.Parent = remotes;
	}
	return r;
}
