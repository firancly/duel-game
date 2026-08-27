export type WindowName = "Shop" | "Inventory" | "Trade";

const closers = new Map<WindowName, () => void>();
let active: WindowName | undefined;

export function register(name: WindowName, close: () => void) {
	closers.set(name, close);
}

export function open(name: WindowName) {
	if (active !== undefined && active !== name) closers.get(active)?.();
	active = name;
}

export function closed(name: WindowName) {
	if (active === name) active = undefined;
}

export function isOpen(name: WindowName): boolean {
	return active === name;
}
