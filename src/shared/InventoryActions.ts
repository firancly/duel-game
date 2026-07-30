import { WeaponSlot } from "./Catalog";

export interface InitPayload {
	owned: { [id: string]: number };
	equipped: { [slot: string]: string };
}
export interface AddRemovePayload {
	id: string;
	count: number;
}
export interface EquipPayload {
	slot: WeaponSlot;
	id: string;
}
