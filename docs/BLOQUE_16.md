<!-- =========================================================
Nombre completo: BLOQUE_16.md
Ruta o ubicación: /docs/BLOQUE_16.md

Función o funciones:
- Registrar el alcance técnico del Bloque 16.
- Documentar transformaciones, presets y animaciones visuales.
- Mantener trazabilidad para composición y exportación futuras.
========================================================= -->

# Bloque 16 — Efectos y animaciones de video

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Permitir editar propiedades visuales de un clip, aplicar presets de imagen y registrar animaciones temporales sin modificar el recurso original.

## Transformaciones disponibles

- posición X;
- posición Y;
- escala X;
- escala Y;
- rotación;
- opacidad;
- anclaje X;
- anclaje Y.

Las transformaciones se guardan directamente en `Clip.transform` y se validan mediante el núcleo del dominio.

## Presets visuales

```text
none
cinematic
monochrome
warm
cool
vivid
soft-blur
sharpen
vignette
```

Cada preset guarda:

```text
presetId
intensity
```

La intensidad se limita entre 0 y 1.

El preset `none` elimina el efecto visual del documento, pero conserva las transformaciones del clip.

## Animaciones disponibles

```text
none
fade-in
fade-out
zoom-in
zoom-out
pan-left
pan-right
```

Cada animación guarda:

```text
presetId
durationUs
easing
```

Curvas permitidas:

```text
linear
ease-in
ease-out
ease-in-out
```

## Duración

Cuando existe una animación:

- debe durar al menos 10 ms;
- no puede superar la duración total del clip;
- se guarda como microsegundos enteros;
- la interfaz la presenta en segundos.

## Compatibilidad visual

Los controles están disponibles para:

- videos;
- imágenes;
- textos;
- generadores;
- clips de ajuste.

Un recurso exclusivamente de audio no admite transformaciones ni efectos visuales.

## Modelo de efectos

Los estilos y animaciones se guardan como efectos separados:

```text
video-style
video-animation
```

Esto permite que el futuro compilador de render procese cada categoría de forma independiente y mantenga un orden estable dentro de `effectIds`.

## Orden

- mezcla de audio: orden 10;
- estilo visual: orden 20;
- animación visual: orden 30.

El orden evita depender de la posición accidental de los elementos dentro del arreglo global de efectos.

## Interfaz

El inspector incluye:

- campos numéricos para posición, escala, rotación y anclaje;
- control de opacidad;
- selector de preset visual;
- deslizador de intensidad;
- selector de animación;
- duración;
- curva de interpolación.

## Previsualización

El monitor aplica una aproximación interactiva mediante CSS:

- transformación;
- opacidad;
- filtros de color;
- desenfoque;
- viñeta;
- animaciones de aparición, zoom y desplazamiento.

Esta previsualización sirve para interacción inmediata. No representa todavía el resultado exacto fotograma por fotograma del render final.

## Restablecimiento

Seleccionar:

```text
stylePresetId = none
animationPresetId = none
```

elimina ambos efectos y sus referencias desde `clip.effectIds`.

Las transformaciones permanecen porque forman parte del clip y pueden utilizarse sin un preset.

## Persistencia

Cada guardado crea un snapshot con la razón:

```text
efectos visuales actualizados
```

Al reabrir el proyecto se recuperan:

- transformaciones;
- preset visual;
- intensidad;
- animación;
- duración;
- easing.

## IPC

Canal incorporado:

```text
timeline:update-clip-visual
```

El proceso principal valida:

- identificadores;
- transformación completa;
- intensidad;
- nombre del preset;
- nombre de la animación;
- duración;
- easing;
- compatibilidad visual;
- estado del proyecto;
- bloqueo de la pista.

## Seguridad

- los presets pertenecen a listas cerradas;
- no se aceptan filtros ni comandos arbitrarios;
- no se reciben fragmentos de shaders o scripts;
- los valores numéricos están limitados;
- el renderer no escribe en SQLite;
- los originales no se modifican.

## Pruebas

- transformación de posición, escala, rotación y opacidad;
- creación de `video-style`;
- creación de `video-animation`;
- persistencia de intensidad y easing;
- relación de efectos con el clip;
- eliminación de presets;
- conservación de transformaciones al restablecer;
- persistencia SQLite;
- reapertura del proyecto;
- creación de snapshots;
- rechazo de proyectos archivados.

## Archivos principales

1. `/apps/desktop/shared/domain/effect-operations.ts`
2. `/apps/desktop/shared/domain/video-effects.ts`
3. `/apps/desktop/shared/timeline-editing-contracts.ts`
4. `/apps/desktop/main/timeline/clip-properties-request-validation.ts`
5. `/apps/desktop/main/timeline/timeline-editing-service.ts`
6. `/apps/desktop/main/ipc/register-timeline-ipc.ts`
7. `/apps/desktop/renderer/src/components/timeline/VideoEffectsInspector.tsx`
8. `/apps/desktop/renderer/src/components/timeline/ClipInspector.tsx`
9. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
10. `/apps/desktop/renderer/src/clip-effects.css`
11. `/tests/clip-effects-domain.test.mjs`
12. `/tests/clip-properties.test.mjs`
13. `/docs/BLOQUE_16.md`

## Límites actuales

- no existe reproducción real de la composición;
- los filtros se previsualizan mediante CSS;
- no hay fotogramas clave personalizados;
- no existe una curva gráfica de animación;
- el resultado final todavía no se compila a filtros FFmpeg o compositor;
- no hay aceleración GPU específica para estos efectos.

## Próximo bloque

Bloque 17: transiciones y efectos de sonido.
