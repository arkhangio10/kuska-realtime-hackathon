import { describe, expect, it } from "vitest";
import { actorsFromPresence, applyCollaborationEvent, normalizePortalEvent, portalPayloadBytes, PORTAL_EVENT_MAX_BYTES, type CollaborationState, type RealtimeEvent } from "./realtime-events";

const users = [
  { id: "client-ana", senderId: "portal-ana", alias: "Ana", role: "Vecina de la zona" },
  { id: "client-luz", senderId: "portal-luz", alias: "Luz", role: "Brigadista comunitario" },
  { id: "client-diego", senderId: "portal-diego", alias: "Diego", role: "Comerciante local" },
  { id: "client-ines", senderId: "portal-ines", alias: "Inés", role: "Especialista técnico" },
];

const realProblems = [
  { caseId: "japan-earthquake", proposal: "Verificar estructuras dañadas y señalizar rutas inspeccionadas antes de movilizar personas." },
  { caseId: "congo-wildfire", proposal: "Confirmar el perímetro del incendio y activar una red vecinal para comunicar cambios del humo." },
  { caseId: "philippines-flood", proposal: "Validar cruces transitables y organizar apoyo para hogares con barreras de movilidad." },
];

const emptyState = (): CollaborationState => ({ proposals: [], votes: [], chat: [] });
const actor = (user: typeof users[number]) => ({ id: user.id, alias: user.alias, role: user.role, kind: "human" as const });

describe("Portal realtime collaboration", () => {
  it("binds the user identity to Portal's verified sender instead of trusting message content", () => {
    const event: RealtimeEvent = { eventId: "vote-1", kind: "vote.cast", createdAt: new Date().toISOString(), actor: actor(users[0]), vote: { proposalId: "proposal-1", actorId: "spoofed-user", value: "agree" } };
    const normalized = normalizePortalEvent(event, users[0].senderId);
    expect(normalized?.actor.id).toBe("portal-ana");
    expect(normalized?.kind === "vote.cast" && normalized.vote.actorId).toBe("portal-ana");
  });

  it.each(realProblems)("converges four user replicas for $caseId", ({ caseId, proposal }) => {
    const proposalId = `${caseId}-proposal`;
    const rawEvents: RealtimeEvent[] = [
      { eventId: `${caseId}-created`, kind: "proposal.created", createdAt: new Date().toISOString(), actor: actor(users[0]), proposal: { id: proposalId, text: proposal, author: actor(users[0]), createdAt: new Date().toISOString() } },
      ...users.slice(0, 3).map((user, index): RealtimeEvent => ({ eventId: `${caseId}-vote-${index}`, kind: "vote.cast", createdAt: new Date().toISOString(), actor: actor(user), vote: { proposalId, actorId: user.id, value: index === 2 ? "concern" : "agree" } })),
      { eventId: `${caseId}-chat`, kind: "chat.created", createdAt: new Date().toISOString(), actor: actor(users[3]), chat: { id: `${caseId}-question`, alias: users[3].alias, text: "¿Qué evidencia falta verificar antes de ejecutar esta opción?", kind: "human" } },
    ];
    const senders = [users[0].senderId, users[0].senderId, users[1].senderId, users[2].senderId, users[3].senderId];
    const normalized = rawEvents.map((event, index) => normalizePortalEvent(event, senders[index])).filter((event): event is RealtimeEvent => Boolean(event));
    const replicas = users.map(() => normalized.reduce(applyCollaborationEvent, emptyState()));
    replicas.forEach(replica => expect(replica).toEqual(replicas[0]));
    expect(replicas[0].proposals).toHaveLength(1);
    expect(replicas[0].votes).toHaveLength(3);
    expect(replicas[0].chat).toHaveLength(1);
    expect(normalized.every(event => portalPayloadBytes(event) <= PORTAL_EVENT_MAX_BYTES)).toBe(true);
  });

  it("deduplicates redelivered proposals and replaces a user's previous vote", () => {
    const baseActor = actor(users[0]);
    const proposalEvent = normalizePortalEvent({ eventId: "p-event", kind: "proposal.created", createdAt: "2026-08-08", actor: baseActor, proposal: { id: "p-1", text: "Validar una ruta local antes de comunicar que está disponible.", author: baseActor, createdAt: "2026-08-08" } }, users[0].senderId)!;
    const agree = normalizePortalEvent({ eventId: "v-1", kind: "vote.cast", createdAt: "2026-08-08", actor: baseActor, vote: { proposalId: "p-1", actorId: baseActor.id, value: "agree" } }, users[0].senderId)!;
    const concern = normalizePortalEvent({ eventId: "v-2", kind: "vote.cast", createdAt: "2026-08-08", actor: baseActor, vote: { proposalId: "p-1", actorId: baseActor.id, value: "concern" } }, users[0].senderId)!;
    const result = [proposalEvent, proposalEvent, agree, concern].reduce(applyCollaborationEvent, emptyState());
    expect(result.proposals).toHaveLength(1);
    expect(result.votes).toEqual([{ proposalId: "p-1", actorId: "portal-ana", value: "concern" }]);
  });

  it("derives remote participants from detailed presence and excludes the local session", () => {
    const people = actorsFromPresence({ kind: "detailed", count: 2, participants: [
      { id: "portal-self", metadata: { alias: "Yo", role: "Personal de salud" } },
      { id: "portal-remote", metadata: { alias: "María", role: "Vecina de la zona" } },
    ] }, "portal-self");
    expect(people).toEqual([{ id: "portal-remote", alias: "María", role: "Vecina de la zona", kind: "human" }]);
  });
});
