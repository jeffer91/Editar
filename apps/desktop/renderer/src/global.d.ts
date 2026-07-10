/* =========================================================
Nombre completo: global.d.ts
Ruta o ubicación: /apps/desktop/renderer/src/global.d.ts

Función o funciones:
- Aplicar el contrato compartido a window.editar.
- Proporcionar autocompletado para la API segura del preload.
- Impedir el uso de canales o funciones no declarados.
========================================================= */

import type { EditarBridge } from "../../shared/ipc-contracts";

export {};

declare global {
  interface Window {
    editar: EditarBridge;
  }
}
