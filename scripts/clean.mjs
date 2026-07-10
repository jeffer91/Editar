/* =========================================================
Nombre completo: clean.mjs
Ruta o ubicación: /scripts/clean.mjs

Función o funciones:
- Eliminar compilaciones anteriores de forma controlada.
- Evitar archivos obsoletos antes de cada build.
- Funcionar en Windows, Linux y macOS sin comandos externos.
========================================================= */

import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectories = ["dist-electron", "dist-renderer"];

async function removeDirectory(directoryName) {
  const absolutePath = resolve(process.cwd(), directoryName);
  await rm(absolutePath, { recursive: true, force: true });
  console.log(`Limpieza completada: ${directoryName}`);
}

try {
  await Promise.all(outputDirectories.map(removeDirectory));
} catch (error) {
  console.error("No se pudieron limpiar las compilaciones anteriores.", error);
  process.exitCode = 1;
}
