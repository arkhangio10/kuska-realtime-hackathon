# Arquitectura

Next.js App Router sirve la misión. `lib/kuska.ts` concentra los tipos, validación Zod, semillas demo y fórmula determinista. `/api/signals` consulta Open-Meteo con timeout. `/api/bridge` llama Responses API en servidor, valida JSON y devuelve contingencia etiquetada si falla.
