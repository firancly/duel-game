// Payload the server attaches to the CaseResult event, next to the chat text.
// The client needs the rolled skin up front so the crate ceremony can spawn
// already knowing what it will reveal (no "waiting for server" state mid-animation).
export interface CaseResultPayload {
	ok: boolean;
	caseId: string;
	skinId?: string;
	rarity?: string;
}
