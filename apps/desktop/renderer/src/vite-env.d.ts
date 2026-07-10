/* =========================================================
Nombre completo: vite-env.d.ts
Ruta o ubicación: /apps/desktop/renderer/src/vite-env.d.ts

Función o funciones:
- Cargar los tipos de cliente proporcionados por Vite.
- Reconocer importaciones de CSS y otros recursos estáticos.
- Mantener compatibilidad con las validaciones de TypeScript 7.
========================================================= */

/// <reference types="vite/client" />

declare module "*.css";
