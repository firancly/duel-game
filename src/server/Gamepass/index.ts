import { MarketplaceService, Players } from "@rbxts/services";
import ProfileStore, { Profile } from "@rbxts/profile-store";
import { DEFAULT_PLAYER_GAMEPASS_DATA, PlayerGamepassData } from "./core/GamepassState";
import { Gamepasses, findGamepassById, findGamepassByKey, findGamepassByGiftProductId } from "shared/Gamepasses";
import { Replicator } from "./replication/replicator";
import * as InventoryService from "server/Inventory";

const GamepassStore = ProfileStore.New("PlayerGamepasses", DEFAULT_PLAYER_GAMEPASS_DATA);
const profiles = new Map<Player, Profile<PlayerGamepassData>>();

// Roblox can't buy a GamePass on someone else's behalf, so gifting is our own dev-product
// flow: client picks a recipient, we stash the intent here, THEN prompts the purchase.
// ProcessReceipt (Shop/Monetization.ts) looks the intent up by (buyer, productId) to know
// who to deliver to. Keyed as `${buyerUserId}_${productId}`; array = FIFO for rapid re-buys.
interface GiftIntent {
	recipientUserId: number;
	key: string;
}
const pendingGifts = new Map<string, GiftIntent[]>();

function giftIntentKey(buyerUserId: number, productId: number): string {
	return `${buyerUserId}_${productId}`;
}

interface GiftMessage {
	[field: string]: ProfileStore.JSONAcceptable;
	type: "Gift";
	key: string;
}

function verifyOwnership(player: Player, profile: Profile<PlayerGamepassData>) {
	for (const gp of Gamepasses) {
		if (profile.Data.owned[gp.key] === true) continue; // already confirmed, ownership never revokes
		if (gp.id === 0) continue; // placeholder id, not published yet

		const [ok, owns] = pcall(() =>
			MarketplaceService.UserOwnsGamePassAsync(player.UserId as unknown as User, gp.id),
		);
		if (ok && owns) profile.Data.owned[gp.key] = true;
	}
}

function onPlayerAdded(player: Player) {
	const profile = GamepassStore.StartSessionAsync(`${player.UserId}`, {
		Cancel: () => player.Parent !== Players,
	}) as Profile<PlayerGamepassData> | undefined;

	if (profile === undefined || player.Parent !== Players) {
		profile?.EndSession();
		player.Kick("Failed to load gamepass profile. Rejoin");
		return;
	}

	profile.Reconcile();
	profile.AddUserId(player.UserId);

	// DEV CONDITION: resets gamepass ownership in-memory after the session is already live, so
	// a dev rejoin looks like a fresh load
	if (player.UserId === 11170246) profile.Data.owned = {};

	profile.OnSessionEnd.Connect(() => {
		profiles.delete(player);
		player.Kick("Your data session ended. Rejoin to continue playing.");
	});

	// Gifts sent while this player was offline (or on another server) arrive here —
	// ProfileStore replays any unprocessed message the moment a session starts.
	profile.MessageHandler<GiftMessage>((message, processed) => {
		if (message.type === "Gift" && typeIs(message.key, "string")) grantOwnership(player, profile, message.key);
		processed();
	});

	profiles.set(player, profile);
	verifyOwnership(player, profile);
	Replicator.sendInit(player, profile.Data);

	print("[GamepassService] Loaded gamepasses for:", player.Name);
}

function grantOwnership(player: Player, profile: Profile<PlayerGamepassData>, key: string) {
	print(
		`[GamepassService][DEBUG] grantOwnership(${player.Name}, "${key}") already owned: ${profile.Data.owned[key]}`,
	);
	if (profile.Data.owned[key] === true) return; // already had it, nothing to replicate
	profile.Data.owned[key] = true;
	Replicator.sendOwn(player, key);

	// Some passes (e.g. SetClown, LimitedBundle) bundle a fixed skin set, grant it once, here,
	// at the exact moment ownership flips false->true.
	const gp = findGamepassByKey(key);
	print(`[GamepassService][DEBUG] "${key}" skinIds: ${gp?.skinIds !== undefined ? gp.skinIds.join(",") : "NONE"}`);
	for (const skinId of gp?.skinIds ?? []) {
		const result = InventoryService.addItem(player, skinId);
		print(`[GamepassService][DEBUG] addItem(${player.Name}, "${skinId}") ->`, result);
	}
}

function onPlayerRemoving(player: Player) {
	profiles.get(player)?.EndSession();
	profiles.delete(player);
}

function onPromptFinished(player: Player, gamePassId: number, wasPurchased: boolean) {
	print(`[GamepassService][DEBUG] PromptGamePassPurchaseFinished(${player.Name}, ${gamePassId}, ${wasPurchased})`);
	if (!wasPurchased) return;

	const gp = findGamepassById(gamePassId);
	if (gp === undefined) {
		warn(`[GamepassService][DEBUG] no GamepassOffer with id ${gamePassId} — check shared/Gamepasses.ts`);
		return;
	}

	const profile = profiles.get(player);
	if (profile === undefined) {
		warn(`[GamepassService][DEBUG] no loaded profile for ${player.Name} — can't grant ${gp.key}`);
		return;
	}

	grantOwnership(player, profile, gp.key);
	print(`[GamepassService] ${player.Name} purchased ${gp.name}`);
}

// For perk checks elsewhere (2x earnings, VIP, etc.) once those are implemented.
export function hasGamepass(player: Player, key: string): boolean {
	return profiles.get(player)?.Data.owned[key] === true;
}

// True if `recipientUserId` already owns this pass — checks the live player's cache if
// they're on this server, otherwise peeks their saved profile (no session, no cost to them).
function recipientAlreadyOwns(recipientUserId: number, key: string): boolean {
	const recipientPlayer = Players.GetPlayerByUserId(recipientUserId);
	if (recipientPlayer !== undefined) return hasGamepass(recipientPlayer, key);

	const [ok, savedProfile] = pcall(() => GamepassStore.GetAsync(`${recipientUserId}`));
	return ok && savedProfile !== undefined && savedProfile.Data.owned[key] === true;
}

// Delivers ownership right now if the recipient's profile is loaded on this server,
// otherwise queues it through ProfileStore so it lands whenever they're next online.
// Exported so Monetization.ts can fall back to granting the buyer directly when a gift
// receipt shows up with no recorded intent (Robux already spent, can't refund via API).
export function deliverGift(recipientUserId: number, key: string) {
	const recipientPlayer = Players.GetPlayerByUserId(recipientUserId);
	const recipientProfile = recipientPlayer !== undefined ? profiles.get(recipientPlayer) : undefined;

	if (recipientPlayer !== undefined && recipientProfile !== undefined) {
		grantOwnership(recipientPlayer, recipientProfile, key);
		return;
	}

	const message: GiftMessage = { type: "Gift", key };
	GamepassStore.MessageAsync(`${recipientUserId}`, message);
}

// C->S: buyer picked a friend + pass in the gift UI, right before prompting the Robux purchase.
// Records who should receive it so ProcessReceipt (Shop/Monetization.ts) knows where to deliver.
export function requestGift(
	buyer: Player,
	recipientUserId: number,
	key: string,
): { ok: true } | { ok: false; reason: string } {
	const gp = findGamepassByKey(key);
	if (gp === undefined || gp.giftProductId === undefined || gp.giftProductId === 0) {
		return { ok: false, reason: "NOT_GIFTABLE" };
	}
	if (recipientUserId === buyer.UserId) return { ok: false, reason: "SELF" };
	if (recipientAlreadyOwns(recipientUserId, key)) return { ok: false, reason: "ALREADY_OWNS" };

	const intentKey = giftIntentKey(buyer.UserId, gp.giftProductId);
	const queue = pendingGifts.get(intentKey) ?? [];
	queue.push({ recipientUserId, key });
	pendingGifts.set(intentKey, queue);

	return { ok: true };
}

// Called from Shop/Monetization.ts's ProcessReceipt once a gift Developer Product is paid for.
// Returns the recipient delivered to, or undefined if there was no matching intent (e.g. the
// product was bought outside the gift flow) — in that case the Robux is non-refundable via API,
// so the caller should fall back to granting the buyer instead of losing the purchase entirely.
export function fulfillGiftReceipt(buyerUserId: number, productId: number): number | undefined {
	const gp = findGamepassByGiftProductId(productId);
	if (gp === undefined) return undefined;

	const intentKey = giftIntentKey(buyerUserId, productId);
	const queue = pendingGifts.get(intentKey);
	const intent = queue?.shift();
	if (queue !== undefined && queue.size() === 0) pendingGifts.delete(intentKey);
	if (intent === undefined) return undefined;

	deliverGift(intent.recipientUserId, intent.key);
	return intent.recipientUserId;
}

export function init() {
	Players.PlayerAdded.Connect(onPlayerAdded);
	Players.PlayerRemoving.Connect(onPlayerRemoving);
	for (const player of Players.GetPlayers()) onPlayerAdded(player);

	MarketplaceService.PromptGamePassPurchaseFinished.Connect(onPromptFinished);

	Replicator.onAskForGamepasses((player) => {
		const profile = profiles.get(player);
		return profile !== undefined ? { owned: profile.Data.owned } : undefined;
	});

	Replicator.onRequestGift((player, recipientUserId, key) => requestGift(player, recipientUserId, key));

	if (Gamepasses.some((gp) => gp.id === 0)) {
		warn("[GamepassService] shared/Gamepasses.ts still has placeholder id: 0 entries — those passes won't verify.");
	}

	print("[GamepassService] Initialized");
}
