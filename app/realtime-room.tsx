"use client";

import { Portal } from "@portalsdk/core";
import { PortalProvider, useChannel } from "@portalsdk/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { CHANNEL_ID, type Actor } from "@/lib/kuska";
import { actorsFromPresence, normalizePortalEvent, portalPayloadBytes, PORTAL_EVENT_MAX_BYTES, type RealtimeEvent } from "@/lib/realtime-events";
export type { RealtimeEvent } from "@/lib/realtime-events";

export type RealtimeRoomHandle = { publish: (event: RealtimeEvent) => Promise<boolean> };
export type RealtimeState = { status: string; people: number; connected: boolean; selfId?: string; participants: Actor[] };

const key = process.env.NEXT_PUBLIC_PORTAL_API_KEY?.trim();
const portal = key ? new Portal({ apiKey: key }) : null;

type Props = { caseId: string; actor: Actor; onEvent: (event: RealtimeEvent) => void; onState: (state: RealtimeState) => void };

const ConnectedRoom = forwardRef<RealtimeRoomHandle, Props>(function ConnectedRoom({ caseId, actor, onEvent, onState }, ref) {
  const channelId = `${CHANNEL_ID}:${caseId}`;
  const metadata = useMemo(() => ({ alias: actor.alias, role: actor.role, kind: "human" }), [actor.alias, actor.role]);
  const { messages, send, status, presence, me } = useChannel<RealtimeEvent>({ channelId, history: 80, readOn: "visible", metadata });
  const seen = useRef(new Set<string>());

  useImperativeHandle(ref, () => ({ publish: async event => {
    if (portalPayloadBytes(event) > PORTAL_EVENT_MAX_BYTES) return false;
    seen.current.add(event.eventId);
    try { await send({ type: event.kind, content: event }); return true; } catch { seen.current.delete(event.eventId); return false; }
  } }), [send]);

  useEffect(() => {
    for (const message of messages) {
      if (message.retracted || seen.current.has(message.content?.eventId)) continue;
      const event = normalizePortalEvent(message.content, message.sender.id);
      if (!event) continue;
      seen.current.add(event.eventId);
      onEvent(event);
    }
  }, [messages, onEvent]);

  useEffect(() => {
    const people = presence?.kind === "detailed" ? presence.count : presence?.kind === "aggregate" ? presence.count : 0;
    onState({ status, people, connected: status === "ready", selfId: me?.id, participants: actorsFromPresence(presence, me?.id) });
  }, [me?.id, onState, presence, status]);
  return null;
});

export const RealtimeRoom = forwardRef<RealtimeRoomHandle, Props>(function RealtimeRoom(props, ref) {
  if (!portal) return null;
  return <PortalProvider client={portal}><ConnectedRoom {...props} ref={ref} /></PortalProvider>;
});

export const portalConfigured = Boolean(portal);
