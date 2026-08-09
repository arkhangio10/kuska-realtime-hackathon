"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  BridgeResult,
  dedupeVotes,
  demoActors,
  hasCompleteSentence,
  Proposal,
  proposalInput,
  proposalTallies,
  roles,
  score,
  seedProposals,
  seedVotes,
  Vote,
  VoteRecord,
} from "@/lib/kuska";
import { formatActivityDate, HAZARD_ICONS, PIURA_CASE, type CaseFeed, type CaseStudy } from "@/lib/cases";
import type { NewsFeed } from "@/lib/news";
import type { EvidenceBundle } from "@/lib/evidence";
import type { AgentTurn } from "@/lib/demo-agents";
import { VoxelGateway } from "./voxel-gateway";
import { WorldExplorer } from "./world-explorer";
import { portalConfigured, RealtimeRoom, type RealtimeEvent, type RealtimeRoomHandle, type RealtimeState } from "./realtime-room";
import { AnalysisProgress } from "./analysis-progress";
import { BridgeCarousel } from "./bridge-carousel";
import { attachScenePlan, buildDecisionScenario, type DecisionScenario } from "@/lib/decision-simulation";
import { deterministicScenePlan, type ScenePlan } from "@/lib/scene-plan";

const aliasList = ["Río Claro", "Algarrobo", "Luz Norte", "Marea Verde", "Sol Andino"];
const uid = () => crypto.randomUUID();

const urgencyCopy: Record<CaseStudy["severity"], { label: string; action: string }> = {
  info: { label: "Seguimiento", action: "Verificar cambios antes de movilizar recursos." },
  watch: { label: "Preparación", action: "Acordar responsables y señales de activación." },
  warning: { label: "Respuesta prioritaria", action: "Validar rutas, responsables y población prioritaria." },
  danger: { label: "Riesgo crítico", action: "Seguir indicaciones oficiales y proteger vidas primero." },
};

const questionsByHazard: Partial<Record<CaseStudy["hazardKind"], string[]>> = {
  flood: ["¿Qué rutas siguen transitables?", "¿Quién necesita ayuda para evacuar?", "¿Qué señal oficial activa el plan?"],
  cyclone: ["¿Dónde están los refugios confirmados?", "¿Qué hogares tienen mayor exposición?", "¿Cuándo se suspende la movilidad?"],
  earthquake: ["¿Qué estructuras deben evitarse?", "¿Dónde se reunirá cada sector?", "¿Quién verifica daños y servicios?"],
  wildfire: ["¿Cuál es el perímetro de seguridad?", "¿Qué dirección tiene el humo?", "¿Qué ruta oficial de evacuación está abierta?"],
  drought: ["¿Qué usos del agua son prioritarios?", "¿Qué hogares tienen menor acceso?", "¿Cómo se medirá el abastecimiento?"],
  tsunami: ["¿Qué zona de inundación debe evitarse?", "¿Qué ruta conduce a terreno alto?", "¿Qué señal oficial activa la evacuación?"],
  storm_surge: ["¿Qué sectores costeros están expuestos?", "¿Qué refugios están confirmados?", "¿Cuándo debe suspenderse la movilidad?"],
  landslide: ["¿Qué laderas y vías deben aislarse?", "¿Dónde hay terreno estable confirmado?", "¿Quién evalúa nuevos movimientos?"],
  heatwave: ["¿Quiénes necesitan enfriamiento prioritario?", "¿Dónde hay agua y sombra disponibles?", "¿Qué horario reduce la exposición?"],
  cold_wave: ["¿Qué hogares necesitan abrigo o calefacción?", "¿Qué vías permanecen transitables?", "¿Dónde funciona la atención sanitaria?"],
  volcano: ["¿Cuál es la zona de exclusión?", "¿Cómo se protegerá a personas vulnerables?", "¿Qué rutas evitan ceniza y lahares?"],
  chemical: ["¿Cuál es el perímetro confirmado?", "¿Qué exposición debe evitarse?", "¿Qué autoridad valida el retorno?"],
  biological: ["¿Qué síntomas requieren atención?", "¿Qué información está confirmada?", "¿Cómo se protegerá la privacidad?"],
  radiological: ["¿Cuál es la instrucción oficial vigente?", "¿Qué zona debe evitarse?", "¿Cómo se limita la exposición?"],
  transport: ["¿Qué acceso necesitan los equipos de respuesta?", "¿Qué rutas deben cerrarse?", "¿Dónde se reunificarán las familias?"],
};

const defaultQuestions = ["¿Qué hecho está confirmado?", "¿Quién puede ejecutar la propuesta?", "¿Cómo sabremos si funcionó?"];
const roleFocus: Record<(typeof roles)[number], string> = {
  "Vecina de la zona": "Aporta conocimiento del territorio, barreras cotidianas y redes de cuidado.",
  "Comerciante local": "Evalúa continuidad de suministros, empleo y recuperación del barrio.",
  "Brigadista comunitario": "Prioriza rutas seguras, coordinación por sectores y capacidad de respuesta.",
  "Especialista técnico": "Distingue evidencia, supuestos, umbrales y riesgos secundarios.",
  "Personal de salud": "Prioriza vida, accesibilidad, continuidad de atención y población vulnerable.",
  "Coordinador municipal": "Conecta responsables, recursos, comunicación oficial y tiempos de ejecución.",
};

function newsDate(value: string) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function proposalStatus(agree: number, concern: number) {
  const total = agree + concern;
  if (!total) return "Sin evaluar";
  if (concern > agree) return "Requiere revisión";
  if (agree / total >= 0.67) return "Apoyo alto";
  return "Opinión dividida";
}

export function KuskaMission() {
  const [scene, setScene] = useState<"map" | "world" | "room">("map");
  const [actor] = useState(() => ({ id: uid(), alias: aliasList[Math.floor(Math.random() * aliasList.length)], role: roles[Math.floor(Math.random() * roles.length)], kind: "human" as const }));
  const [proposals, setProposals] = useState<Proposal[]>(seedProposals);
  const [votes, setVotes] = useState<VoteRecord[]>(seedVotes);
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<"idle" | "working" | "error">("idle");
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisCooldown, setAnalysisCooldown] = useState(0);
  const [bridge, setBridge] = useState<BridgeResult | null>(null);
  const [note, setNote] = useState(portalConfigured ? "Conectando la sala compartida…" : "Sala demo local: configura NEXT_PUBLIC_PORTAL_API_KEY para activar tiempo real.");
  const [chatText, setChatText] = useState("");
  const [chat, setChat] = useState<Array<{ id: string; alias: string; text: string; kind: "human" | "demo-agent" }>>([
    { id: "welcome", alias: "Ana M.", text: "El agua suele cortar primero la ruta hacia Catacaos.", kind: "demo-agent" },
    { id: "question", alias: "Luz V.", text: "¿Qué familias necesitarían apoyo para evacuar?", kind: "demo-agent" },
  ]);
  const [caseFeed, setCaseFeed] = useState<CaseFeed>({ cases: [PIURA_CASE], updatedAt: "", sources: [], unavailableSources: [] });
  const [casesReady, setCasesReady] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseStudy>(PIURA_CASE);
  const [newsState, setNewsState] = useState<{ caseId: string; feed: NewsFeed } | null>(null);
  const [evidenceState, setEvidenceState] = useState<{ caseId: string; bundle: EvidenceBundle } | null>(null);
  const [evidenceErrorCaseId, setEvidenceErrorCaseId] = useState<string | null>(null);
  const [evidencePage, setEvidencePage] = useState(0);
  const [solutionPage, setSolutionPage] = useState(0);
  const [questionPage, setQuestionPage] = useState(0);
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [hudPanel, setHudPanel] = useState<"evidence" | "room" | null>(null);
  const [workspaceView, setWorkspaceView] = useState<"case" | "solutions" | "vote">("case");
  const [proposalPage, setProposalPage] = useState(0);
  const [decisionScenario, setDecisionScenario] = useState<DecisionScenario | null>(null);
  const [scenePlanProposalId, setScenePlanProposalId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<"idle" | "working">("idle");
  const [realtime, setRealtime] = useState<RealtimeState>({ status: portalConfigured ? "connecting" : "local", people: 1, connected: false, participants: [] });
  const realtimeRef = useRef<RealtimeRoomHandle>(null);
  const newsFeed = newsState?.caseId === selectedCase.id ? newsState.feed : null;
  const evidenceBundle = evidenceState?.caseId === selectedCase.id ? evidenceState.bundle : null;
  const evidenceStatus = evidenceBundle ? "ready" : evidenceErrorCaseId === selectedCase.id ? "error" : "loading";
  const evidencePages = Math.max(1, Math.ceil((evidenceBundle?.items.length ?? 0) / 2));
  const visibleEvidencePage = Math.min(evidencePage, evidencePages - 1);
  const visibleEvidence = evidenceBundle?.items.slice(visibleEvidencePage * 2, visibleEvidencePage * 2 + 2) ?? [];

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/cases", { cache: "no-store" }).then(response => response.json()).then((feed: CaseFeed) => {
      if (!active) return;
      setCaseFeed(feed);
      setSelectedCase(current => feed.cases.find(item => item.id === current.id) ?? feed.cases[0] ?? current);
      setCasesReady(true);
    }).catch(() => {
      if (active) { setCaseFeed(current => ({ ...current, unavailableSources: ["GDACS", "IFRC GO"] })); setCasesReady(true); }
    });
    load();
    const timer = window.setInterval(load, 300_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ country: selectedCase.country, hazard: selectedCase.hazardKind, title: selectedCase.eventTitle });
    fetch(`/api/news?${query}`, { signal: controller.signal })
      .then(response => response.json())
      .then((feed: NewsFeed) => setNewsState({ caseId: selectedCase.id, feed }))
      .catch(error => {
        if (error instanceof Error && error.name !== "AbortError") setNewsState({ caseId: selectedCase.id, feed: { articles: [], updatedAt: new Date().toISOString(), source: "GDELT DOC 2.0", searchUrl: "https://api.gdeltproject.org/api/v2/doc/doc", unavailable: true, note: "No se pudo consultar la cobertura periodística." } });
      });
    return () => controller.abort();
  }, [selectedCase.country, selectedCase.eventTitle, selectedCase.hazardKind, selectedCase.id]);

  useEffect(() => {
    if (!newsFeed) return;
    const controller = new AbortController();
    fetch("/api/evidence", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ caseStudy: selectedCase, news: newsFeed.articles }) })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("evidence_failed")))
      .then((bundle: EvidenceBundle) => { setEvidenceState({ caseId: selectedCase.id, bundle }); setEvidenceErrorCaseId(null); })
      .catch(error => { if (error instanceof Error && error.name !== "AbortError") setEvidenceErrorCaseId(selectedCase.id); });
    return () => controller.abort();
  }, [newsFeed, selectedCase]);

  useEffect(() => {
    if (analysisCooldown <= 0) return;
    const timer = window.setInterval(() => setAnalysisCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [analysisCooldown]);

  useEffect(() => {
    const closeDrawer = (event: KeyboardEvent) => { if (event.key === "Escape") setHudPanel(null); };
    window.addEventListener("keydown", closeDrawer);
    return () => window.removeEventListener("keydown", closeDrawer);
  }, []);

  const roomActor = useMemo(() => ({ ...actor, id: realtime.selfId ?? actor.id }), [actor, realtime.selfId]);
  const participants = useMemo(() => {
    const unique = new Map([...demoActors, roomActor, ...realtime.participants].map(person => [person.id, person]));
    return [...unique.values()];
  }, [realtime.participants, roomActor]);
  const uniqueVotes = useMemo(() => dedupeVotes(votes.map(vote => vote.actorId === actor.id ? { ...vote, actorId: roomActor.id } : vote)), [actor.id, roomActor.id, votes]);
  const humanIds = useMemo(() => new Set(participants.filter(person => person.kind === "human").map(person => person.id)), [participants]);
  const demoIds = useMemo(() => new Set(participants.filter(person => person.kind === "demo-agent").map(person => person.id)), [participants]);
  const humanVotes = useMemo(() => uniqueVotes.filter(vote => humanIds.has(vote.actorId)), [humanIds, uniqueVotes]);
  const demoVotes = useMemo(() => uniqueVotes.filter(vote => demoIds.has(vote.actorId)), [demoIds, uniqueVotes]);
  const terrain = useMemo(() => score(humanVotes, Math.max(humanIds.size, 1)), [humanIds.size, humanVotes]);
  const humanTallies = useMemo(() => proposalTallies(proposals, humanVotes), [proposals, humanVotes]);
  const demoTallies = useMemo(() => proposalTallies(proposals, demoVotes), [proposals, demoVotes]);
  const totalReactions = humanVotes.filter(vote => vote.value !== "pass").length;
  const demoReactions = demoVotes.filter(vote => vote.value !== "pass").length;
  const representedRoles = new Set(participants.filter(person => person.kind === "human").map(participant => participant.role));
  const representation = Math.round(representedRoles.size / roles.length * 100);
  const missingRoles = roles.filter(role => !representedRoles.has(role));
  const ranked = [...humanTallies].sort((a, b) => (b.agree - b.concern) - (a.agree - a.concern));
  const topProposalId = ranked[0] && ranked[0].agree + ranked[0].concern > 0 ? ranked[0].proposalId : null;
  const decisionQuestions = questionsByHazard[selectedCase.hazardKind] ?? defaultQuestions;
  const urgency = urgencyCopy[selectedCase.severity];
  const promotedSolutions = proposals.filter(item => item.id.startsWith("candidate-")).length;
  const orderedProposals = useMemo(() => [...proposals].sort((a, b) => Number(Boolean(b.bridge || b.id.startsWith("candidate-"))) - Number(Boolean(a.bridge || a.id.startsWith("candidate-")))), [proposals]);
  const visibleProposalPage = Math.min(proposalPage, Math.max(orderedProposals.length - 1, 0));
  const visibleProposals = orderedProposals.slice(visibleProposalPage, visibleProposalPage + 1);
  const visibleParticipants = showAllPeople ? participants : participants.slice(-2);
  const currentDecisionStep = !evidenceBundle ? 0 : !bridge ? 1 : 2;
  const simVars = { "--water-level": `${36 + selectedCase.visual.water * 105}px`, "--rain-opacity": selectedCase.visual.rain, "--wind-shift": `${selectedCase.visual.wind * 18}px`, "--drought-intensity": selectedCase.visual.drought } as CSSProperties;

  function continueDecision() {
    if (!evidenceBundle) {
      document.querySelector(".evidence-ledger")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!bridge) {
      void analyze();
      return;
    }
    setWorkspaceView(promotedSolutions ? "vote" : "solutions");
  }

  function vote(proposalId: string, value: Vote) {
    const record = { proposalId, actorId: roomActor.id, value };
    setVotes(current => [...current.filter(item => !(item.proposalId === proposalId && item.actorId === roomActor.id)), record]);
    void realtimeRef.current?.publish({ eventId: uid(), kind: "vote.cast", createdAt: new Date().toISOString(), actor: roomActor, vote: record });
    setNote("Tu reacción actualizó el estado de la decisión.");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = proposalInput.safeParse(text);
    if (!result.success) { setNote(result.error.issues[0]?.message ?? "Revisa tu propuesta."); return; }
    const proposal = { id: uid(), text: result.data, author: roomActor, createdAt: new Date().toISOString() };
    setProposals(current => [...current, proposal]);
    void realtimeRef.current?.publish({ eventId: uid(), kind: "proposal.created", createdAt: proposal.createdAt, actor: roomActor, proposal });
    setText("");
    setNote("Propuesta publicada. Las demás perspectivas ya pueden reaccionar.");
  }

  function sendChat(event: FormEvent) {
    event.preventDefault();
    const clean = chatText.trim().slice(0, 180);
    if (!clean) return;
    const message = { id: uid(), alias: roomActor.alias, text: clean, kind: "human" as const };
    setChat(messages => [...messages, message]);
    void realtimeRef.current?.publish({ eventId: uid(), kind: "chat.created", createdAt: new Date().toISOString(), actor: roomActor, chat: message });
    setChatText("");
  }

  const applyRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (!event?.eventId || event.actor?.kind !== "human") return;
    if (event.kind === "proposal.created" && event.proposal && event.proposal.author.kind === "human") {
      setProposals(current => current.some(item => item.id === event.proposal?.id) ? current : [...current, event.proposal!]);
    }
    if (event.kind === "vote.cast" && event.vote && event.vote.actorId === event.actor.id) {
      setVotes(current => [...current.filter(item => !(item.proposalId === event.vote?.proposalId && item.actorId === event.vote?.actorId)), event.vote!]);
    }
    if (event.kind === "chat.created" && event.chat) {
      setChat(current => current.some(item => item.id === event.chat?.id) ? current : [...current, event.chat!]);
    }
  }, []);

  async function runDemoAgents() {
    if (!evidenceBundle || agentStatus === "working") { setNote("Espera a que el registro de evidencia esté listo."); return; }
    setAgentStatus("working");
    setNote("Los agentes simulados están contrastando perspectivas con evidencia identificada…");
    try {
      const response = await fetch("/api/demo-agents/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseStudy: selectedCase, evidenceBundle, proposals: proposals.filter(item => !item.bridge), chat: chat.slice(-20), requesterId: roomActor.id }) });
      const data = await response.json();
      if (!response.ok || !data.result) throw new Error(data.error ?? "agent_turn_failed");
      const turn = data.result as AgentTurn;
      const newProposals: Proposal[] = [], newMessages: Array<{ id: string; alias: string; text: string; kind: "demo-agent" }> = [];
      for (const intervention of turn.interventions) {
        const agent = demoActors.find(item => item.id === intervention.actorId);
        if (!agent || intervention.action === "pass") continue;
        if (intervention.action === "propose") newProposals.push({ id: `agent-${uid()}`, text: intervention.text, author: agent, createdAt: new Date().toISOString() });
        else newMessages.push({ id: `agent-chat-${uid()}`, alias: agent.alias, text: intervention.text, kind: "demo-agent" });
      }
      setProposals(current => [...current, ...newProposals]);
      setChat(current => [...current, ...newMessages]);
      setNote(data.source === "openai" ? `Ronda IA completada: ${newProposals.length} propuestas y ${newMessages.length} preguntas o riesgos. No cuentan como votos humanos.` : data.note ?? "Ronda simulada determinista completada.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "No se pudo ejecutar la ronda de agentes.");
    } finally { setAgentStatus("idle"); }
  }

  async function analyze() {
    if (analysis === "working" || analysisCooldown > 0) return;
    if (!evidenceBundle) { setNote("El análisis espera el registro de evidencia para evitar una respuesta sin fuentes."); return; }
    setAnalysis("working");
    setAnalysisModalOpen(true);
    setNote("KUSKA IA está contrastando el caso, los votos y las perspectivas…");
    try {
      const response = await fetch("/api/bridge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseStudy: selectedCase, proposals: proposals.filter(item => !item.bridge), votes: uniqueVotes, participants, evidenceBundle, chat: chat.slice(-20), requesterId: roomActor.id }) });
      const data = await response.json();
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") || data.retryAfterSeconds || 60);
        setAnalysisCooldown(Number.isFinite(retryAfter) ? Math.max(1, retryAfter) : 60);
        throw new Error(data.error ?? "Límite temporal alcanzado.");
      }
      if (!response.ok || !data.result) throw new Error(data.error ?? "bridge_failed");
      const result = data.result as BridgeResult;
      const oldBridgeIds = new Set(proposals.filter(item => item.bridge).map(item => item.id));
      const generation = data.source === "openai" ? "openai" : "fallback";
      setBridge(result);
      setWorkspaceView("solutions");
      setVotes(current => current.filter(item => !oldBridgeIds.has(item.proposalId)));
      setProposals(current => [...current.filter(item => !item.bridge), { id: `bridge-${uid()}`, text: result.bridge, author: { id: generation === "openai" ? "kuska-ia" : "kuska-rules", alias: generation === "openai" ? "KUSKA IA" : "KUSKA contingencia", role: generation === "openai" ? "Facilitadora IA" : "Regla determinista", kind: "agent" }, createdAt: new Date().toISOString(), bridge: true, basedOn: result.basedOnProposalIds, generation }]);
      setNote(generation === "openai" ? "KUSKA IA publicó una propuesta puente para que la sala la evalúe." : data.note ?? "Se publicó una alternativa determinista de contingencia.");
      setAnalysis("idle");
      setAnalysisModalOpen(false);
    } catch (error) {
      setAnalysis("error");
      setAnalysisModalOpen(false);
      setNote(error instanceof Error && error.message !== "bridge_failed" ? error.message : "No se pudo completar el análisis. Inténtalo otra vez.");
    }
  }

  function promoteSolution(option: BridgeResult["solutionOptions"][number]) {
    const id = `candidate-${selectedCase.id}-${option.id}`;
    setProposals(current => current.some(item => item.id === id) ? current : [...current, { id, text: option.summary, author: { id: "kuska-ia", alias: "KUSKA IA", role: "Generadora de alternativas", kind: "agent" }, createdAt: new Date().toISOString(), basedOn: option.basedOnProposalIds, generation: "openai" }]);
    setProposalPage(0);
    setWorkspaceView("vote");
    setNote(`“${option.title}” se añadió como opción. Ahora las personas pueden apoyarla o señalar preocupaciones.`);
  }

  async function simulateDecision(proposal: Proposal) {
    if (scenePlanProposalId) return;
    const baseScenario = buildDecisionScenario(selectedCase, proposal.text);
    const localPlan = deterministicScenePlan(selectedCase, baseScenario);
    setScenePlanProposalId(proposal.id);
    setNote("La IA está convirtiendo la decisión en cambios visibles y comprobando sus límites físicos…");
    try {
      const response = await fetch("/api/scene-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseStudy: selectedCase, scenario: baseScenario, requesterId: roomActor.id }) });
      const data = await response.json() as { plan?: ScenePlan; source?: "openai" | "fallback"; model?: string; note?: string; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error ?? "scene_plan_failed");
      const source = data.source === "openai" ? "openai" : "fallback";
      setDecisionScenario(attachScenePlan(baseScenario, selectedCase.visual, data.plan, source, data.model));
      setNote(source === "openai" ? "La IA preparó una escena operativa. Observa qué cambia y qué riesgo permanece." : data.note ?? "Se preparó una escena local de contingencia.");
    } catch {
      setDecisionScenario(attachScenePlan(baseScenario, selectedCase.visual, localPlan, "fallback"));
      setNote("No se pudo consultar a la IA; la simulación continúa con un plan local seguro.");
    } finally {
      setScenePlanProposalId(null);
      setScene("world");
    }
  }

  if (scene === "world") return <WorldExplorer alias={actor.alias} role={actor.role} caseStudy={selectedCase} scenario={decisionScenario} onClearScenario={() => setDecisionScenario(null)} onBack={() => setScene("map")} onOpenMission={() => setScene("room")} />;
  if (scene === "map") return <VoxelGateway key={casesReady ? caseFeed.updatedAt || "fallback" : "loading"} cases={caseFeed.cases} loading={!casesReady} onEnter={caseStudy => { setSelectedCase(caseStudy); setDecisionScenario(null); setScene("world"); }} />;

  return (
    <main className="mission-room">
      <RealtimeRoom ref={realtimeRef} caseId={selectedCase.id} actor={actor} onEvent={applyRealtimeEvent} onState={setRealtime} />
      <header className="top">
        <button className="back-map" onClick={() => setScene("world")}>← Mundo</button>
        <div className="brand">KUSKA <span>juntos</span></div>
        <nav className="mission-hud-tabs" aria-label="Paneles de la misión">
          <button className={hudPanel === null ? "active" : ""} aria-pressed={hudPanel === null} onClick={() => { setHudPanel(null); setWorkspaceView("case"); }}><i>◎</i>Misión</button>
          <button className={hudPanel === "evidence" ? "active" : ""} aria-controls="evidence-drawer" aria-expanded={hudPanel === "evidence"} onClick={() => setHudPanel(current => current === "evidence" ? null : "evidence")}><i>◇</i>Datos <span>{evidenceBundle?.items.length ?? "…"}</span></button>
          <button className={hudPanel === "room" ? "active" : ""} aria-controls="room-drawer" aria-expanded={hudPanel === "room"} onClick={() => setHudPanel(current => current === "room" ? null : "room")}><i>◉</i>Sala <span>{Math.max(realtime.people, 1)}</span></button>
        </nav>
        <div className="live"><i /> Caso {selectedCase.dataState === "live" ? "en vivo" : selectedCase.dataState === "recent" ? "reciente" : "preventivo"} · {selectedCase.country} · {realtime.connected ? `${Math.max(realtime.people, 1)} en sala` : "demo local"}</div>
        <button className="quiet" onClick={() => { setProposals(seedProposals); setVotes(seedVotes); setBridge(null); setProposalPage(0); setWorkspaceView("case"); setNote("Modo demo reiniciado."); }}>Reiniciar demo</button>
      </header>

      {hudPanel && <button className="hud-scrim" aria-label="Cerrar panel" onClick={() => setHudPanel(null)} />}
      {analysis === "working" && analysisModalOpen && <div className="analysis-modal-backdrop">
        <section className="analysis-modal" role="dialog" aria-modal="true" aria-labelledby="analysis-modal-title" aria-describedby="analysis-modal-description" aria-busy="true">
          <header><span>IA</span><div><small>FACILITACIÓN EN CURSO</small><h2 id="analysis-modal-title">Construyendo alternativas</h2></div></header>
          <p id="analysis-modal-description">KUSKA está relacionando la evidencia disponible con los aportes de la sala. No está tomando la decisión por la comunidad.</p>
          <div className="analysis-modal-facts"><span><b>{evidenceBundle?.items.length ?? 0}</b> evidencias</span><span><b>{proposals.filter(item => !item.bridge).length}</b> aportes</span><span><b>{chat.length}</b> preguntas</span></div>
          <AnalysisProgress mode="solutions" evidenceCount={evidenceBundle?.items.length ?? 0} />
          <footer><small>Puedes seguir viendo la sala. El análisis continuará en segundo plano.</small><button autoFocus onClick={() => setAnalysisModalOpen(false)}>Continuar viendo la sala</button></footer>
        </section>
      </div>}
      {analysis === "working" && !analysisModalOpen && <button className="analysis-dock" onClick={() => setAnalysisModalOpen(true)}><i /> KUSKA está analizando <span>Ver progreso</span></button>}
      <div className="shell decision-shell hud-layout">
        <nav className="workspace-tabs" aria-label="Etapas de la mesa de acuerdos">
          <button className={workspaceView === "case" ? "active" : ""} aria-pressed={workspaceView === "case"} onClick={() => setWorkspaceView("case")}><span>1</span><b>Caso</b><small>Entender</small></button>
          <button className={workspaceView === "solutions" ? "active" : ""} aria-pressed={workspaceView === "solutions"} onClick={() => setWorkspaceView("solutions")}><span>2</span><b>Alternativas</b><small>{bridge ? `${bridge.solutionOptions.length} listas` : "Generar"}</small></button>
          <button className={workspaceView === "vote" ? "active" : ""} aria-pressed={workspaceView === "vote"} onClick={() => setWorkspaceView("vote")}><span>3</span><b>Votación</b><small>{totalReactions} humanas</small></button>
        </nav>
        <aside id="evidence-drawer" className={`evidence-rail hud-drawer hud-drawer-left ${hudPanel === "evidence" ? "is-open" : ""}`} aria-hidden={hudPanel !== "evidence"}>
          <div className="hud-drawer-head"><div><small>ARCHIVO DE MISIÓN</small><b>Datos y fuentes</b></div><button aria-label="Cerrar datos" onClick={() => setHudPanel(null)}>×</button></div>
          <section className={`panel case-command severity-${selectedCase.severity}`}>
            <p className="eyebrow">EVIDENCIA DEL CASO</p>
            <div className="case-command-title"><span>{HAZARD_ICONS[selectedCase.hazardKind]}</span><div><small>{selectedCase.hazardLabel.toUpperCase()}</small><h2>{selectedCase.country}</h2></div></div>
            <div className="verification-line"><i />{selectedCase.dataState === "live" ? "Señal activa" : "Señal reciente"}<span>{selectedCase.source}</span></div>
            <p className="event-title">{selectedCase.eventTitle}</p>
            <div className="freshness"><small>ÚLTIMA SEÑAL</small><b>{formatActivityDate(selectedCase.lastActivityAt)}</b></div>
            <a className="source-button" href={selectedCase.eventUrl} target="_blank" rel="noreferrer">Ver fuente oficial ↗</a>
          </section>

          <details className="panel indicators-panel compact-panel">
            <summary className="compact-panel-summary"><div><p className="eyebrow">INDICADORES VERIFICADOS</p><h3>Qué mide la fuente</h3></div><span>{selectedCase.metrics.length}</span></summary>
            {selectedCase.metrics.map(metric => <div className="metric-row" key={metric.label}><div><small>{metric.label}</small><b>{metric.value}</b></div><div className="metric-track"><i style={{ width: `${metric.level}%` }} /></div></div>)}
            <small className="data-disclaimer">Los indicadores describen el reporte; no predicen por sí solos el impacto local.</small>
          </details>

          <section className="panel evidence-ledger">
            <div className="rail-heading"><div><p className="eyebrow">REGISTRO DE EVIDENCIA</p><h3>Qué puede usar la IA</h3></div><span>{evidenceBundle?.items.length ?? "…"}</span></div>
            {evidenceStatus === "loading" && <AnalysisProgress mode="evidence" />}
            {evidenceStatus === "error" && <p className="loading-copy">No se pudo completar el registro. El análisis queda bloqueado para evitar una respuesta sin trazabilidad.</p>}
            <div className="evidence-carousel" aria-live="polite">{visibleEvidence.map(item => <a className={`evidence-row evidence-${item.kind}`} href={item.sourceUrl} target="_blank" rel="noreferrer" key={item.id}><span>{item.id}</span><b>{item.title}</b><small>{item.source} · confianza {item.reliability === "high" ? "alta" : item.reliability === "medium" ? "media" : "baja"}</small></a>)}</div>
            {evidenceBundle && evidenceBundle.items.length > 2 && <div className="evidence-nav"><button aria-label="Evidencias anteriores" onClick={() => setEvidencePage(value => (value - 1 + evidencePages) % evidencePages)}>←</button><span>{visibleEvidencePage * 2 + 1}–{Math.min(visibleEvidencePage * 2 + 2, evidenceBundle.items.length)} de {evidenceBundle.items.length}</span><button aria-label="Evidencias siguientes" onClick={() => setEvidencePage(value => (value + 1) % evidencePages)}>→</button></div>}
            {evidenceBundle && <details><summary>Vacíos y fuentes pendientes <span>{evidenceBundle.unknowns.length + evidenceBundle.unavailableSources.length}</span></summary>{evidenceBundle.unknowns.map(item => <p key={item}>Dato faltante: {item}</p>)}{evidenceBundle.unavailableSources.map(item => <p key={item}>Sin acceso: {item}</p>)}</details>}
          </section>

          <details className="panel official-detail">
            <summary>Contexto oficial <span>+</span></summary>
            <p>{selectedCase.details}</p>
            <small>{selectedCase.originLabel} · evento fechado {formatActivityDate(selectedCase.eventDate)}</small>
          </details>

          <details className="panel press-panel compact-panel">
            <summary className="compact-panel-summary"><div><p className="eyebrow">CONTEXTO DE PRENSA</p><h3>Qué están reportando</h3></div><span>{newsFeed?.articles.length ?? "…"}</span></summary>
            {!newsFeed && <p className="loading-copy">Buscando cobertura relacionada…</p>}
            {newsFeed?.articles.slice(0, 3).map(article => <a className="news-brief" key={article.id} href={article.url} target="_blank" rel="noreferrer"><small>{article.domain} · {newsDate(article.publishedAt)}</small><b>{article.title}</b></a>)}
            {newsFeed && newsFeed.articles.length === 0 && <p className="loading-copy">{newsFeed.note ?? "Sin cobertura suficientemente relacionada."}</p>}
            <small className="data-disclaimer">GDELT agrega noticias. No reemplaza ni modifica la fuente oficial.</small>
          </details>
        </aside>

        <section className="center decision-center">
          {workspaceView === "case" && <div className="mission decision-hero workspace-panel">
            <div className={`flood-sim hazard-${selectedCase.hazardKind} severity-${selectedCase.severity}`} style={simVars} aria-label={`Simulación de ${selectedCase.hazardLabel.toLowerCase()} para ${selectedCase.country}`}>
              <div className="sim-atmosphere" /><div className="sim-sky"><i /><i /><i /></div><div className="sim-rain">{Array.from({ length: 24 }, (_, index) => <i key={index} />)}</div><div className="sim-land"><i /><i /><i /><i /><i /><i /></div><div className="sim-road"><i /><i /><i /></div><div className="sim-houses"><i /><i /><i /></div><div className="sim-trees"><i /><i /></div><div className="sim-water"><i /><i /><i /></div><div className="sim-debris"><i /><i /><i /></div><div className="sim-depth" aria-hidden="true"><i /><small>NIVEL DEL AGUA</small></div><div className="sim-drought" aria-hidden="true"><i /><i /><i /><i /></div><span>{HAZARD_ICONS[selectedCase.hazardKind]} {selectedCase.hazardLabel.toUpperCase()} · {selectedCase.source}</span>
            </div>

            <div className="decision-kicker"><span className={`severity-dot severity-${selectedCase.severity}`} />{urgency.label}<b>{selectedCase.originLabel} · {selectedCase.country}</b></div>
            <h1>Decidamos el próximo paso</h1>
            <p className="decision-subtitle">{selectedCase.hazardLabel} en {selectedCase.country}. {urgency.action}</p>

            <section className="decision-guide" aria-label="Ruta de decisión">
              <ol className="decision-steps">
                {["Entender", "Comparar", "Decidir"].map((label, index) => <li className={index < currentDecisionStep ? "complete" : index === currentDecisionStep ? "current" : "pending"} aria-current={index === currentDecisionStep ? "step" : undefined} key={label}><span>{index < currentDecisionStep ? "✓" : index + 1}</span><b>{label}</b><small>{index === 0 ? "Fuentes" : index === 1 ? "Alternativas" : "Voto humano"}</small></li>)}
              </ol>
              <div className="next-action">
                <div><small>AHORA</small><h2>{!evidenceBundle ? "Estamos verificando las fuentes" : !bridge ? "Genera alternativas para comparar" : promotedSolutions ? "Reacciona a una opción" : "Elige una alternativa para votar"}</h2><p>{!evidenceBundle ? "La decisión se habilita cuando la evidencia tenga trazabilidad." : !bridge ? "La IA cruzará fuentes y aportes; la comunidad seguirá decidiendo." : promotedSolutions ? "Apoya o señala una preocupación. Los agentes simulados no cuentan como votos." : "Revisa beneficio y riesgo; después llévala a votación humana."}</p></div>
                <button onClick={continueDecision} disabled={analysis === "working" || Boolean(evidenceBundle && !bridge && analysisCooldown > 0)}>{analysis === "working" ? "Analizando…" : !evidenceBundle ? "Ver evidencia" : !bridge ? "Generar alternativas" : promotedSolutions ? "Ir a votar" : "Comparar alternativas"}</button>
              </div>
            </section>

            <div className="role-lens"><span>Tu perspectiva</span><div><b>{actor.role}</b><small>{roleFocus[actor.role]}</small></div><em>{actor.alias}</em></div>

            <section className="decision-pulse" aria-label="Estado de la decisión comunitaria">
              <div className="pulse-score"><small>TERRENO COMÚN</small><b>{terrain}%</b><span>{terrain >= 70 ? "Base para avanzar" : terrain >= 45 ? "Aún hay diferencias" : "Necesita más diálogo"}</span></div>
              <div className="pulse-main"><div className="bar"><i style={{ width: `${terrain}%` }} /></div><div className="pulse-scale"><span>Explorar</span><span>Construir</span><span>Probar</span></div></div>
              <div className="pulse-stats"><div><b>{totalReactions}</b><small>reacciones humanas</small></div><div><b>{demoReactions}</b><small>reacciones simuladas</small></div></div>
            </section>

            <div className="decision-questions"><div><p className="eyebrow">ANTES DE DECIDIR</p><h2>Pregunta pendiente</h2></div><div className="question-chip" aria-live="polite"><span>{questionPage + 1} de {decisionQuestions.length}</span><p>{decisionQuestions[questionPage]}</p></div><div className="question-nav"><button aria-label="Pregunta anterior" onClick={() => setQuestionPage(value => (value - 1 + decisionQuestions.length) % decisionQuestions.length)}>←</button><button aria-label="Pregunta siguiente" onClick={() => setQuestionPage(value => (value + 1) % decisionQuestions.length)}>→</button></div></div>
          </div>}

          {workspaceView === "solutions" && bridge && <section className="solution-lab workspace-panel" id="solution-lab">
            <div className="solution-lab-head"><div><p className="eyebrow">SOLUCIONES GENERADAS CON EVIDENCIA</p><h2>Tres caminos posibles para decidir en comunidad</h2><p>La IA desarrolla los aportes de la sala y el estado actual de las fuentes. No son órdenes: compara requisitos y riesgos antes de llevar una opción a votación.</p></div><span>{bridge.solutionOptions.length} alternativas</span></div>
            <div className="solution-carousel-controls"><button aria-label="Solución anterior" onClick={() => setSolutionPage(value => (value - 1 + bridge.solutionOptions.length) % bridge.solutionOptions.length)}>←</button><div>{bridge.solutionOptions.map((option, index) => <i className={index === Math.min(solutionPage, bridge.solutionOptions.length - 1) ? "active" : ""} key={option.id} />)}</div><span>{Math.min(solutionPage, bridge.solutionOptions.length - 1) + 1} de {bridge.solutionOptions.length}</span><button aria-label="Siguiente solución" onClick={() => setSolutionPage(value => (value + 1) % bridge.solutionOptions.length)}>→</button></div>
            <div className="solution-grid">{bridge.solutionOptions.slice(Math.min(solutionPage, bridge.solutionOptions.length - 1), Math.min(solutionPage, bridge.solutionOptions.length - 1) + 1).map((option) => {
              const index = bridge.solutionOptions.findIndex(item => item.id === option.id);
              const recommended = option.id === bridge.recommendedSolutionId;
              const alreadyAdded = proposals.some(item => item.id === `candidate-${selectedCase.id}-${option.id}`);
              return <article className={recommended ? "solution-card recommended" : "solution-card"} key={option.id}>
                <div className="solution-card-top"><span>0{index + 1}</span>{recommended && <b>Mejor punto de partida</b>}<em>viabilidad {option.feasibility === "high" ? "alta" : option.feasibility === "medium" ? "media" : "baja"}</em></div>
                <h3>{option.title}</h3><p className="solution-summary">{option.summary}</p>
                <div className="community-basis"><small>NACE DE LA COMUNIDAD</small><p>{option.communityBasis}</p></div>
                <div className="solution-balance"><div><small>BENEFICIO PRINCIPAL</small><p>{option.benefits[0]}</p></div><div><small>RIESGO PRINCIPAL</small><p>{option.risks[0]}</p></div></div>
                <details><summary>Plan de acción <span>{option.actionSteps.length}</span></summary>{option.actionSteps.map((step, stepIndex) => <div className="solution-step" key={`${step.action}-${stepIndex}`}><b>{stepIndex + 1}</b><p>{step.action}<small>{step.possibleOwner} · {step.horizon}</small></p></div>)}</details>
                <details><summary>Qué necesita <span>{option.requirements.length}</span></summary>{option.requirements.map(item => <p className="solution-requirement" key={item}>{item}</p>)}</details>
                <details className="solution-sources"><summary>Fuentes vinculadas <span>{option.evidenceIds.length}</span></summary><div className="solution-evidence">{option.evidenceIds.map(id => <span key={id}>{id}</span>)}</div></details>
                <button onClick={() => promoteSolution(option)} disabled={alreadyAdded}>{alreadyAdded ? "Ya está en votación" : "Llevar a votación humana"}</button>
              </article>;
            })}</div>
          </section>}

          {workspaceView === "solutions" && !bridge && <section className="empty-stage workspace-panel"><div className="empty-stage-icon">◇</div><p className="eyebrow">ALTERNATIVAS</p><h2>Generar opciones con evidencia</h2><p>KUSKA cruzará fuentes y aportes de la sala. Tú decides cuál pasa a votación.</p><div className="empty-stage-stats"><span><b>{evidenceBundle?.items.length ?? 0}</b> evidencias</span><span><b>{proposals.filter(item => !item.bridge).length}</b> aportes</span><span><b>{chat.length}</b> preguntas</span></div><button className="primary" disabled={analysis === "working" || analysisCooldown > 0 || !evidenceBundle} onClick={analyze}>{analysis === "working" ? "Analizando…" : analysisCooldown > 0 ? `Reintentar en ${analysisCooldown}s` : "Generar alternativas"}</button></section>}

          {workspaceView === "vote" && <><div className="stream workspace-panel" id="response-options">
            <div className="sectionhead"><div><p className="eyebrow">ETAPA 3 · VOTACIÓN</p><h2>Una opción a la vez</h2></div><div className="proposal-pager"><button aria-label="Propuesta anterior" onClick={() => setProposalPage(value => (value - 1 + orderedProposals.length) % orderedProposals.length)}>←</button><span>{visibleProposalPage + 1} de {orderedProposals.length}</span><button aria-label="Propuesta siguiente" onClick={() => setProposalPage(value => (value + 1) % orderedProposals.length)}>→</button></div></div>
            {visibleProposals.map(proposal => {
              const tally = humanTallies.find(item => item.proposalId === proposal.id) ?? { agree: 0, concern: 0, pass: 0 };
              const demoTally = demoTallies.find(item => item.proposalId === proposal.id) ?? { agree: 0, concern: 0, pass: 0 };
              const evaluated = tally.agree + tally.concern;
              const support = evaluated ? Math.round(tally.agree / evaluated * 100) : 0;
              const myVote = uniqueVotes.find(item => item.proposalId === proposal.id && item.actorId === roomActor.id)?.value;
              const incompleteAiText = proposal.author.kind === "agent" && !hasCompleteSentence(proposal.text);
              return <article className={proposal.bridge ? "proposal bridge decision-proposal" : "proposal decision-proposal"} key={proposal.id}>
                <div className="proposal-top"><div className="proposer"><span className={proposal.author.kind} /><div><b>{proposal.author.alias}</b><small>{proposal.bridge ? proposal.generation === "fallback" ? "Puente de contingencia · reglas" : "Propuesta puente · IA" : proposal.author.role}</small></div></div><div className="proposal-badges">{topProposalId === proposal.id && <span className="leader-badge">Mayor apoyo neto</span>}<span>{proposal.bridge ? "Síntesis" : proposalStatus(tally.agree, tally.concern)}</span></div></div>
                <p>{proposal.text}</p>
                {incompleteAiText && <small className="proposal-text-warning">La IA devolvió una frase incompleta. Regenera la alternativa antes de simularla.</small>}
                {proposal.basedOn && <small className="based">Integra {proposal.basedOn.length} propuestas existentes</small>}
                <div className="proposal-evidence"><div><span>Apoyo humano</span><b>{evaluated ? `${support}%` : "—"}</b></div><div className="proposal-track"><i style={{ width: `${support}%` }} /></div><small>{tally.agree} apoyos · {tally.concern} preocupaciones humanas<br />Simulación: {demoTally.agree} apoyos · {demoTally.concern} preocupaciones</small></div>
                <div className="actions"><button onClick={() => vote(proposal.id, "agree")} aria-pressed={myVote === "agree"} className={myVote === "agree" ? "selected" : ""}>✓ Apoyar <b>{tally.agree}</b></button><button onClick={() => vote(proposal.id, "concern")} aria-pressed={myVote === "concern"} className={myVote === "concern" ? "selected concern" : ""}>! Señalar preocupación <b>{tally.concern}</b></button><button className={`simulate-impact ${scenePlanProposalId === proposal.id ? "is-planning" : ""}`} aria-busy={scenePlanProposalId === proposal.id} aria-live="polite" disabled={incompleteAiText ? analysis === "working" || analysisCooldown > 0 : myVote !== "agree" || Boolean(scenePlanProposalId)} onClick={() => incompleteAiText ? void analyze() : simulateDecision(proposal)}>{incompleteAiText ? analysis === "working" ? "Regenerando…" : "Regenerar texto completo" : scenePlanProposalId === proposal.id ? <><span className="scene-planning-label"><i />Traduciendo la decisión al territorio…</span><small>Relacionando acciones, señales y riesgos visibles</small></> : myVote === "agree" ? "Probar en el territorio →" : "Apoya para probar"}</button></div>
              </article>;
            })}
          </div>

          <form className="composer decision-composer" onSubmit={submit}><div><label htmlFor="proposal">Añade una opción concreta</label><small>Acción, responsable y señal de éxito.</small></div><div><input id="proposal" value={text} onChange={event => setText(event.target.value)} maxLength={280} placeholder="Ej. Validar dos rutas antes de las 18:00…" /><button>Publicar</button></div></form></>}
        </section>

        <aside id="room-drawer" className={`right decision-right hud-drawer hud-drawer-right ${hudPanel === "room" ? "is-open" : ""}`} aria-hidden={hudPanel !== "room"}>
          <div className="hud-drawer-head"><div><small>CENTRO DE COORDINACIÓN</small><b>Sala y facilitación</b></div><button aria-label="Cerrar sala" onClick={() => setHudPanel(null)}>×</button></div>
          <section className="panel readiness-panel">
            <p className="eyebrow">PREPARACIÓN DE LA SALA</p>
            <div className="readiness-score"><b>{representation}%</b><span>Cobertura de perspectivas</span></div>
            <div className="mini-track"><i style={{ width: `${representation}%` }} /></div>
            <p>{representedRoles.size} de {roles.length} perspectivas están representadas por personas. Los agentes simulados no aumentan este indicador.</p>
            {missingRoles.length > 0 && <details><summary>¿Quién falta? <span>{missingRoles.length}</span></summary>{missingRoles.map(role => <small key={role}>{role}</small>)}</details>}
          </section>

          <section className="panel people-panel">
            <div className="rail-heading"><div><p className="eyebrow">EN LA SALA</p><h3>{participants.length} perfiles visibles</h3></div><span className="online-dot">{realtime.connected ? "Portal activo" : "demo local"}</span></div>
            {visibleParticipants.map(participant => <div className="person" key={participant.id}><span className={participant.kind} /><div><b>{participant.alias}</b><small>{participant.kind === "demo-agent" ? participant.role : `${participant.role} · tú`}</small></div></div>)}
            {participants.length > 2 && <button className="inline-disclosure" onClick={() => setShowAllPeople(value => !value)}>{showAllPeople ? "Mostrar menos" : `Ver ${participants.length - 2} perfiles más`}</button>}
            <button className="agent-round-button" onClick={runDemoAgents} disabled={agentStatus === "working" || !evidenceBundle}>{agentStatus === "working" ? "Agentes analizando…" : "Simular ronda con agentes IA"}</button>
            {agentStatus === "working" && <AnalysisProgress mode="agents" evidenceCount={evidenceBundle?.items.length ?? 0} />}
            <small className="data-disclaimer">Los 5 perfiles marcados como simulación generan perspectivas, pero no cuentan como personas ni emiten votos.</small>
          </section>

          <section className="panel community-chat">
            <div className="rail-heading"><div><p className="eyebrow">CONVERSACIÓN</p><h3>Preguntas del lugar</h3></div><span>{chat.length}</span></div>
            <div className="chat-feed">{chat.map(message => <p className={message.kind === "demo-agent" ? "simulated-message" : ""} key={message.id}><b>{message.alias}{message.kind === "demo-agent" ? " · AGENTE SIMULADO" : ""}</b>{message.text}</p>)}</div>
            <form onSubmit={sendChat}><input aria-label="Mensaje para la sala" value={chatText} onChange={event => setChatText(event.target.value)} placeholder="Pregunta o aporta contexto…" maxLength={180} /><button aria-label="Enviar mensaje">↑</button></form>
          </section>

          <section className="agent panel facilitator-panel">
            <p className="eyebrow">FACILITACIÓN · NO AUTORIDAD</p>
            <div className="facilitator-title"><div><span>IA</span><h2>KUSKA</h2></div>{bridge && <em className={`confidence-${bridge.confidence}`}>confianza {bridge.confidence === "high" ? "alta" : bridge.confidence === "medium" ? "media" : "baja"}</em>}</div>
            <p>{analysis === "working" ? "Contrastando evidencia, propuestas, conversación y votos humanos…" : evidenceBundle ? `${evidenceBundle.items.length} evidencias disponibles. KUSKA propone; las personas conservan la decisión.` : "Preparando el registro de evidencia antes de habilitar el análisis."}</p>
            <button className="primary" disabled={analysis === "working" || analysisCooldown > 0 || !evidenceBundle || proposals.filter(item => !item.bridge).length < 2} onClick={analyze}>{analysis === "working" ? "Analizando evidencia…" : analysisCooldown > 0 ? `Reintentar en ${analysisCooldown}s` : analysis === "error" ? "Reintentar análisis" : bridge ? "Actualizar análisis y propuesta" : "Analizar y proponer puente"}</button>
            {analysis === "error" && <div className="analysis-error" role="alert"><b>El análisis no se completó</b><span>{analysisCooldown > 0 ? `El límite se liberará automáticamente en ${analysisCooldown} segundos.` : "Puedes reintentar ahora. Tus propuestas y evidencias siguen guardadas."}</span></div>}
            {analysis === "working" && <AnalysisProgress mode="solutions" evidenceCount={evidenceBundle?.items.length ?? 0} />}
            {bridge && <details className="facilitator-detail"><summary>Ver análisis completo</summary><BridgeCarousel bridge={bridge} /></details>}
          </section>

          <section className="notice"><b>Última actividad</b><p>{note}</p><small>KUSKA explora alternativas; no sustituye autoridades ni especialistas.</small></section>
        </aside>
      </div>
    </main>
  );
}
