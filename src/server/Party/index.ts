// Party system. When a party leader joins a game others get invited.
// create party
// invite players to party
// accept/decline party invite
// leave party
// kick players from party
// disband party

import { HttpService, Players } from "@rbxts/services";
import { remote } from "shared/Remotes";

interface PartyData {
	leader: Player;
	members: Player[]; // includes leader index 0
	invites: Set<Player>;
}

const parties = new Map<string, PartyData>();
const playerParty = new Map<Player, string>();

export const PartyChanged = new Instance("BindableEvent");

const partyInvited = remote("PartyInvited", "RemoteEvent"); // server -> invited player
const partyUpdated = remote("PartyUpdated", "RemoteEvent"); // server -> all members, new member list
const partyInviteRequest = remote("PartyInviteRequest", "RemoteEvent"); // client -> server, leader invites target
const partyInviteResponse = remote("PartyInviteResponse", "RemoteEvent"); // client -> server, accept/decline
const partyLeaveRequest = remote("PartyLeaveRequest", "RemoteEvent"); // client -> server
const partyKickRequest = remote("PartyKickRequest", "RemoteEvent"); // client -> server, leader kicks target

function broadcast(party: PartyData) {
	PartyChanged.Fire(party.leader, party.members);
	for (const member of party.members) partyUpdated.FireClient(member, party.members);
}

function newPartyId(): string {
	return HttpService.GenerateGUID(false);
}

export function isInParty(player: Player): boolean {
	return playerParty.has(player);
}

export function getPartyId(player: Player): string | undefined {
	return playerParty.get(player);
}

export function isLeader(player: Player): boolean {
	const id = playerParty.get(player);
	return id !== undefined && parties.get(id)!.leader === player;
}

export function getMembers(player: Player): Player[] {
	const id = playerParty.get(player);
	if (id === undefined) return [player];
	return [...parties.get(id)!.members];
}

export function createParty(leader: Player): string {
	if (isInParty(leader)) return playerParty.get(leader)!;

	const id = newPartyId();
	parties.set(id, { leader, members: [leader], invites: new Set() });
	playerParty.set(leader, id);
	return id;
}

export function invitePlayer(inviter: Player, target: Player) {
	const id = playerParty.get(inviter) ?? createParty(inviter);
	const party = parties.get(id)!;

	if (party.leader !== inviter) return;
	if (isInParty(target) || party.members.includes(target)) return;

	party.invites.add(target);
	partyInvited.FireClient(target, inviter);
}

export function acceptInvite(player: Player, leader: Player) {
	if (isInParty(player)) return;

	const id = playerParty.get(leader);
	if (id === undefined) return;

	const party = parties.get(id)!;
	if (!party.invites.has(player)) return;

	party.invites.delete(player);
	party.members.push(player);
	playerParty.set(player, id);
	broadcast(party);
}

export function declineInvite(player: Player, leader: Player) {
	const id = playerParty.get(leader);
	if (id === undefined) return;
	parties.get(id)!.invites.delete(player);
}

export function kickMember(leader: Player, target: Player) {
	const id = playerParty.get(leader);
	if (id === undefined) return;

	const party = parties.get(id)!;
	if (party.leader !== leader || target === leader) return;

	removeMember(party, target);
}

export function leaveParty(player: Player) {
	const id = playerParty.get(player);
	if (id === undefined) return;

	const party = parties.get(id)!;
	if (party.leader === player) {
		disbandParty(player);
		return;
	}

	removeMember(party, player);
}

export function disbandParty(leader: Player) {
	const id = playerParty.get(leader);
	if (id === undefined) return;

	const party = parties.get(id)!;
	if (party.leader !== leader) return;

	for (const member of party.members) playerParty.delete(member);
	parties.delete(id);

	party.members = [];
	broadcast(party);
}

function removeMember(party: PartyData, target: Player) {
	const idx = party.members.indexOf(target);
	if (idx === -1) return;

	party.members.remove(idx);
	playerParty.delete(target);
	broadcast(party);
}

function onPlayerRemoving(player: Player) {
	if (isLeader(player)) disbandParty(player);
	else leaveParty(player);
}

export function init() {
	partyInviteRequest.OnServerEvent.Connect((player, target) => {
		if (typeIs(target, "Instance") && target.IsA("Player")) invitePlayer(player, target);
	});

	partyInviteResponse.OnServerEvent.Connect((player, leader, accepted) => {
		if (!typeIs(leader, "Instance") || !leader.IsA("Player")) return;
		if (accepted === true) acceptInvite(player, leader);
		else declineInvite(player, leader);
	});

	partyLeaveRequest.OnServerEvent.Connect((player) => leaveParty(player));

	partyKickRequest.OnServerEvent.Connect((player, target) => {
		if (typeIs(target, "Instance") && target.IsA("Player")) kickMember(player, target);
	});

	Players.PlayerRemoving.Connect(onPlayerRemoving);

	print("[Party Service] Initialized");
}
