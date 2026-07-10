<!-- =========================================================
Nombre completo: BLOQUE_2.md
Ruta o ubicación: /docs/BLOQUE_2.md

Función o funciones:
- Registrar el alcance técnico del Bloque 2.
- Documentar seguridad, contratos y comunicación IPC.
- Mantener trazabilidad para los siguientes bloques.
========================================================= -->

# Bloque 2 — Seguridad, contratos IPC y comunicación tipada

## Estado

**EN VERIFICACIÓN**

## Objetivo

Establecer una comunicación segura entre React, preload y Electron mediante canales permitidos, contratos compartidos y validación de cada solicitud.

## Componentes incorporados

- Contratos IPC compartidos.
- Respuestas uniformes de éxito y error.
- Identificador y fecha para cada solicitud.
- Validación de estructura y antigüedad.
- Validación del origen del remitente.
- Bloqueo de ventanas externas, navegación y redirecciones.
- Política de seguridad de contenido.
- Prueba visual de conectividad y latencia.
- Pruebas automáticas de validación IPC.

## Criterios de aprobación

- Renderer y Electron compilan sin errores.
- El preload solo expone `window.editar.system`.
- No se expone `ipcRenderer`, `require`, `fs` ni `child_process`.
- Las solicitudes inválidas son rechazadas.
- Las solicitudes expiradas son rechazadas.
- Los remitentes no confiables son bloqueados.
- La aplicación impide ventanas y navegaciones externas.
- GitHub Actions ejecuta las pruebas IPC correctamente.

## Archivos creados

1. `/apps/desktop/shared/ipc-contracts.ts`
2. `/apps/desktop/main/ipc/ipc-validation.ts`
3. `/apps/desktop/main/ipc/register-system-ipc.ts`
4. `/apps/desktop/main/security/trusted-sources.ts`
5. `/apps/desktop/main/security/window-security.ts`
6. `/apps/desktop/renderer/src/ipc-status.css`
7. `/tests/ipc-validation.test.mjs`
8. `/docs/BLOQUE_2.md`

## Archivos actualizados

1. `/apps/desktop/main/main.ts`
2. `/apps/desktop/preload/preload.cts`
3. `/apps/desktop/renderer/index.html`
4. `/apps/desktop/renderer/src/global.d.ts`
5. `/apps/desktop/renderer/src/main.tsx`
6. `/apps/desktop/renderer/src/App.tsx`
7. `/tsconfig.renderer.json`
8. `/tsconfig.electron.json`
9. `/package.json`
10. `/.github/workflows/verify.yml`
11. `/README.md`

## Próximo bloque

Bloque 3: diseño visual base, navegación y estructura de pantallas.
