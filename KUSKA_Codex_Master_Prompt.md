# Prompt maestro para desarrollar KUSKA en Codex

Actúa como un equipo senior compuesto por product engineer, frontend engineer, backend engineer, diseñador de producto, especialista en sistemas en tiempo real, especialista en IA aplicada y evaluador de hackathons. Trabaja con autonomía dentro del repositorio actual y entrega un producto funcional, desplegado, comprobable y listo para presentarse en **The Realtime Hackathon by Portal**.

No te limites a proponer arquitectura ni a escribir un plan. Inspecciona el repositorio, planifica, implementa, ejecuta las pruebas, corrige los errores, valida visualmente la experiencia y deja la entrega preparada. Solo detente para preguntar si existe un bloqueo real que requiera una credencial, permiso, decisión irreversible o acceso externo que no tengas.

## 1. Nombre e identidad

El producto se llama **KUSKA**.

Significado de marca: “juntos”.

Lema principal:

> Juntos resolvemos lo que importa.

Descripción:

> KUSKA convierte problemas reales del mundo en misiones vivas donde personas, fuentes de datos y agentes de IA investigan, proponen, simulan alternativas y construyen acuerdos en tiempo real.

La aplicación debe sentirse latinoamericana y contemporánea, pero no folclórica ni turística. Evita clichés visuales andinos, degradados genéricos de productos de IA, exceso de emojis, interfaces tipo chatbot y dashboards corporativos convencionales.

## 2. Objetivo del producto

Construye una experiencia web multijugador en la que varias personas entran a una misión sobre un problema real, reciben perspectivas parciales diferentes, aportan propuestas, reaccionan a las propuestas de otros y observan cómo un agente de IA encuentra intereses compatibles y formula una propuesta puente.

El propósito no es que la IA “resuelva el mundo”. La IA debe ayudar a la comunidad a:

1. ordenar información fragmentada;
2. distinguir hechos, supuestos y opiniones;
3. detectar intereses compartidos;
4. comparar alternativas;
5. formular una acción común verificable.

La inteligencia colectiva humana debe seguir siendo el centro. La IA actúa como facilitadora y analista, no como autoridad política, policial, científica o moral.

## 3. Restricciones de la hackathon

La entrega debe cumplir obligatoriamente con lo siguiente:

- incluir una capacidad real de inteligencia artificial;
- usar Portal como parte esencial de la experiencia;
- incluir interacción significativa en tiempo real impulsada por Portal;
- conectar usuarios, agentes y una fuente de datos independiente;
- funcionar como producto, no como presentación;
- ser accesible desde una URL desplegada;
- tener un repositorio público de GitHub;
- poder entenderse y probarse rápidamente;
- poder demostrarse en un video de máximo 90 segundos;
- estar disponible en español, con arquitectura preparada para inglés;
- no depender de hardware, cámaras municipales, permisos institucionales ni datasets privados.

Portal no puede ser una integración decorativa. Si Portal se elimina, deben dejar de funcionar la presencia, la sincronización de propuestas, las reacciones, la actividad del agente y la evolución compartida de la misión.

Consulta la documentación actual antes de implementar y no inventes APIs:

- Portal: https://docs.useportal.co/
- React `useChannel`: https://docs.useportal.co/react/use-channel
- OpenAI Responses API: https://developers.openai.com/api/docs/guides/text

## 4. Experiencia central del MVP

Implementa una sola misión completamente funcional:

### Misión inicial

**Inundaciones en Piura, Perú**

Pregunta de la misión:

> ¿Cómo reducimos el impacto de la próxima inundación?

No construyas todavía una plataforma extensa con decenas de problemas. Las tarjetas de otras ciudades pueden aparecer para comunicar la visión del producto, pero deben estar etiquetadas como “próximamente” o desactivadas. Todo el esfuerzo funcional debe concentrarse en Piura.

### Recorrido del usuario

1. El usuario abre la URL sin crear una cuenta.
2. Ve un mundo vivo con marcadores de misiones.
3. Selecciona Piura.
4. Se une de forma anónima a la sala de Portal.
5. Recibe un alias y una perspectiva parcial, por ejemplo:
   - vecina de Catacaos;
   - comerciante local;
   - brigadista comunitario;
   - ingeniero hidráulico;
   - personal de salud;
   - coordinador municipal.
6. Ve únicamente parte de la información al inicio. La interfaz debe explicar que otros participantes poseen perspectivas complementarias.
7. Consulta señales con fuente y hora de actualización.
8. Publica una propuesta concreta.
9. Vota o marca una preocupación sobre propuestas de otros.
10. Ve en vivo la actividad de personas y agentes.
11. Activa o presencia el análisis de KUSKA IA.
12. El agente identifica coincidencias y publica una propuesta puente.
13. Los participantes votan la nueva propuesta.
14. El consenso se recalcula de manera transparente.
15. La sala genera un pequeño plan de acción: acción, responsable posible, plazo y señal de éxito.

## 5. Momento sorprendente de la demo

El momento principal debe suceder en menos de 60 segundos:

- la sala muestra dos grupos con prioridades diferentes;
- el jurado vota una o dos propuestas;
- la visualización se mueve inmediatamente;
- KUSKA IA aparece como agente activo;
- formula una propuesta puente basada en las ideas reales de la sala;
- los participantes votan el puente;
- los grupos se acercan visualmente y el nivel de terreno común aumenta.

No incrementes el consenso arbitrariamente solo porque apareció una respuesta de IA. El porcentaje debe derivarse de votos reales o de participantes simulados claramente identificados como agentes de demostración. Nunca presentes bots como personas reales.

## 6. Diseño visual

Conserva o crea una interfaz de alta calidad con estas características:

- fondo marfil o gris verdoso muy claro;
- verde profundo como color principal;
- verde lima como señal de inteligencia, conexión y acuerdo;
- terracota para urgencia;
- tipografía sans serif limpia, con titulares compactos;
- bordes suaves, tarjetas precisas y sombras mínimas;
- alta densidad informativa sin perder claridad;
- diseño responsive para escritorio y móvil;
- navegación por teclado, estados de foco y etiquetas accesibles;
- respeto por `prefers-reduced-motion`.

La vista de escritorio debe tener:

- columna izquierda: mundo y misiones;
- zona central: problema, pulso, consenso, propuestas y compositor;
- columna derecha: presencia, agente, actividad e impacto posible.

La primera pantalla debe mostrar el producto funcionando. No empieces con un hero de marketing que obligue al jurado a desplazarse o registrarse.

## 7. Arquitectura recomendada

Trabaja con la arquitectura existente si ya es razonable. Si el repositorio está vacío, utiliza:

- Next.js con App Router;
- React y TypeScript estricto;
- CSS Modules, Tailwind o el sistema ya presente, sin introducir dos sistemas de estilos;
- `@portalsdk/core` y `@portalsdk/react`;
- OpenAI Responses API desde el servidor;
- una fuente pública de contexto como Open-Meteo;
- validación de entradas con Zod o una alternativa existente;
- pruebas unitarias y, cuando sea viable, Playwright para el flujo crítico.

No añadas una base de datos si Portal y un pequeño estado servidor son suficientes para el MVP. Agrega persistencia adicional únicamente si resuelve una necesidad demostrable que Portal no cubre.

Mantén las credenciales únicamente en variables de entorno. Incluye `.env.example`, nunca claves reales.

Variables previstas:

```text
NEXT_PUBLIC_PORTAL_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
```

No expongas `OPENAI_API_KEY` al navegador. La clave publicable de Portal sí puede usarse en el cliente según su documentación.

## 8. Uso obligatorio de Portal

Implementa Portal de forma visible y esencial.

### Canal

Usa un canal por misión, por ejemplo:

```text
kuska:mission:piura-2026
```

Verifica primero qué caracteres admite la versión actual de Portal y adapta el identificador si fuera necesario.

### Presence

Cada participante debe aparecer mediante presencia con metadatos pequeños:

```ts
{
  alias: string;
  role: string;
  location?: string;
  kind: "human" | "agent" | "demo-agent";
}
```

La interfaz debe mostrar quién está presente y diferenciar personas, agente de IA y participantes simulados de demostración.

### Mensajes persistentes

Utilízalos para eventos que un participante tardío debe recuperar:

- `proposal.created`;
- `vote.cast` o el evento autoritativo equivalente;
- `bridge.created`;
- `action-plan.created`;
- `source.added` cuando corresponda.

Cada payload debe tener un `eventId`, versión de esquema, autor, hora e identificador de misión. Mantén cada mensaje por debajo de los límites publicados por Portal. No envíes documentos largos ni multimedia a través de Portal.

### Eventos efímeros

Utilízalos para efectos instantáneos no históricos:

- animación de un voto;
- selección o atención temporal;
- pulso de reacción;
- cursor, si se implementa;
- estado transitorio “analizando”.

No uses exclusivamente eventos efímeros para datos que los usuarios tardíos necesiten reconstruir.

### Actividad del agente

KUSKA IA debe sentirse como un participante visible:

- “leyendo nuevas propuestas”;
- “contrastando intereses”;
- “evaluando riesgos”;
- “preparando una propuesta puente”.

Usa la API documentada de actividad o typing de Portal. No simules indefinidamente un estado de análisis si no existe una ejecución real.

### Sincronización y reconexión

- Dos navegadores deben ver propuestas y votos sin recargar.
- Un usuario que entra tarde debe recuperar el estado esencial.
- Evita duplicar eventos al reconectar.
- Utiliza IDs idempotentes.
- Reconstruye el estado a partir de eventos persistentes o de una extensión/snapshot de Portal si la documentación actual lo permite.
- Si implementas una extensión de canal, úsala como estado autoritativo y verifica su API en la documentación antes de escribir código.

### Inbox y notificaciones

Es una mejora P1, no P0. Si hay tiempo, notifica al autor cuando:

- su propuesta se incorpora a un puente;
- su propuesta alcanza un umbral de apoyo;
- la sala publica el plan final.

## 9. Modelo de eventos

Define un esquema discriminado parecido a este, ajustándolo a la API real:

```ts
type KuskaEvent =
  | { schema: 1; eventId: string; kind: "proposal.created"; missionId: string; proposalId: string; text: string; author: ActorRef; createdAt: string }
  | { schema: 1; eventId: string; kind: "vote.cast"; missionId: string; proposalId: string; value: "agree" | "concern" | "pass"; author: ActorRef; createdAt: string }
  | { schema: 1; eventId: string; kind: "bridge.created"; missionId: string; bridgeId: string; text: string; basedOn: string[]; author: ActorRef; createdAt: string }
  | { schema: 1; eventId: string; kind: "action-plan.created"; missionId: string; steps: ActionStep[]; author: ActorRef; createdAt: string }
  | { schema: 1; eventId: string; kind: "reaction.pulse"; missionId: string; proposalId: string; value: string; createdAt: string };
```

Valida entradas y límites en cliente y servidor. No confíes en texto enviado por participantes. Escapa contenido y evita inyección en prompts.

## 10. Inteligencia artificial

La IA debe ser real y ejecutarse desde una ruta de servidor.

Usa OpenAI Responses API y permite configurar el modelo mediante `OPENAI_MODEL`. Selecciona un modelo de baja latencia disponible en la cuenta; no fijes en código un modelo que no esté confirmado. Mantén una respuesta de respaldo únicamente para resiliencia y etiqueta en logs cuándo se utilizó.

### Entrada del agente

Proporciona al modelo:

- pregunta de la misión;
- propuestas actuales;
- recuentos agregados de votos;
- preocupaciones principales;
- perspectivas presentes;
- datos externos con fuente y fecha;
- hechos y supuestos diferenciados.

No envíes información personal, ubicación exacta ni contenido innecesario.

### Salida estructurada

Solicita y valida una salida con este sentido:

```ts
{
  bridge: string;
  sharedInterests: string[];
  unresolvedRisks: string[];
  basedOnProposalIds: string[];
  nextSteps: Array<{
    action: string;
    possibleOwner: string;
    horizon: string;
    successSignal: string;
  }>;
  confidence: "low" | "medium" | "high";
}
```

La propuesta puente debe:

- tener máximo 50 palabras;
- ser concreta y ejecutable;
- integrar al menos dos intereses diferentes;
- indicar incertidumbre cuando corresponda;
- no inventar cifras ni fuentes;
- no afirmar que existe consenso hasta que las personas voten;
- no recomendar acciones peligrosas o ilegales.

### Separación de responsabilidades

- La IA formula alternativas y explica coincidencias.
- El algoritmo de la aplicación calcula votos y consenso.
- Las personas aceptan, rechazan o modifican el puente.
- La interfaz muestra qué parte fue generada por IA.

## 11. Datos reales

Implementa como mínimo una fuente real, accesible y estable. Para el MVP puede ser Open-Meteo con coordenadas de Piura.

Cada señal debe mostrar:

- nombre de la fuente;
- enlace cuando sea posible;
- fecha y hora de actualización;
- tipo: dato en vivo, noticia, reporte comunitario o escenario de demostración;
- estado de disponibilidad.

No presentes una noticia antigua como evento en vivo. No inventes datos policiales. Si se incorporan datos públicos de INDECI, SENAMHI, COEN, Policía Nacional u otra institución, utiliza únicamente fuentes públicas autorizadas, respeta sus condiciones y diferencia claramente información oficial de reportes ciudadanos.

Si una fuente falla, conserva la misión utilizable y muestra “Fuente temporalmente no disponible”. No reemplaces silenciosamente datos reales por valores ficticios.

## 12. Consenso y visualización

Implementa un indicador comprensible, no una cifra misteriosa.

Para el MVP, calcula terreno común usando una fórmula determinista documentada. Una opción sencilla:

```text
supportRate = agree / (agree + concern + pass ponderado)
participationFactor = votersUnique / participantsPresent
consensusScore = combinación limitada de supportRate y participationFactor
```

Documenta la fórmula en el README y ofrece un tooltip “Cómo se calcula”. Evita presentar 78% como precisión científica. Considera mostrar “apoyo actual” o “terreno común” en lugar de “consenso” cuando la muestra sea pequeña.

La visualización de grupos puede ser inicialmente una representación determinista por prioridades o roles. No afirmes haber realizado clustering avanzado si solo existe una división visual predefinida.

## 13. Modo demostración

Incluye un modo de demostración fiable para el jurado:

- sala precargada con 3 a 6 propuestas;
- participantes simulados etiquetados como `demo-agent`;
- eventos emitidos realmente por Portal, no animaciones locales aisladas;
- botón para reiniciar la misión a un estado conocido;
- semilla reproducible;
- sin dependencia de que otras personas estén conectadas.

La funcionalidad central debe continuar siendo real: el voto del jurado debe atravesar Portal, cambiar el estado compartido y alimentar la generación del puente.

## 14. Seguridad, privacidad y ética

- No implementes reconocimiento facial.
- No utilices cámaras públicas ni vigilancia.
- No recolectes nombres reales, teléfonos ni ubicaciones precisas.
- Usa alias anónimos.
- No publiques secretos en el repositorio.
- Limita longitud y frecuencia de mensajes.
- Agrega rate limiting básico a las rutas de IA si la infraestructura lo permite.
- Valida payloads y evita prompt injection mediante delimitación y tratamiento de propuestas como datos no confiables.
- Registra errores técnicos, pero no contenido personal.
- Incluye una nota visible: “KUSKA ayuda a explorar alternativas; no sustituye a autoridades ni especialistas”.

## 15. Resiliencia

La demo no debe quedar bloqueada si un servicio externo tarda.

- timeout corto para la llamada del modelo;
- estado de progreso visible;
- posibilidad de reintentar;
- respuesta de respaldo claramente registrada, sin fingir que fue generada por el modelo;
- reconexión de Portal;
- prevención de dobles envíos;
- mensajes de error útiles;
- fuente en vivo con fallback de indisponibilidad, no con datos ficticios silenciosos.

No ocultes errores con `catch {}` vacío. Registra la causa en servidor y comunica un estado comprensible al usuario.

## 16. Prioridades de implementación

### P0 — Debe funcionar

1. Abrir la URL sin registro.
2. Entrar a la misión Piura.
3. Conectar a Portal.
4. Mostrar presencia real.
5. Enviar y sincronizar propuestas.
6. Enviar votos y actualizar el estado compartido.
7. Mostrar actividad del agente.
8. Generar un puente con IA real.
9. Votar el puente.
10. Recalcular terreno común.
11. Funcionar en escritorio y móvil.
12. Superar typecheck, lint, pruebas y build.

### P1 — Mejora competitiva

1. Fuente meteorológica real.
2. Plan de acción generado y validado.
3. Modo demo reproducible.
4. Entrada tardía y recuperación completa de estado.
5. Inbox o notificación al autor.
6. Explicación visible del uso de Portal.
7. Animación clara de acercamiento entre grupos.

### P2 — Solo si P0 y P1 están terminados

1. Más misiones.
2. Internacionalización completa.
3. Clustering semántico avanzado.
4. Panel de administración.
5. Historial de misiones.
6. Integración de más fuentes públicas.

No trabajes en P2 mientras exista un fallo en P0.

## 17. Fases de ejecución para dos días

### Fase 1: inspección y plan

- Lee `AGENTS.md`, README, `package.json`, estructura y configuración.
- Identifica trabajo previo que debe conservarse.
- Revisa la documentación actual de Portal.
- Escribe un plan breve con riesgos y pruebas.
- No cambies la identidad visual existente si ya coincide con esta especificación.

### Fase 2: vertical slice

Implementa un recorrido completo, aunque sea pequeño:

```text
entrar → presencia → propuesta → voto → agente → puente → nuevo voto
```

Prueba este recorrido con dos sesiones antes de añadir otras funciones.

### Fase 3: contexto y resiliencia

- fuente de datos real;
- manejo de fallos;
- modo demo;
- recuperación para usuarios tardíos;
- responsive y accesibilidad.

### Fase 4: entrega

- build de producción;
- despliegue;
- GitHub público;
- README;
- guion de 90 segundos;
- pitch de 280 caracteres;
- explicación exacta del uso de Portal;
- verificación final desde una ventana anónima y un celular.

## 18. Pruebas obligatorias

Crea y ejecuta pruebas para demostrar:

1. Dos clientes reciben una propuesta sin recargar.
2. Un voto cambia el estado en ambos clientes.
3. Los votos duplicados del mismo evento no se cuentan dos veces.
4. Un participante tardío recupera propuestas y estado esencial.
5. El agente recibe solo propuestas válidas.
6. La salida del modelo se valida antes de publicarse.
7. Una falla del modelo no congela la sala.
8. Una falla de la fuente externa se muestra honestamente.
9. La aplicación no contiene secretos.
10. El flujo principal funciona a 375 px de ancho.
11. El flujo principal es utilizable con teclado.
12. El build de producción termina correctamente.

Ejecuta los comandos disponibles del repositorio. Si existen, incluye como mínimo:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

No declares que una prueba pasó si no la ejecutaste. Si alguna no existe, créala o explica por qué la validación equivalente es suficiente.

## 19. README y documentación

El README final debe contener:

- problema;
- solución;
- por qué la experiencia necesita tiempo real;
- arquitectura resumida;
- diagrama de flujo;
- uso exacto de Portal;
- uso exacto de IA;
- fuentes de datos;
- instalación local;
- variables de entorno;
- comandos de desarrollo y pruebas;
- decisiones de privacidad;
- limitaciones conocidas;
- enlace desplegado;
- enlace al video de demostración cuando esté disponible.

Crea también:

```text
docs/ARCHITECTURE.md
docs/PORTAL.md
docs/DEMO_SCRIPT.md
docs/JUDGE_TEST.md
```

## 20. Guion de prueba del jurado

Optimiza el producto para este recorrido:

1. El jurado abre la URL.
2. Selecciona Piura.
3. Ve a otras personas o agentes presentes.
4. Recibe una perspectiva.
5. Vota una propuesta.
6. Observa el cambio compartido.
7. Publica una frase.
8. KUSKA IA genera un puente.
9. Vota el puente.
10. Ve cómo aumenta el terreno común y aparece un plan de acción.

El recorrido debe completarse en menos de 75 segundos y no debe requerir explicación oral para saber qué hacer.

## 21. Pitch de referencia

Mantén una variante inferior a 280 caracteres:

> KUSKA convierte problemas reales en misiones vivas. Personas, datos y agentes de IA comparten perspectivas, prueban propuestas y construyen acuerdos en tiempo real. No es otro chat: es inteligencia colectiva que se puede ver y poner en acción.

Cuenta los caracteres y ajusta si fuera necesario.

## 22. Criterios de aceptación

El trabajo está terminado solamente cuando:

- existe una URL pública utilizable por el jurado;
- el repositorio GitHub es público y no contiene secretos;
- Portal sincroniza realmente dos clientes;
- la presencia muestra usuarios y agentes;
- propuestas, votos y puente aparecen en ambos clientes;
- una persona que entra tarde recupera el estado;
- la generación del puente utiliza una llamada real al modelo cuando la clave está configurada;
- la interfaz distingue IA, humanos y demo-agents;
- el terreno común se calcula de forma determinista y documentada;
- existe al menos una fuente real con atribución y hora;
- la aplicación funciona en móvil;
- las comprobaciones técnicas pasan;
- el README y los documentos de entrega están completos;
- el guion de 90 segundos puede ejecutarse sin pasos manuales frágiles;
- se ha realizado una última revisión buscando errores, regresiones, afirmaciones engañosas y uso superficial de Portal.

## 23. Reglas de trabajo para Codex

- Preserva cambios existentes del usuario.
- No uses comandos destructivos.
- Inspecciona antes de reemplazar arquitectura.
- Sigue las convenciones del repositorio.
- Implementa en incrementos verificables.
- Usa tipos estrictos y nombres claros.
- Evita archivos gigantes; separa dominio, integración y UI cuando sea necesario.
- No añadas dependencias sin justificar su utilidad.
- No inventes APIs de Portal ni capacidades de fuentes públicas.
- No conviertas la interfaz en un chatbot.
- No dediques tiempo a funciones que no aparecen en la demo.
- No te detengas después de crear componentes: ejecútalos y pruébalos.
- Revisa el diff final.
- Informa qué quedó funcionando, qué se comprobó y qué depende de una credencial externa.

Empieza ahora inspeccionando el repositorio y la documentación actual. Luego implementa el vertical slice P0 completo. Continúa hasta que los criterios de aceptación estén satisfechos o hasta encontrar un bloqueo que realmente requiera acción del usuario.
