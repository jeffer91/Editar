/* =========================================================
Nombre completo: main.tsx
Ruta o ubicación: /apps/desktop/renderer/src/main.tsx

Función o funciones:
- Iniciar la aplicación React.
- Montar la interfaz dentro del elemento raíz.
- Activar comprobaciones adicionales mediante StrictMode.
========================================================= */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el elemento raíz de la aplicación.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
