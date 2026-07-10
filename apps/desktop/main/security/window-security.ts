/* =========================================================
Nombre completo: window-security.ts
Ruta o ubicación: /apps/desktop/main/security/window-security.ts

Función o funciones:
- Impedir que la aplicación abra ventanas externas sin autorización.
- Bloquear navegaciones y redirecciones hacia orígenes no confiables.
- Centralizar las reglas de seguridad aplicadas a BrowserWindow.
========================================================= */

import type { BrowserWindow } from "electron";
import { isTrustedRendererUrl } from "./trusted-sources.js";

function applyWindowSecurity(
  window: BrowserWindow,
  developmentUrl?: string,
): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    console.warn("Ventana externa bloqueada:", url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url, developmentUrl)) {
      event.preventDefault();
      console.warn("Navegación bloqueada:", url);
    }
  });

  window.webContents.on("will-redirect", (event, url) => {
    if (!isTrustedRendererUrl(url, developmentUrl)) {
      event.preventDefault();
      console.warn("Redirección bloqueada:", url);
    }
  });
}

export { applyWindowSecurity };
