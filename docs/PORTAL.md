# Uso de Portal

Cada caso tiene una sala aislada con el canal `kuska:mission:live:<caseId>`. La presencia publica únicamente datos de presentación (`alias`, `role`, `kind`); la identidad operativa siempre se toma de `message.sender.id`, verificado por Portal. Nunca se confía en `actor.id` o `vote.actorId` incluidos por el cliente.

Los mensajes persistentes implementados son `proposal.created`, `vote.cast` y `chat.created`. Cada evento tiene un `eventId` para deduplicación, se valida con Zod al entrar y debe ocupar menos de 1,900 bytes para mantenerse por debajo del límite de 2 KB del SDK. El historial recupera hasta 80 eventos para quienes llegan tarde. Los mensajes propios se aplican de forma optimista y su eco se descarta por `eventId`.

La presencia detallada alimenta la lista real de personas en la sala. Los perfiles de agentes demo permanecen separados, no se publican en Portal y no cuentan como votos humanos.

La clave publicable va únicamente en `NEXT_PUBLIC_PORTAL_API_KEY`. Sin esa variable la UI muestra modo local claramente rotulado; no afirma sincronización real.

## Pruebas

Prueba determinista, sin red:

```bash
npm run test:collaboration
```

Simula cuatro usuarios y comprueba identidad, deduplicación, reemplazo de votos y convergencia en escenarios de sismo, incendio e inundación.

Prueba contra Portal real:

```bash
npm run dev
npm run test:portal
```

La prueba consulta `/api/cases`, toma hasta tres problemas activos o recientes con fenómenos diferentes y abre cuatro clientes Portal por caso. Usa canales únicos `kuska:test:<caseId>:<runId>`, verifica presencia, entrega de propuesta, cuatro votos y convergencia en todos los clientes. No utiliza las salas de producción.

Variables opcionales:

```env
KUSKA_BASE_URL=http://localhost:3000
PORTAL_TEST_TIMEOUT_MS=30000
```
