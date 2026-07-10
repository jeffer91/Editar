<!-- =========================================================
Nombre completo: BLOQUE_1.md
Ruta o ubicación: /docs/BLOQUE_1.md

Función o funciones:
- Registrar el alcance técnico del Bloque 1.
- Documentar los archivos creados y los criterios de aprobación.
- Mantener trazabilidad para los siguientes bloques.
========================================================= -->

# Bloque 1 — Inicialización de la aplicación

## Objetivo

Construir una base ejecutable con Electron, React, TypeScript y Vite, manteniendo separados el proceso principal, el preload y la interfaz.

## Componentes incorporados

- Configuración npm y scripts multiplataforma.
- Proceso principal de Electron.
- Preload CommonJS seguro.
- Interfaz React inicial.
- Configuración TypeScript separada por entorno.
- Configuración Vite para desarrollo y producción.
- Limpieza de compilaciones anteriores.
- Exclusiones de Git.
- Verificación automática mediante GitHub Actions.

## Criterios de aprobación

- `npm install` instala las dependencias.
- `npm run typecheck` termina sin errores.
- `npm run build` genera `dist-renderer` y `dist-electron`.
- Electron carga React mediante el preload aislado.
- `nodeIntegration` permanece desactivado.
- `contextIsolation`, `sandbox` y `webSecurity` permanecen activados.
- El repositorio no contiene compilaciones ni dependencias locales.

## Archivos del bloque

1. `/package.json`
2. `/tsconfig.json`
3. `/tsconfig.renderer.json`
4. `/tsconfig.electron.json`
5. `/vite.config.ts`
6. `/apps/desktop/main/main.ts`
7. `/apps/desktop/preload/preload.cts`
8. `/apps/desktop/renderer/index.html`
9. `/apps/desktop/renderer/src/global.d.ts`
10. `/apps/desktop/renderer/src/main.tsx`
11. `/apps/desktop/renderer/src/App.tsx`
12. `/apps/desktop/renderer/src/styles.css`
13. `/scripts/clean.mjs`
14. `/.gitignore`
15. `/.github/workflows/verify.yml`
16. `/README.md`

## Próximo bloque

Bloque 2: seguridad, contratos IPC y comunicación tipada.
