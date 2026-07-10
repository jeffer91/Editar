/* =========================================================
Nombre completo: preload.cts
Ruta o ubicación: /apps/desktop/preload/preload.cts

Función o funciones:
- Crear un puente seguro entre Electron y la interfaz.
- Exponer únicamente información básica y de solo lectura.
- Evitar que el renderer tenga acceso directo a Node.js.
========================================================= */

const { contextBridge } = require("electron") as typeof import("electron");

const runtimeInfo = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }),
});

contextBridge.exposeInMainWorld(
  "editar",
  Object.freeze({
    runtime: runtimeInfo,
  }),
);
