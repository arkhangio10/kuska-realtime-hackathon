# KUSKA

**Juntos resolvemos lo que importa.** KUSKA convierte un problema real en una misión donde perspectivas distintas proponen, votan y buscan terreno común.

## MVP: inundaciones en Piura

La demo arranca sin registro, asigna un alias/perspectiva y permite publicar propuestas, votar y pedir una propuesta puente a KUSKA IA. Open-Meteo aporta una señal meteorológica real para Piura.

## Alertas reales

`/api/alerts` agrega el pronóstico actualizado de Open-Meteo para Piura y eventos de inundación publicados por GDACS. Los eventos GDACS se etiquetan como publicados por esa fuente; las señales meteorológicas son advertencias deterministas de KUSKA basadas en datos reales y nunca se presentan como avisos oficiales. Consulta `docs/ALERTS.md` para los umbrales.

`/api/cases` descubre casos puntuales recientes del feed GDACS, elimina países duplicados y consulta el pronóstico de las coordenadas de cada evento. El planeta se actualiza con esos países y cada selección alimenta su propia simulación.

## Arquitectura

`Fuentes oficiales/prensa → /api/evidence → registro trazable → agentes de demo → /api/bridge (OpenAI Responses) → decisión humana`

Portal sincroniza propuestas, votos y conversación de usuarios humanos cuando `NEXT_PUBLIC_PORTAL_API_KEY` está configurada. Sin clave, la interfaz conserva un modo demo local. Los agentes simulados se ejecutan en el servidor y siempre aparecen etiquetados; sus reacciones no cuentan como apoyo humano.

`/api/evidence` normaliza la fuente principal, indicadores, GDELT, USGS para sismos y NASA EONET. NASA FIRMS se activa con `NASA_FIRMS_MAP_KEY`; ReliefWeb se activa con un `RELIEFWEB_APPNAME` aprobado. Cada hecho recibe un ID que la facilitadora debe citar.

## Terreno común

`70% × apoyo` (votos de apoyo / votos no neutros) + `30% × participación` (votantes únicos / presentes), limitado a 100. Es un indicador de la sala, no una medición científica.

## Desarrollo

```bash
cp .env.example .env.local
npm install
npm run dev
npm run typecheck && npm run lint && npm run build
```

Variables: `NEXT_PUBLIC_PORTAL_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_AGENT_MODEL`, `NASA_FIRMS_MAP_KEY` y `RELIEFWEB_APPNAME`. Nunca expongas claves privadas en el navegador.

## Privacidad y límites

No se solicitan nombres, teléfonos ni ubicaciones precisas. KUSKA explora alternativas y no sustituye autoridades ni especialistas. La IA tiene validación de salida y un fallback etiquetado si no responde.
