// One mission as the client sees it: definition and progress already merged.
export interface MissionView {
	id: string;
	description: string;
	progress: number;
	target: number;
	reward: number; // potions
	completed: boolean;
}
