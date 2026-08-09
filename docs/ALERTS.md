# Alertas, emergencias y evidencia

KUSKA no está limitado a Piura ni a inundaciones. El planeta se alimenta de un catálogo global de eventos activos o recientes y conserva un caso preventivo local únicamente como contingencia.

## Catálogo principal de casos

`/api/cases` consulta y normaliza dos fuentes públicas:

- **GDACS:** inundaciones, sismos, ciclones tropicales, erupciones volcánicas, incendios forestales y sequías. Se aceptan eventos puntuales con actividad reciente: hasta 7 días, o 14 días para sequías.
- **IFRC GO:** tsunamis, marejadas ciclónicas, deslizamientos, olas de calor y frío, emergencias químicas, radiológicas, biológicas y accidentes o emergencias de transporte. Se aceptan eventos actualizados durante los últimos 21 días.

Cada caso conserva fuente, enlace oficial, fecha, país, coordenadas, origen natural/humano/no determinado y estado `live`, `recent` o `preventive`. Los eventos finalizados no se presentan como activos.

## Severidad e indicadores

Los niveles de las fuentes se traducen a `info`, `watch`, `warning` y `danger` para un lenguaje visual común, sin alterar el valor original mostrado al usuario.

- **Sismos:** magnitud y alerta GDACS.
- **Ciclones:** viento máximo y alerta GDACS.
- **Incendios:** área detectada y alerta GDACS.
- **Sequías:** población expuesta y alerta GDACS.
- **Otros eventos GDACS:** puntaje y nivel de alerta.
- **IFRC GO:** personas afectadas, cuando se publican, y nivel humanitario reportado.

El tipo, la severidad y las métricas alimentan parámetros visuales como agua, lluvia, viento, fuego, humo, vibración, sequedad o contaminación. Estos parámetros sirven para comunicar el fenómeno; **no constituyen una predicción física ni confirman el impacto local**.

## Registro de evidencia complementaria

La evidencia amplía el contexto pero no sustituye la señal principal:

- **USGS:** eventos sísmicos cercanos.
- **NASA EONET:** fenómenos naturales publicados cerca del caso.
- **NASA FIRMS:** detecciones térmicas para incendios cuando existe `NASA_FIRMS_MAP_KEY`.
- **ReliefWeb:** informes humanitarios cuando existe un `RELIEFWEB_APPNAME` aprobado.
- **GDELT:** cobertura periodística relacionada, mostrada separadamente de las fuentes oficiales.
- **Open-Meteo:** contexto meteorológico para las coordenadas consultadas y señal preventiva de respaldo para Piura.

Cada elemento registra fuente, fecha, enlace, ubicación y confianza. Las fuentes ausentes se muestran como vacíos pendientes y se incluyen en `unavailableSources`; KUSKA no las reemplaza con valores ficticios.

## Actualización y contingencia

Las respuestas de casos usan caché de cinco minutos para equilibrar actualidad y disponibilidad. Si GDACS o IFRC GO fallan, la otra fuente continúa. Si ambas están temporalmente indisponibles o no entregan casos recientes, KUSKA muestra el caso preventivo de Piura claramente etiquetado, en lugar de simular que existe una alerta global activa.
