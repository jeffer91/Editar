/* =========================================================
Nombre completo: global.d.ts
Ruta o ubicación: /apps/desktop/renderer/src/global.d.ts

Función o funciones:
- Definir el contrato inicial del puente seguro de Electron.
- Proporcionar tipado estricto para window.editar.
- Evitar el uso de valores globales sin declarar.
========================================================= */

export {};

declare global {
  interface Window {
    editar: {
      runtime: {
        platform: NodeJS.Platform;
        versions: {
          electron: string;
          chrome: string;
          node: string;
        };
      };
    };
  }
}
