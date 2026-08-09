"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "evidence" | "agents" | "solutions";

const stages: Record<Mode, string[]> = {
  evidence: ["Conectando fuentes", "Normalizando señales", "Verificando procedencia", "Preparando evidencia"],
  agents: ["Leyendo el contexto", "Contrastando perspectivas", "Revisando referencias", "Preparando intervenciones"],
  solutions: ["Ordenando aportes", "Contrastando evidencia", "Generando alternativas", "Evaluando riesgos", "Preparando opciones para votar"],
};

const intervals: Record<Mode, number[]> = {
  evidence: [0, 3, 7, 12],
  agents: [0, 4, 9, 16],
  solutions: [0, 7, 20, 42, 70],
};

export function AnalysisProgress({ mode, evidenceCount = 0 }: { mode: Mode; evidenceCount?: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const current = useMemo(() => {
    const thresholds = intervals[mode];
    for (let index = thresholds.length - 1; index >= 0; index -= 1) if (seconds >= thresholds[index]) return index;
    return 0;
  }, [mode, seconds]);
  const labels = stages[mode], title = mode === "solutions" ? "KUSKA está construyendo soluciones" : mode === "agents" ? "Los agentes están deliberando" : "Construyendo el registro de evidencia";
  const hint = mode === "solutions" ? "El análisis profundo puede tardar hasta 2 minutos." : mode === "agents" ? "Los agentes no votan ni cuentan como personas." : "Consultamos solo fuentes disponibles y trazables.";

  return <div className={`analysis-progress progress-${mode}`} role="status" aria-live="polite" aria-label={`${title}. ${labels[current]}`}>
    <div className="progress-heading"><span className="progress-orbit"><i /><i /><i /></span><div><b>{title}</b><small>{labels[current]}{mode !== "evidence" && evidenceCount ? ` · ${evidenceCount} evidencias` : ""}</small></div><time>{seconds}s</time></div>
    <div className="progress-track" aria-hidden="true"><i style={{ width: `${Math.min(93, 12 + seconds * (mode === "solutions" ? 1 : 3))}%` }} /><span /></div>
    <ol>{labels.map((label, index) => <li className={index < current ? "done" : index === current ? "active" : ""} key={label}><i />{label}</li>)}</ol>
    <p>{hint}</p>
  </div>;
}
