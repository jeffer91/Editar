/* =========================================================
Nombre completo: main.tsx
Ruta o ubicación: /apps/desktop/renderer/src/main.tsx

Función o funciones:
- Iniciar la aplicación React.
- Montar la interfaz dentro del elemento raíz.
- Cargar estilos globales, audio, medios, caché y trabajos.
========================================================= */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./app-layout.css";
import "./screens.css";
import "./database-status.css";
import "./project-management.css";
import "./media-import.css";
import "./media-engine.css";
import "./media-cache.css";
import "./audio-processing.css";
import "./job-queue.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el elemento raíz de la aplicación.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
