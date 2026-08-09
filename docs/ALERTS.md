# Alertas y señales

## Fuentes

- **Open-Meteo:** precipitación diaria, probabilidad máxima, pico horario, código meteorológico y ráfagas para las coordenadas de Piura. Actualización cada 15 minutos.
- **GDACS:** feed GeoJSON de eventos de inundación del Global Disaster Awareness and Coordination System. Actualización cada 30 minutos y filtro nacional para Perú.

## Clasificación de KUSKA

Las señales de pronóstico no son alertas oficiales. KUSKA clasifica cada día de manera reproducible:

- `danger`: precipitación diaria ≥ 50 mm, pico horario ≥ 15 mm o código WMO de tormenta fuerte;
- `warning`: precipitación diaria ≥ 20 mm, pico horario ≥ 7.5 mm o probabilidad ≥ 80%;
- `watch`: precipitación diaria ≥ 8 mm, pico horario ≥ 3 mm o probabilidad ≥ 60%;
- `info`: ningún umbral anterior.

Los eventos GDACS conservan su nivel verde, naranja o rojo, traducido visualmente a vigilancia, advertencia o peligro. El alcance se muestra como Perú salvo que la fuente entregue una localización más precisa. Si una fuente falla, la otra continúa y `unavailableSources` identifica la indisponibilidad; no se sustituyen datos reales por valores ficticios.

## Casos internacionales

El endpoint `/api/cases` toma únicamente geometrías puntuales del feed de inundaciones, conserva un caso reciente por país y utiliza sus coordenadas publicadas. Open-Meteo se consulta en lote para esas ubicaciones. La severidad visual es la mayor entre el nivel GDACS y la clasificación meteorológica de KUSKA. Los casos finalizados se muestran como `recent`; nunca como eventos activos.
