<!-- =========================================================
Nombre completo: BLOQUE_11.md
Ruta o ubicación: /docs/BLOQUE_11.md

Función o funciones:
- Registrar el alcance técnico del Bloque 11.
- Documentar análisis acústico, parser y persistencia.
- Mantener trazabilidad para la reducción de silencios.
========================================================= -->

# Bloque 11 — Análisis de audio y detección de silencios

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Detectar pausas silenciosas en videos y audios mediante FFmpeg, convertir sus eventos en un modelo validado y guardar métricas acústicas sin modificar el archivo original.

## Flujo

```text
MediaAsset con audio
└── AudioAnalysisService
    └── trabajo detect-silence
        └── audio-background-worker
            └── FFmpeg silencedetect
                └── stderr controlado
                    └── silence-detect-parser
                        └── AudioAnalysis
                            └── AudioAnalysisJobHandler
                                └── media_assets.data_json
```

## Configuración predeterminada

```text
thresholdDb: -35 dB
minSilenceUs: 500000 µs
```

El renderer puede modificar estos valores únicamente dentro de rangos controlados:

- umbral: -96 a -1 dB;
- duración mínima: 10 a 30000 ms.

## Requisitos del recurso

- proyecto existente y no archivado;
- medio perteneciente al proyecto;
- original disponible;
- análisis FFprobe en estado `ready`;
- video con stream de audio o archivo de audio;
- FFmpeg disponible.

Las imágenes y videos sin audio se rechazan de forma controlada.

## Clave del análisis

Cada análisis usa SHA-256 sobre:

- versión del algoritmo;
- hash o huella del original;
- duración del medio;
- umbral;
- duración mínima;
- versión de FFmpeg.

Si la clave coincide con el análisis persistido, el resultado se reutiliza. Si existe un trabajo activo equivalente, no se inserta otro.

## Ejecución de FFmpeg

Argumentos principales:

```text
-nostdin
-hide_banner
-progress pipe:1
-nostats
-i <original>
-vn
-af silencedetect=noise=<threshold>dB:d=<seconds>
-f null -
```

Controles:

- `shell: false`;
- salida limitada;
- tiempo máximo;
- progreso desde `out_time_us`;
- cancelación cooperativa;
- terminación del proceso hijo.

## Parser

`silence-detect-parser.ts` interpreta:

```text
silence_start: <seconds>
silence_end: <seconds>
```

También:

- cierra un silencio sin inicio desde cero;
- cierra un silencio abierto hasta la duración final;
- limita eventos fuera de la duración;
- ignora líneas malformadas;
- convierte segundos a microsegundos enteros.

## Modelo `AudioAnalysis`

Campos:

```text
analyzedAt
sourceKey
durationUs
thresholdDb
minSilenceUs
silenceDurationUs
audibleDurationUs
silenceRatio
segments[]
```

Cada segmento contiene:

```text
startUs
endUs
durationUs
```

## Normalización

El dominio:

- ordena segmentos;
- fusiona segmentos superpuestos;
- valida límites;
- calcula duración silenciosa;
- calcula duración audible;
- calcula proporción de silencio;
- limita el análisis a 5000 segmentos.

No se inventan silencios cuando FFmpeg no reporta eventos.

## Persistencia

`AudioAnalysisJobHandler` solo reemplaza el análisis anterior después de validar completamente el nuevo resultado.

Un fallo o reintento:

- no borra el análisis anterior;
- no modifica el original;
- no crea snapshots;
- conserva derivados existentes.

Cuando cambia el análisis técnico de FFprobe, se descarta el análisis acústico obsoleto y cualquier versión reducida relacionada.

## Automatización

Después de un `probe-media` exitoso, el sistema intenta crear automáticamente `detect-silence` para medios con audio.

El trabajo declara como dependencia el análisis FFprobe. Por tanto, la cola no lo ejecuta antes de que los metadatos técnicos estén persistidos.

La falta de FFmpeg no invalida FFprobe ni la importación.

## Interfaz

El Editor muestra:

- cantidad de silencios;
- duración silenciosa;
- porcentaje del audio;
- botón `Analizar audio`;
- botón `Reanalizar audio`.

El Centro de trabajos muestra `Detectar silencios` con progreso, pausa, cancelación y reintento.

## Errores controlados

```text
FFMPEG_UNAVAILABLE
FFMPEG_START_ERROR
SILENCE_ANALYSIS_TIMEOUT
SOURCE_FILE_UNAVAILABLE
AUDIO_STREAM_UNAVAILABLE
AUDIO_PROCESSING_ERROR
JOB_RESULT_APPLY_ERROR
```

## Pruebas

- eventos normales;
- silencio desde el inicio;
- silencio hasta el final;
- líneas malformadas;
- duración inválida;
- segmentos superpuestos;
- métricas y porcentaje;
- prevención de trabajos duplicados;
- reutilización por clave;
- Worker Thread real;
- FFmpeg simulado;
- persistencia SQLite;
- ausencia de snapshots.

## Archivos creados

1. `/apps/desktop/shared/domain/audio-analysis.ts`
2. `/apps/desktop/shared/domain/media-audio-operations.ts`
3. `/apps/desktop/shared/audio-processing-contracts.ts`
4. `/apps/desktop/main/media/silence-detect-parser.ts`
5. `/apps/desktop/main/media/audio-analysis-service.ts`
6. `/apps/desktop/main/jobs/audio-analysis-job-handler.ts`
7. `/apps/desktop/main/jobs/audio-worker-tasks.ts`
8. `/apps/desktop/main/jobs/audio-background-worker.ts`
9. `/apps/desktop/renderer/src/app/use-audio-processing.ts`
10. `/apps/desktop/renderer/src/audio-processing.css`
11. `/tests/audio-analysis-domain.test.mjs`
12. `/tests/silence-detect-parser.test.mjs`
13. `/tests/audio-processing.test.mjs`
14. `/docs/BLOQUE_11.md`

## Próximo bloque

Bloque 12: corte y reducción automática de silencios.
