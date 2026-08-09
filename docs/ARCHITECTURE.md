# Arquitectura

KUSKA es una aplicación Next.js App Router con React, TypeScript, Three.js, Portal SDK, OpenAI SDK y Zod. El recorrido principal es: planeta de casos reales → territorio multijugador → mesa de acuerdos → simulación visual de la decisión.

## Datos y normalización

- `/api/cases` combina eventos activos o recientes de **GDACS** e **IFRC GO**, los normaliza como `CaseStudy`, limita la antigüedad aceptada y conserva la procedencia, fecha, coordenadas, severidad y métricas.
- `/api/news` consulta **GDELT** para contexto periodístico sin modificar la fuente oficial.
- `/api/evidence` construye un registro trazable con la señal principal y, según el caso, **USGS**, **NASA EONET**, **NASA FIRMS** y **ReliefWeb**.
- `/api/signals` ofrece contexto meteorológico de **Open-Meteo** y mantiene el caso preventivo de Piura como contingencia si las fuentes globales no están disponibles.

Una fuente fallida se incluye en `unavailableSources`; no se inventan datos para reemplazarla.

## Mundo multijugador con Portal

Cada emergencia usa dos canales aislados por `caseId`:

### Canal de colaboración

`kuska:mission:live:<caseId>` recupera hasta 80 eventos para participantes que llegan después. Sincroniza:

- `proposal.created`: aportes creados por personas;
- `alternative.created`: alternativas de IA promovidas por una persona a la sala;
- `vote.cast`: apoyo, preocupación o abstención humana;
- `chat.created`: conversación breve del lugar;
- presencia con `alias`, `role` y `kind`.

La identidad operativa siempre se toma de `message.sender.id`, verificado por Portal. Los mensajes se validan con Zod, se deduplican por `eventId`, se aplican de forma optimista y permanecen debajo de 1,900 bytes.

### Canal espacial

`kuska:mission:live:<caseId>:world` transporta `player.moved` sin recuperar historial. Mientras camina, cada cliente publica posición, orientación y estado hasta cinco veces por segundo; en reposo envía un pulso cada 1.5 segundos. El receptor:

- vincula el avatar al remitente verificado por Portal;
- rechaza coordenadas u orientaciones fuera del terreno;
- interpola movimiento para evitar saltos visuales;
- elimina avatares remotos inactivos;
- conserva la cámara como estado privado de cada usuario.

El terreno y las colisiones se calculan localmente de forma determinista, de modo que todas las personas comparten el mismo plano sin transmitir la geometría completa.

## IA y contingencias

- `/api/bridge` usa OpenAI Responses API para generar alternativas comparables con evidencia, beneficios, riesgos, responsables y condiciones. La salida se valida como `BridgeResult`.
- `/api/demo-agents/turn` genera perspectivas simuladas claramente etiquetadas. No publica presencia ni votos humanos.
- `/api/scene-plan` traduce la decisión elegida a un plan visual estructurado. La escena relaciona cada acción con un elemento numerado, pero se presenta como representación no predictiva.

Las tres rutas se ejecutan en servidor y nunca exponen `OPENAI_API_KEY`. Si el modelo falla, excede el tiempo o devuelve una estructura inválida, una contingencia determinista produce una respuesta etiquetada como tal.

## Seguridad y límites

- `NEXT_PUBLIC_PORTAL_API_KEY` es una clave publicable y producción debe figurar en Allowed Origins.
- Todas las entradas externas se validan y se limitan en tamaño.
- Los agentes simulados permanecen separados de las personas y nunca cuentan en participación ni votación.
- La IA no activa medidas, no declara consenso y no sustituye autoridades, especialistas o instrucciones oficiales.
- La simulación comunica acciones, supuestos y riesgos pendientes; no predice el impacto físico real.
