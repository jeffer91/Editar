<!-- =========================================================
Nombre completo: BLOQUE_15.md
Ruta o ubicación: /docs/BLOQUE_15.md

Función o funciones:
- Registrar el alcance técnico del Bloque 15.
- Documentar mezcla, fundidos y normalización por clip.
- Mantener trazabilidad para el render de audio posterior.
========================================================= -->

# Bloque 15 — Edición y mezcla de audio

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Permitir que cada clip con audio conserve una configuración de mezcla independiente, editable y no destructiva, lista para ser interpretada por el renderizador final.

## Controles disponibles

- ganancia entre -60 dB y +12 dB;
- paneo estéreo entre -1 y 1;
- silencio individual por clip;
- fundido de entrada;
- fundido de salida;
- normalización opcional;
- pico objetivo de normalización entre -24 dB y 0 dB.

## Compatibilidad

La mezcla solo está disponible cuando el clip referencia:

- un recurso de audio; o
- un video cuyo análisis técnico detectó una pista de audio.

Las imágenes, textos y generadores sin audio no muestran estos controles.

## Modelo no destructivo

La mezcla se registra como un efecto de tipo:

```text
audio-mix
```

Parámetros:

```text
gainDb
pan
muted
fadeInUs
fadeOutUs
normalize
normalizationTargetDb
```

El archivo original nunca se modifica. Los valores describen cómo deberá procesarse el audio durante la composición y exportación.

## Fundidos

Reglas:

- cada fundido debe ser menor o igual que la duración del clip;
- la suma de entrada y salida no puede superar la duración total;
- los tiempos se guardan como microsegundos enteros;
- el renderer utiliza segundos para facilitar la edición del usuario.

## Normalización

Activar la normalización guarda la intención y el pico objetivo. En este bloque no se genera una nueva versión multimedia ni se ejecuta todavía el filtro final de normalización.

La aplicación de estos parámetros se realizará durante el render de audio y video.

## Restablecimiento

Cuando todos los valores regresan a sus valores predeterminados:

```text
gainDb = 0
pan = 0
muted = false
fadeInUs = 0
fadeOutUs = 0
normalize = false
normalizationTargetDb = -1
```

el efecto `audio-mix` se elimina del documento. Esto evita almacenar efectos que no cambian el resultado.

## Relación con las pistas

El control `M` de una pista sigue silenciando la pista completa.

El nuevo ajuste `muted` de `audio-mix` silencia únicamente el clip seleccionado. Ambos niveles son independientes.

## Interfaz

El inspector muestra:

- deslizador de ganancia;
- deslizador de paneo;
- campos de fundido de entrada y salida;
- casilla para silenciar el clip;
- casilla para normalizar;
- objetivo de normalización cuando está activo.

Los valores se cargan desde el documento persistido cada vez que cambia la selección.

## Persistencia

Cada guardado crea un snapshot con la razón:

```text
mezcla de audio actualizada
```

Al cerrar y reabrir el proyecto se recuperan todos los valores.

## IPC

Canal incorporado:

```text
timeline:update-clip-audio-mix
```

El proceso principal valida:

- identificadores;
- ganancia;
- paneo;
- booleanos;
- duración de fundidos;
- objetivo de normalización;
- compatibilidad del clip;
- estado archivado;
- bloqueo de la pista.

## Seguridad

- no se aceptan comandos FFmpeg desde el renderer;
- no se reciben rutas de archivos;
- los parámetros tienen límites estrictos;
- el renderer no accede a SQLite;
- la operación usa un canal IPC declarado;
- el remitente se valida antes de guardar.

## Pruebas

- creación del efecto de mezcla;
- lectura de valores persistidos;
- relación entre `effectIds` y `effects`;
- restablecimiento y eliminación del efecto;
- rechazo de fundidos demasiado largos;
- persistencia SQLite;
- reapertura del proyecto;
- creación de snapshots;
- rechazo de proyectos archivados.

## Archivos principales

1. `/apps/desktop/shared/domain/effect-operations.ts`
2. `/apps/desktop/shared/domain/audio-mixing.ts`
3. `/apps/desktop/shared/timeline-editing-contracts.ts`
4. `/apps/desktop/main/timeline/clip-properties-request-validation.ts`
5. `/apps/desktop/main/timeline/timeline-editing-service.ts`
6. `/apps/desktop/main/ipc/register-timeline-ipc.ts`
7. `/apps/desktop/renderer/src/components/timeline/AudioMixInspector.tsx`
8. `/apps/desktop/renderer/src/components/timeline/ClipInspector.tsx`
9. `/tests/clip-effects-domain.test.mjs`
10. `/tests/clip-properties.test.mjs`
11. `/docs/BLOQUE_15.md`

## Límite actual

La mezcla ya se edita y persiste, pero todavía no se escucha mediante una reproducción de composición en tiempo real ni se aplica a un archivo exportado. Esa ejecución pertenece al compilador de render y exportación.

## Próximo bloque

Bloque 16: efectos y animaciones de video.
