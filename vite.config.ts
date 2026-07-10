/* =========================================================
Nombre completo: vite.config.ts
Ruta o ubicación: /vite.config.ts

Función o funciones:
- Configurar Vite para la interfaz React.
- Mantener una ruta de salida separada del código Electron.
- Definir alias y puerto fijo para el desarrollo local.
========================================================= */

import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/desktop/renderer",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@renderer": fileURLToPath(
        new URL("./apps/desktop/renderer", import.meta.url),
      ),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "../../../dist-renderer",
    emptyOutDir: true,
    sourcemap: true,
  },
});
