import { z } from "zod";
import { actorSchema, proposalInput, type Actor, type Proposal, type VoteRecord } from "./kuska";

const voteSchema = z.object({ proposalId: z.string().min(1).max(80), actorId: z.string().min(1).max(120), value: z.enum(["agree", "concern", "pass"]) });
const proposalSchema = z.object({
  id: z.string().min(1).max(80), text: proposalInput, author: actorSchema, createdAt: z.string().min(1).max(60),
  bridge: z.boolean().optional(), basedOn: z.array(z.string().max(80)).max(6).optional(), generation: z.enum(["openai", "fallback"]).optional(),
});
const chatSchema = z.object({ id: z.string().min(1).max(80), alias: z.string().min(1).max(50), text: z.string().min(1).max(180), kind: z.literal("human") });

export const realtimeEventSchema = z.discriminatedUnion("kind", [
  z.object({ eventId: z.string().min(1).max(100), kind: z.literal("proposal.created"), createdAt: z.string().min(1).max(60), actor: actorSchema, proposal: proposalSchema }),
  z.object({ eventId: z.string().min(1).max(100), kind: z.literal("vote.cast"), createdAt: z.string().min(1).max(60), actor: actorSchema, vote: voteSchema }),
  z.object({ eventId: z.string().min(1).max(100), kind: z.literal("chat.created"), createdAt: z.string().min(1).max(60), actor: actorSchema, chat: chatSchema }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export const PORTAL_EVENT_MAX_BYTES = 1_900;

export function portalPayloadBytes(event: RealtimeEvent) {
  return new TextEncoder().encode(JSON.stringify(event)).byteLength;
}

export function normalizePortalEvent(content: unknown, senderId: string): RealtimeEvent | null {
  const parsed = realtimeEventSchema.safeParse(content);
  if (!parsed.success || !senderId) return null;
  const actor: Actor = { ...parsed.data.actor, id: senderId, kind: "human" };
  if (parsed.data.kind === "proposal.created") return { ...parsed.data, actor, proposal: { ...parsed.data.proposal, author: actor } };
  if (parsed.data.kind === "vote.cast") return { ...parsed.data, actor, vote: { ...parsed.data.vote, actorId: senderId } };
  return { ...parsed.data, actor, chat: { ...parsed.data.chat, alias: actor.alias, kind: "human" } };
}

type PresenceLike = { kind: "detailed"; participants: Array<{ id: string; metadata?: Record<string, unknown> }>; count: number } | { kind: "aggregate"; count: number } | undefined;

const safeText = (value: unknown, fallback: string, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;

export function actorsFromPresence(presence: PresenceLike, selfId?: string): Actor[] {
  if (!presence || presence.kind !== "detailed") return [];
  return presence.participants.filter(person => person.id !== selfId).map(person => ({
    id: person.id,
    alias: safeText(person.metadata?.alias, "Participante", 50),
    role: safeText(person.metadata?.role, "Perspectiva comunitaria", 80),
    kind: "human" as const,
  }));
}

export type CollaborationState = {
  proposals: Proposal[];
  votes: VoteRecord[];
  chat: Array<{ id: string; alias: string; text: string; kind: "human" | "demo-agent" }>;
};

export function applyCollaborationEvent(state: CollaborationState, event: RealtimeEvent): CollaborationState {
  if (event.kind === "proposal.created") return { ...state, proposals: state.proposals.some(item => item.id === event.proposal.id) ? state.proposals : [...state.proposals, event.proposal] };
  if (event.kind === "vote.cast") return { ...state, votes: [...state.votes.filter(item => !(item.proposalId === event.vote.proposalId && item.actorId === event.vote.actorId)), event.vote] };
  return { ...state, chat: state.chat.some(item => item.id === event.chat.id) ? state.chat : [...state.chat, event.chat] };
}
