# Uso de Portal

Cada caso tiene una sala aislada con el canal `kuska:mission:live:<caseId>`. La presencia publica únicamente datos de presentación (`alias`, `role`, `kind`); la identidad operativa siempre se toma de `message.sender.id`, verificado por Portal. Nunca se confía en `actor.id` o `vote.actorId` incluidos por el cliente.

Los mensajes persistentes implementados son `proposal.created`, `alternative.created`, `vote.cast`, `decision.closed` y `chat.created`. `alternative.created` comparte con toda la sala las propuestas puente y opciones promovidas desde el análisis; `decision.closed` conserva la opción confirmada después de resolver participación, empates y preocupaciones. Cada evento mantiene separada la identidad humana que lo publica de la autoría de facilitación, tiene un `eventId` para deduplicación, se valida con Zod al entrar y debe ocupar menos de 1,900 bytes para mantenerse por debajo del límite de 2 KB del SDK. El historial recupera hasta 80 eventos para quienes llegan tarde. Los mensajes propios se aplican de forma optimista y su eco se descarta por `eventId`.

El mundo 3D usa `player.moved` en un canal espacial independiente `<caseId>:world`, configurado sin recuperación de historial. Publica posición, orientación y estado de movimiento hasta cinco veces por segundo mientras el avatar camina, con un pulso de reposo cada 1.5 segundos. Portal verifica la identidad del remitente; KUSKA valida límites del terreno, interpola los avatares remotos para evitar saltos y los retira si dejan de enviar señales. La cámara sigue siendo personal: se comparte dónde está cada persona, no lo que cada una está mirando.

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

La prueba consulta `/api/cases`, toma hasta tres problemas activos o recientes con fenómenos diferentes y abre cuatro clientes Portal por caso. Usa canales únicos `kuska:test:<caseId>:<runId>`, verifica presencia, entrega de propuesta, cuatro votos, convergencia y movimiento en un canal espacial sin historial. No utiliza las salas de producción.

Variables opcionales:

```env
KUSKA_BASE_URL=http://localhost:3000
PORTAL_TEST_TIMEOUT_MS=30000
```
