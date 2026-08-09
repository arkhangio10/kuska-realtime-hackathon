"use client";

import { useState } from "react";
import type { BridgeResult } from "@/lib/kuska";

export function BridgeCarousel({ bridge }: { bridge: BridgeResult }) {
  const [index, setIndex] = useState(0);
  const slides = [
    { label: "Resumen", content: <><b>Por qué conecta</b><p>{bridge.rationale}</p><div className="interest-tags">{bridge.sharedInterests.map(item => <span key={item}>{item}</span>)}</div></> },
    { label: "Balance", content: <><b>Beneficios y costos</b>{bridge.tradeoffs.map(item => <div className="bridge-slide-item" key={`${item.affectedGroup}-${item.benefit}`}><p><strong>Beneficio</strong>{item.benefit}</p><p><strong>Riesgo</strong>{item.costOrRisk}</p><small>Grupo afectado: {item.affectedGroup}</small></div>)}</> },
    { label: "Evidencia", content: <><b>Evidencia utilizada</b>{bridge.evidenceUsed.map(item => <div className="bridge-slide-item" key={item.evidenceId}><span className="evidence-code">{item.evidenceId}</span><p>{item.fact}</p><small>{item.source} · confianza {item.reliability === "high" ? "alta" : item.reliability === "medium" ? "media" : "baja"}<br /><a href={item.sourceUrl} target="_blank" rel="noreferrer">Abrir evidencia ↗</a></small></div>)}</> },
    { label: "Plan", content: <><b>Plan y condiciones</b>{bridge.nextSteps.map((step, stepIndex) => <div className="bridge-slide-item plan" key={step.action}><span>{stepIndex + 1}</span><p>{step.action}<small>{step.possibleOwner} · {step.horizon}<br />Señal: {step.successSignal}</small></p></div>)}{bridge.rejectionConditions.map(item => <p className="stop-condition" key={item}>Detener o revisar: {item}</p>)}</> },
    { label: "Pendientes", content: <><b>Lo que falta confirmar</b>{bridge.unresolvedRisks.map(item => <p className="bridge-pending risk" key={item}>Riesgo: {item}</p>)}{bridge.assumptions.map(item => <p className="bridge-pending" key={item}>Supuesto: {item}</p>)}{bridge.unknowns.map(item => <p className="bridge-pending" key={item}>Dato faltante: {item}</p>)}</> },
  ];
  const current = Math.min(index, slides.length - 1);
  return <div className="bridge-carousel" aria-label="Análisis de KUSKA">
    <div className="carousel-toolbar"><button aria-label="Sección anterior" onClick={() => setIndex(value => (value - 1 + slides.length) % slides.length)}>←</button><div><small>ANÁLISIS {current + 1} DE {slides.length}</small><b>{slides[current].label}</b></div><button aria-label="Siguiente sección" onClick={() => setIndex(value => (value + 1) % slides.length)}>→</button></div>
    <div className="bridge-slide" aria-live="polite">{slides[current].content}</div>
    <div className="carousel-dots" aria-hidden="true">{slides.map((slide, slideIndex) => <i className={slideIndex === current ? "active" : ""} key={slide.label} />)}</div>
  </div>;
}
