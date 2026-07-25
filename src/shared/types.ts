export interface ItemData {
	id: string;
	description: string;
	image: string;
	amount: number;
	isGamepas?: boolean;
	rarity?: string;
	droppable?: boolean;
	type: string;
}

export interface DragStateTable {
	id: number;
	sourceSlot: unknown;
	mouseOffSet: Vector2;
}
