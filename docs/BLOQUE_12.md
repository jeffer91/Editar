<!-- =========================================================
Nombre completo: BLOQUE_12.md
Ruta o ubicación: /docs/BLOQUE_12.md

Función o funciones:
- Registrar el alcance técnico del Bloque 12.
- Documentar planes de corte, render y caché segura.
- Mantener trazabilidad para la línea de tiempo funcional.
========================================================= -->

# Bloque 12 — Corte y reducción automática de silencios

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Transformar el análisis acústico en un plan de edición seguro y producir una nueva versión del video o audio con las pausas acortadas o eliminadas, sin reemplazar el original.

## Modos

### `shorten`

Conserva una duración objetivo de cada pausa.

Valor predeterminado:

```text
targetSilenceUs: 300000 µs
edgePaddingUs: 80000 µs
```

### `remove`

Retira la mayor parte de la pausa y conserva únicamente los márgenes de seguridad de cada borde.

El margen predeterminado es 80 ms por lado.

## Plan de reducción

`createSilenceReductionPlan` recibe:

- análisis acústico validado;
- modo;
- silencio objetivo;
- margen de borde.

Produce:

```text
createdAt
analysisSourceKey
mode
originalDurationUs
outputDurationUs
removedDurationUs
retainedSilenceUs
settings
keepRanges[]
```

Cada rango conservado contiene:

```text
sourceStartUs
sourceEndUs
durationUs
```

## Reglas del plan

- tiempos en microsegundos enteros;
- rangos ordenados y dentro de la duración;
- no puede eliminarse todo el contenido;
- los márgenes se conservan alrededor de cada pausa;
- silencios más cortos que el objetivo no se modifican;
- máximo de 500 rangos conservados;
- la suma de rangos debe coincidir con la duración de salida.

## Solicitud segura

El renderer solo envía:

```text
projectId
mediaId
mode
targetSilenceMs
edgePaddingMs
```

Rangos aceptados:

- objetivo: 10 a 10000 ms en modo `shorten`;
- objetivo: 0 a 10000 ms en modo `remove`;
- margen: 0 a 2000 ms.

El proceso principal recupera el original, análisis, rutas y FFmpeg.

## Reutilización

La clave SHA-256 depende de:

- versión del algoritmo;
- hash o ruta del original;
- clave del análisis acústico;
- modo;
- duración objetivo;
- margen;
- versión de FFmpeg.

Si existe un derivado `silence-reduced` con la misma clave y archivo válido, no se crea un trabajo nuevo.

## Trabajo persistente

Tipo:

```text
reduce-silence
```

Prioridad:

```text
58
```

Intentos máximos:

```text
2
```

El payload interno incluye:

- identificadores;
- ruta del original;
- ruta final;
- ruta parcial;
- ruta del filtro auxiliar;
- clave de caché;
- plan serializado;
- comando y versión de FFmpeg.

## Worker dedicado

`WorkerThreadJobExecutor` dirige `reduce-silence` hacia:

```text
audio-background-worker.ts
```

El proceso de audio puede cancelarse sin afectar el Worker general de miniaturas, proxies o FFprobe.

## Filtros

### Video

Por cada rango:

```text
trim
setpts
atrim
asetpts
```

Después:

```text
concat=v=1:a=1
```

### Audio

Por cada rango:

```text
atrim
asetpts
```

Después:

```text
concat=v=0:a=1
```

Los filtros se escriben en un archivo auxiliar administrado para evitar líneas de comando excesivas.

## Salidas

### Video

```text
MP4
libx264
CRF 22
preset veryfast
yuv420p
AAC 160 kbps
faststart
```

### Audio

```text
M4A
AAC 192 kbps
```

## Escritura atómica

Archivos utilizados:

```text
silence-reduced-<cacheKey>.mp4
silence-reduced-<cacheKey>.partial-<jobHash>.mp4
silence-reduced-<cacheKey>.mp4.aux-<jobHash>.txt
```

Flujo:

1. crear carpeta segura;
2. eliminar temporal anterior;
3. escribir filter script;
4. ejecutar FFmpeg;
5. validar salida no vacía;
6. reemplazar mediante `rename`;
7. calcular SHA-256;
8. persistir derivado y plan;
9. eliminar script auxiliar.

Ante fallo o cancelación se eliminan temporal y script. La versión anterior continúa disponible.

## Persistencia

El resultado actualiza únicamente la fila del medio.

Se guardan:

- derivado `silence-reduced`;
- ruta administrada;
- clave de caché;
- fecha;
- plan de reducción aplicado.

No se modifica:

- original;
- metadatos FFprobe;
- análisis acústico;
- pistas;
- clips;
- secuencias;
- snapshots.

## Caché

La salida permanece en:

```text
<userData>/cache/media
```

La limpieza se bloquea mientras existan trabajos `reduce-silence` pendientes, activos o pausados.

La reconciliación elimina scripts `.aux-*` y salidas `.partial-*` después de cierres inesperados.

## Protocolo interno

La versión puede servirse mediante:

```text
editar-cache://derivative/<derivativeId>
```

El renderer no conoce la ruta física.

## Interfaz

El Editor ofrece:

- `Acortar`;
- `Eliminar`;
- duración de silencio detectada;
- duración reducida;
- indicador `Sin silencios ✓`;
- mensajes de cola y errores.

El Centro de trabajos muestra `Reducir silencios` con progreso, pausa, cancelación y reintento.

## Límites actuales

- la versión reducida es un derivado completo, no clips editables todavía;
- video con audio requiere ambos streams;
- no existe fundido automático entre segmentos;
- máximo de 500 rangos;
- codificación por CPU con `libx264`;
- todavía no se inserta automáticamente el resultado en la línea de tiempo.

La conversión del plan en clips editables pertenece al Bloque 13.

## Errores controlados

```text
FFMPEG_UNAVAILABLE
FFMPEG_START_ERROR
SILENCE_REDUCTION_TIMEOUT
FFMPEG_EMPTY_OUTPUT
FFMPEG_ENCODER_UNAVAILABLE
AUDIO_STREAM_UNAVAILABLE
SOURCE_FILE_UNAVAILABLE
AUDIO_PROCESSING_ERROR
JOB_RESULT_APPLY_ERROR
```

## Pruebas

- modo acortar;
- modo eliminar;
- márgenes de seguridad;
- archivo completamente silencioso;
- configuración inválida;
- cálculo de duración de salida;
- generación del filter script;
- Worker Thread dedicado;
- FFmpeg simulado;
- salida física no vacía;
- ausencia de `.partial-*`;
- persistencia del plan;
- persistencia del derivado;
- reutilización por clave;
- ausencia de snapshots.

## Archivos principales

1. `/apps/desktop/main/media/silence-reduction-service.ts`
2. `/apps/desktop/main/jobs/audio-worker-tasks.ts`
3. `/apps/desktop/main/jobs/audio-background-worker.ts`
4. `/apps/desktop/main/jobs/media-derivative-job-handler.ts`
5. `/apps/desktop/shared/domain/audio-analysis.ts`
6. `/apps/desktop/shared/domain/media.ts`
7. `/apps/desktop/shared/audio-processing-contracts.ts`
8. `/apps/desktop/renderer/src/app/use-audio-processing.ts`
9. `/apps/desktop/renderer/src/components/media/ProjectMediaPanel.tsx`
10. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
11. `/tests/audio-processing.test.mjs`
12. `/docs/BLOQUE_12.md`

## Próximo bloque

Bloque 13: línea de tiempo y edición funcional de clips.
