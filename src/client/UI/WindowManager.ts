export type WindowName = "Shop" | "Inventory" | "Trade";

const closers = new Map<WindowName, () => void>();
let active: WindowName | undefined;

// While set, open() refuses to switch to a different window — used to pin the
// live trade screen up so a player can't wander into the shop/inventory mid-trade.
let blocked = false;

export function register(name: WindowName, close: () => void) {
	closers.set(name, close);
}

// Returns false (and does nothing) if blocked and `name` isn't the already-active window.
export function open(name: WindowName): boolean {
	if (blocked && active !== name) return false;

	if (active !== undefined && active !== name) closers.get(active)?.();
	active = name;
	return true;
}

export function setBlocked(value: boolean) {
	blocked = value;
}

export function isBlocked(): boolean {
	return blocked;
}

export function closed(name: WindowName) {
	if (active === name) active = undefined;
}

export function isOpen(name: WindowName): boolean {
	return active === name;
}
