/* =========================================================
Nombre completo: index.ts
Ruta o ubicación: /apps/desktop/shared/domain/index.ts

Función o funciones:
- Publicar la API estable del núcleo de dominio.
- Evitar importaciones directas desde archivos internos.
- Facilitar el crecimiento y futura extracción del módulo.
========================================================= */

export * from "./audio-analysis.js";
export * from "./audio-mixing.js";
export * from "./domain-error.js";
export * from "./effect-operations.js";
export * from "./effects.js";
export * from "./jobs.js";
export * from "./media-audio-operations.js";
export * from "./media-derivative-operations.js";
export * from "./media.js";
export * from "./primitives.js";
export * from "./project-document.js";
export * from "./project-media-operations.js";
export * from "./project-operations.js";
export * from "./project.js";
export * from "./text-operations.js";
export * from "./text.js";
export * from "./timeline-operations.js";
export * from "./timeline.js";
export * from "./video-effects.js";
