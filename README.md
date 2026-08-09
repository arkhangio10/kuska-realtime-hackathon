# KUSKA

**Inteligencia colectiva para convertir alertas reales en decisiones comunitarias.**

KUSKA es una experiencia colaborativa en tiempo real para explorar desastres naturales y emergencias, comprender evidencia verificable, construir alternativas con asistencia de IA, votar como comunidad y observar una representación visual no predictiva del posible impacto de la decisión.

Repositorio oficial de **The Realtime Hackathon by Portal**: [arkhangio10/kuska-realtime-hackathon](https://github.com/arkhangio10/kuska-realtime-hackathon)

**Demo en producción:** [kuska-realtime-hackathon.vercel.app](https://kuska-realtime-hackathon.vercel.app/)

## El problema

Durante una emergencia, las alertas, noticias y opiniones locales llegan desde fuentes distintas. Esto dificulta entender qué está confirmado, qué falta validar y qué respuesta puede ejecutar realmente una comunidad.

KUSKA reúne esas capas en una sola misión:

- muestra casos reales, activos o recientes, sobre un planeta interactivo;
- organiza evidencia oficial, humanitaria, satelital y periodística;
- incorpora perspectivas humanas y agentes de demostración claramente etiquetados;
- usa IA para proponer alternativas trazables, no para tomar la decisión;
- sincroniza avatares, conversación, propuestas, alternativas de IA y votos con Portal;
- traduce la opción elegida a una escena voxel para hacer visibles sus acciones, beneficios, riesgos y supuestos.

## Flujo de la experiencia

1. **Elegir un caso:** el usuario gira el planeta y selecciona una ubicación alimentada por fuentes reales.
2. **Entender:** revisa el fenómeno, sus indicadores, la evidencia disponible y las preguntas aún abiertas.
3. **Comparar:** KUSKA IA cruza fuentes, aportes y preocupaciones para generar posibles soluciones.
4. **Decidir:** las personas apoyan una alternativa o señalan una preocupación. Los agentes simulados nunca cuentan como votos humanos.
5. **Probar en el territorio:** la IA convierte la decisión en un plan de escena validado; la simulación muestra elementos relacionados con las acciones acordadas y conserva visibles los riesgos pendientes.

La escena final es una herramienta de comunicación y deliberación. **No predice el futuro, no confirma que una ruta sea segura y no reemplaza instrucciones oficiales ni evaluación técnica local.**

## Portal: colaboración en tiempo real

Portal es la capa multijugador de KUSKA. Cada caso utiliza una sala aislada y sincroniza:

- presencia de participantes;
- posición y orientación de avatares remotos dentro del territorio 3D;
- propuestas comunitarias;
- alternativas generadas por IA que una persona comparte con la sala;
- apoyos y preocupaciones;
- cierre de la votación y decisión seleccionada;
- conversación del lugar;
- historial para participantes que llegan después.

La identidad de cada evento se vincula al remitente verificado por Portal. La colaboración persistente y el movimiento espacial usan canales separados por caso: quienes llegan tarde recuperan acuerdos, mientras que los avatares reciben únicamente posiciones actuales. Los eventos se validan con Zod, se deduplican por `eventId` y se mantienen debajo del límite de mensajes del SDK. Si no existe `NEXT_PUBLIC_PORTAL_API_KEY`, la aplicación funciona en un modo local indicado explícitamente en la interfaz.

Más detalles: [docs/PORTAL.md](docs/PORTAL.md).

## Qué hace la IA

La IA actúa como **facilitadora sin autoridad**:

- resume evidencia sin ocultar su procedencia;
- identifica coincidencias, conflictos y vacíos de información;
- integra aportes de la comunidad en alternativas comparables;
- propone acciones, responsables, condiciones de activación, beneficios y riesgos;
- genera un plan visual estructurado para representar la decisión en el territorio.

Las respuestas se generan en el servidor mediante OpenAI Responses API y se validan contra esquemas estrictos. Si el modelo no responde o devuelve una estructura inválida, KUSKA utiliza una contingencia determinista y la etiqueta como tal. Las claves privadas nunca se envían al navegador.

## Fuentes de datos

| Fuente | Uso en KUSKA | Estado |
| --- | --- | --- |
| GDACS | Eventos y nivel de alerta de múltiples tipos de desastre | Activa |
| IFRC GO | Emergencias humanitarias recientes | Activa |
| Open-Meteo | Contexto meteorológico para las coordenadas del caso | Activa |
| USGS | Evidencia adicional para sismos | Activa según el caso |
| NASA EONET | Eventos naturales cercanos | Activa según el caso |
| NASA FIRMS | Detecciones térmicas recientes para incendios | Requiere `NASA_FIRMS_MAP_KEY` |
| GDELT | Contexto periodístico relacionado | Activa cuando hay resultados |
| ReliefWeb | Informes humanitarios complementarios | Requiere `RELIEFWEB_APPNAME` aprobado |

Cada evidencia conserva fuente, enlace, fecha, ubicación y nivel de confiabilidad. Una fuente temporalmente indisponible se reporta como ausente; no se reemplaza por un dato ficticio.

## Arquitectura

```text
GDACS · IFRC GO · Open-Meteo · USGS · NASA · GDELT · ReliefWeb
                              │
                              ▼
              APIs de casos, noticias y evidencia
                              │
                              ▼
              Registro normalizado y trazable
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   Portal: avatares, alternativas    OpenAI: alternativas y
   y acuerdos en tiempo real         plan de escena validado
              │                               │
              └───────────────┬───────────────┘
                              ▼
                Decisión humana y simulación voxel
```

La aplicación usa Next.js App Router, React, TypeScript, Three.js, Portal SDK, OpenAI SDK y Zod. Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para la descripción técnica y [docs/ALERTS.md](docs/ALERTS.md) para la clasificación de señales.

## Ejecutar localmente

### Requisitos

- Node.js 20 o superior.
- npm.
- Una clave publicable de Portal para probar colaboración real.
- Una API key de OpenAI para las funciones de facilitación y planificación visual.

### Instalación

```bash
git clone https://github.com/arkhangio10/kuska-realtime-hackathon.git
cd kuska-realtime-hackathon
npm install
cp .env.example .env.local
npm run dev
```

En PowerShell, crea el archivo de entorno con:

```powershell
Copy-Item .env.example .env.local
```

Abre [http://localhost:3000](http://localhost:3000).

## Variables de entorno

```env
NEXT_PUBLIC_PORTAL_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_AGENT_MODEL=
OPENAI_SCENE_MODEL=
NASA_FIRMS_MAP_KEY=
RELIEFWEB_APPNAME=
```

| Variable | Propósito | Obligatoria |
| --- | --- | --- |
| `NEXT_PUBLIC_PORTAL_API_KEY` | Conectar presencia y eventos en Portal | Para tiempo real |
| `OPENAI_API_KEY` | Generar alternativas y planes de escena en el servidor | Para IA |
| `OPENAI_MODEL` | Modelo principal de facilitación | No; tiene valor por defecto |
| `OPENAI_AGENT_MODEL` | Modelo para perspectivas de agentes demo | No |
| `OPENAI_SCENE_MODEL` | Modelo para traducir la decisión a la escena | No |
| `NASA_FIRMS_MAP_KEY` | Consultar detecciones térmicas de NASA FIRMS | Solo para FIRMS |
| `RELIEFWEB_APPNAME` | Identificador aprobado para ReliefWeb | Solo para ReliefWeb |

No subas `.env.local`. El archivo ya está excluido por `.gitignore`; `.env.example` contiene únicamente nombres de variables y valores no secretos.

## Pruebas y verificación

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Prueba determinista de colaboración, sin usar la red:

```bash
npm run test:collaboration
```

Prueba multijugador contra Portal real, con el servidor local activo y las variables configuradas:

```bash
npm run dev
npm run test:portal
```

El smoke test abre cuatro clientes aislados por caso y comprueba presencia, movimiento espacial, entrega de propuestas, sincronización de alternativas de IA, votos, cierre compartido de la decisión y convergencia del estado sin escribir en las salas normales de la demo.

## Equipo

**SOINAR** — Abel Brayan Mancilla Montesinos.

## Privacidad, seguridad y límites

- KUSKA no solicita nombres legales, teléfonos ni ubicaciones personales precisas.
- Los perfiles simulados aparecen etiquetados y no cuentan como personas o votos humanos.
- La IA no declara consenso, no activa medidas y no sustituye autoridades o especialistas.
- Las métricas describen las fuentes; no garantizan el impacto local.
- Los resultados visuales comunican una hipótesis de intervención, no una predicción física certificada.
- Toda acción crítica debe confirmar responsables, recursos, perímetro y canales oficiales.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Integración con Portal](docs/PORTAL.md)
- [Alertas y fuentes](docs/ALERTS.md)
- [Guion de demostración](docs/DEMO_SCRIPT.md)
- [Prueba para jueces](docs/JUDGE_TEST.md)
- [Checklist de entrega](docs/SUBMISSION_CHECKLIST.md)

---

**KUSKA** significa *juntos* en quechua. La tecnología propone caminos; la comunidad conserva la decisión.
