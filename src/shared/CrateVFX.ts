// The VFX are a TIMELINE, not keyframe markers: each effect part switches its
// emitters on at `delay` seconds, pulses Emit(amount) every `step` seconds for
// `duration` seconds, then switches off. amount <= 0 means "stay off".
//
// Keyed by effect PART name rather than by box, because the config is keyed
// Box1..Box6 while the crate models are named GreenCase/RedCase/etc. The part
// names (GreenLines, RedFire, ...) are unique per crate, so matching on them
// maps each model to its timings without a lookup table to keep in sync.
//
// Seconds are measured in animation time, so they pause with the crate between
// clicks instead of running away on wall clock.

export interface VfxTiming {
	amount: number; // particles per Emit call
	delay: number; // seconds from the start of the animation
	duration: number; // how long the pulsing lasts
	step: number; // seconds between Emit calls
}

export const CrateVFX = new Map<string, VfxTiming>([
	// Box1 - green
	["greenlines", { amount: 1, delay: 0, duration: 1, step: 0.2 }],
	["greenimpact", { amount: 3, delay: 0.2, duration: 0.1, step: 0.2 }],
	["greenopening", { amount: 1, delay: 0, duration: 2.5, step: 0.2 }],

	// Box2 - blue
	["bluelines", { amount: 1, delay: 0, duration: 1, step: 0.2 }],
	["blueimpact", { amount: 3, delay: 0, duration: 0.1, step: 0.2 }],
	["blueopening", { amount: 1, delay: 2, duration: 2, step: 0.2 }],

	// Box3 - pink
	["pinkswirl", { amount: 1, delay: 0, duration: 5, step: 0.4 }],
	["pinkimpact", { amount: 2, delay: 4, duration: 0.1, step: 0.2 }],
	["pinkopening", { amount: 1, delay: 4.25, duration: 1.35, step: 0.2 }],

	// Box4 - cyan
	["cyanimpact", { amount: 1, delay: 4, duration: 0.2, step: 0.2 }],
	["cyanopening", { amount: 1, delay: 4.2, duration: 1.5, step: 0.2 }],

	// Box5 - yellow
	["yellowimpact", { amount: 1, delay: 5.85, duration: 0.2, step: 0.2 }],
	["yellowopening", { amount: 1, delay: 6, duration: 3, step: 0.2 }],

	// Box6 - red
	["redimpact", { amount: 1, delay: 4.65, duration: 0.2, step: 0.2 }],
	["redfire", { amount: 1, delay: 5, duration: 1.5, step: 0.2 }],
]);

export const ANIMATION_SPEED = 1;
export const ANIMATION_WEIGHT = 1;
