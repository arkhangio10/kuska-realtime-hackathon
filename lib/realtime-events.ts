import { z } from "zod";
import { actorSchema, proposalInput, type Actor, type Proposal, type VoteRecord } from "./kuska";

const voteSchema = z.object({ proposalId: z.string().min(1).max(80), actorId: z.string().min(1).max(120), value: z.enum(["agree", "concern", "pass"]) });
const proposalSchema = z.object({
  id: z.string().min(1).max(80), text: proposalInput, author: actorSchema, createdAt: z.string().min(1).max(60),
  bridge: z.boolean().optional(), basedOn: z.array(z.string().max(80)).max(6).optional(), generation: z.enum(["openai", "fallback"]).optional(),
});
const chatSchema = z.object({ id: z.string().min(1).max(80), alias: z.string().min(1).max(50), text: z.string().min(1).max(180), kind: z.literal("human") });
const alternativeProposalSchema = proposalSchema.extend({ text: z.string().trim().min(12).max(300) }).refine(proposal => proposal.author.kind === "agent" && Boolean(proposal.generation), { message: "La alternativa compartida debe identificar su origen de facilitación." });

export const realtimeEventSchema = z.discriminatedUnion("kind", [
  z.object({ eventId: z.string().min(1).max(100), kind: z.literal("proposal.created"), createdAt: z.string().min(1).max(60), actor: actorSchema, proposal: proposalSchema }),
  z.object({ eventId: z.string().min(1).max(100), kind: z.literal("alternative.created"), createdAt: z.string().min(1).max(60), actor: actorSchema, proposal: alternativeProposalSchema }),
  z.object({ eventId: z.string().min(1).max(100), kind: z.literal("vote.cast"), createdAt: z.string().min(1).max(60), actor: actorSchema, vote: voteSchema }),
  z.object({ eventId: z.string().min(1).max(100), kind: z.literal("chat.created"), createdAt: z.string().min(1).max(60), actor: actorSchema, chat: chatSchema }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export const worldPositionSchema = z.object({
  x: z.number().finite().min(-12).max(12),
  z: z.number().finite().min(-12).max(12),
  rotation: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2),
  moving: z.boolean(),
  visible: z.boolean(),
});
export const spatialEventSchema = z.object({
  kind: z.literal("player.moved"),
  sentAt: z.number().int().positive(),
  actor: actorSchema,
  position: worldPositionSchema,
});
export type WorldPosition = z.infer<typeof worldPositionSchema>;
export type SpatialEvent = z.infer<typeof spatialEventSchema>;
export type RemoteWorldPlayer = SpatialEvent & { receivedAt: number };
export type RealtimePayload = RealtimeEvent | SpatialEvent;
export const PORTAL_EVENT_MAX_BYTES = 1_900;

export function portalPayloadBytes(event: unknown) {
  return new TextEncoder().encode(JSON.stringify(event)).byteLength;
}

export function normalizePortalEvent(content: unknown, senderId: string): RealtimeEvent | null {
  const parsed = realtimeEventSchema.safeParse(content);
  if (!parsed.success || !senderId) return null;
  const actor: Actor = { ...parsed.data.actor, id: senderId, kind: "human" };
  if (parsed.data.kind === "proposal.created") return { ...parsed.data, actor, proposal: { ...parsed.data.proposal, author: actor } };
  if (parsed.data.kind === "alternative.created") return { ...parsed.data, actor };
  if (parsed.data.kind === "vote.cast") return { ...parsed.data, actor, vote: { ...parsed.data.vote, actorId: senderId } };
  return { ...parsed.data, actor, chat: { ...parsed.data.chat, alias: actor.alias, kind: "human" } };
}

export function normalizeSpatialEvent(content: unknown, senderId: string): SpatialEvent | null {
  const parsed = spatialEventSchema.safeParse(content);
  if (!parsed.success || !senderId) return null;
  return { ...parsed.data, actor: { ...parsed.data.actor, id: senderId, kind: "human" } };
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
  if (event.kind === "proposal.created" || event.kind === "alternative.created") return { ...state, proposals: state.proposals.some(item => item.id === event.proposal.id) ? state.proposals : [...state.proposals, event.proposal] };
  if (event.kind === "vote.cast") return { ...state, votes: [...state.votes.filter(item => !(item.proposalId === event.vote.proposalId && item.actorId === event.vote.actorId)), event.vote] };
  return { ...state, chat: state.chat.some(item => item.id === event.chat.id) ? state.chat : [...state.chat, event.chat] };
}
