import { Portal } from "@portalsdk/core";

const apiKey = process.env.NEXT_PUBLIC_PORTAL_API_KEY?.trim();
if (!apiKey) throw new Error("Falta NEXT_PUBLIC_PORTAL_API_KEY en .env.local.");

const baseUrl = process.env.KUSKA_BASE_URL?.trim() || "http://localhost:3000";
const timeoutMs = Number(process.env.PORTAL_TEST_TIMEOUT_MS || 30_000);
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const users = [
  { alias: "Ana QA", role: "Vecina de la zona" },
  { alias: "Luz QA", role: "Brigadista comunitario" },
  { alias: "Diego QA", role: "Comerciante local" },
  { alias: "Inés QA", role: "Especialista técnico" },
];

const proposals = {
  earthquake: "Verificar estructuras dañadas y señalizar rutas inspeccionadas antes de movilizar personas.",
  wildfire: "Confirmar el perímetro del incendio y activar una red vecinal para comunicar cambios del humo.",
  flood: "Validar cruces transitables y organizar apoyo para hogares con barreras de movilidad.",
  cyclone: "Confirmar refugios operativos y el criterio oficial para suspender la movilidad.",
  volcano: "Confirmar la zona de exclusión y rutas que eviten ceniza y lahares.",
  drought: "Acordar usos prioritarios del agua y un registro verificable de abastecimiento.",
};

const waitFor = async (condition, label) => {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Tiempo agotado esperando ${label}.`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

const feedResponse = await fetch(`${baseUrl}/api/cases`, { signal: AbortSignal.timeout(10_000) });
if (!feedResponse.ok) throw new Error(`No se pudo cargar ${baseUrl}/api/cases (${feedResponse.status}). Inicia KUSKA antes de ejecutar esta prueba.`);
const feed = await feedResponse.json();
const selectedCases = [];
const hazards = new Set();
for (const item of feed.cases ?? []) {
  if (item.dataState === "preventive" || hazards.has(item.hazardKind)) continue;
  hazards.add(item.hazardKind);
  selectedCases.push(item);
  if (selectedCases.length === 3) break;
}
if (!selectedCases.length) throw new Error("La fuente de casos no devolvió problemas reales activos o recientes.");

const results = [];
for (const caseStudy of selectedCases) {
  const channelId = `kuska:test:${caseStudy.id}:${runId}`;
  const handles = users.map(user => new Portal({ apiKey }).channel(channelId, { history: "none", metadata: { ...user, kind: "human", testRun: runId } }));
  const spatialHandles = users.map(user => new Portal({ apiKey }).channel(`${channelId}:world`, { history: "none", metadata: { ...user, kind: "human", testRun: runId } }));
  const spatialMessages = handles.map(() => []);
  const unsubscribe = spatialHandles.map((handle, receiverIndex) => handle.on("message", message => {
    if (message.type === "player.moved" && message.content?.kind === "player.moved") spatialMessages[receiverIndex].push(message);
  }));
  try {
    handles.forEach(handle => handle.acquire());
    spatialHandles.forEach(handle => handle.acquire());
    await waitFor(() => handles.every(handle => handle.status === "ready"), `${users.length} conexiones Portal en ${caseStudy.country}`);
    await waitFor(() => spatialHandles.every(handle => handle.status === "ready"), `${users.length} conexiones espaciales Portal en ${caseStudy.country}`);
    await waitFor(() => handles.every(handle => (handle.presence?.count ?? 0) >= users.length), `presencia compartida en ${caseStudy.country}`);

    const proposalId = `qa-${runId}-${caseStudy.id}`.slice(0, 80);
    const text = proposals[caseStudy.hazardKind] || `Verificar responsables, perímetro y señales oficiales para ${caseStudy.hazardLabel}.`;
    const createdAt = new Date().toISOString();
    const event = { eventId: `${proposalId}-created`, kind: "proposal.created", createdAt, actor: { id: "client-local", ...users[0], kind: "human" }, proposal: { id: proposalId, text, author: { id: "client-local", ...users[0], kind: "human" }, createdAt } };
    await handles[0].send({ type: event.kind, content: event });
    const alternative = { eventId: `${proposalId}-alternative`, kind: "alternative.created", createdAt, actor: { id: "client-local", ...users[1], kind: "human" }, proposal: { id: `${proposalId}-ai`.slice(0, 80), text: "Coordinar una verificación local con responsables y señales de activación antes de ejecutar medidas.", author: { id: "kuska-ia", alias: "KUSKA IA", role: "Generadora de alternativas", kind: "agent" }, createdAt, generation: "openai" } };
    await handles[1].send({ type: alternative.kind, content: alternative });
    for (let index = 0; index < users.length; index++) {
      const vote = { eventId: `${proposalId}-vote-${index}`, kind: "vote.cast", createdAt: new Date().toISOString(), actor: { id: `client-${index}`, ...users[index], kind: "human" }, vote: { proposalId, actorId: `client-${index}`, value: index === users.length - 1 ? "concern" : "agree" } };
      await handles[index].send({ type: vote.kind, content: vote });
    }
    const closed = { eventId: `${proposalId}-closed`, kind: "decision.closed", createdAt: new Date().toISOString(), actor: { id: "client-local", ...users[0], kind: "human" }, proposalId, agree: users.length - 1, concern: 1, participantCount: users.length, eligibleCount: users.length };
    await handles[0].send({ type: closed.kind, content: closed });
    const chat = { eventId: `${proposalId}-chat`, kind: "chat.created", createdAt: new Date().toISOString(), actor: { id: "client-local", ...users[2], kind: "human" }, chat: { id: `${proposalId}-message`, alias: users[2].alias, text: "Mensaje de prueba compartido en el territorio y la mesa de acuerdos.", kind: "human" } };
    await handles[2].send({ type: chat.kind, content: chat });

    const expectedMessages = users.length + 4;
    await waitFor(() => handles.every(handle => handle.messages.filter(message => !message.retracted).length >= expectedMessages), `convergencia de mensajes en ${caseStudy.country}`);
    const senderCounts = handles.map(handle => new Set(handle.messages.map(message => message.sender.id)).size);
    if (senderCounts.some(count => count < users.length)) throw new Error(`Portal no distinguió las ${users.length} identidades en ${caseStudy.country}.`);
    for (let pulse = 0; pulse < 6; pulse++) {
      await Promise.all(spatialHandles.map((handle, index) => handle.send({ type: "player.moved", content: { kind: "player.moved", sentAt: Date.now(), actor: { id: `spoofed-${index}`, ...users[index], kind: "human" }, position: { x: -7 + index * 2 + pulse * .02, z: 8 - index, rotation: index * .4, moving: true, visible: true } } })));
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    await waitFor(() => spatialMessages.every(items => new Set(items.map(message => message.sender.id)).size >= users.length - 1), `movimiento espacial efímero en ${caseStudy.country}`);
    results.push({ case: caseStudy.country, hazard: caseStudy.hazardLabel, channelId, users: users.length, messages: expectedMessages, spatial: "live channel ok", presence: handles[0].presence?.count ?? 0 });
  } finally {
    unsubscribe.forEach(stop => stop());
    handles.forEach(handle => handle.release());
    spatialHandles.forEach(handle => handle.release());
  }
}

console.table(results);
console.log(`Portal multijugador verificado: ${results.length} casos reales, ${users.length} usuarios por caso, chat, decisión cerrada y movimiento en canal espacial.`);
await new Promise(resolve => setTimeout(resolve, 3_500));
