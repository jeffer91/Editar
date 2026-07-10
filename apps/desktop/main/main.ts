/* =========================================================
Nombre completo: main.ts
Ruta o ubicación: /apps/desktop/main/main.ts

Función o funciones:
- Iniciar el proceso principal de Electron.
- Crear una ventana segura para la aplicación.
- Cargar Vite en desarrollo y los archivos compilados en producción.
- Gestionar correctamente el ciclo de vida de la aplicación.
========================================================= */

import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);

let mainWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  return join(currentDirectory, "../preload/preload.cjs");
}

function getRendererPath(): string {
  return join(currentDirectory, "../../dist-renderer/index.html");
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#f5f7fb",
    title: "Editar",
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("El proceso renderer terminó inesperadamente.", details);
  });

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;

  if (!app.isPackaged && developmentUrl) {
    await mainWindow.loadURL(developmentUrl);
    return;
  }

  await mainWindow.loadFile(getRendererPath());
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

process.on("uncaughtException", (error) => {
  console.error("Error no controlado en el proceso principal:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Promesa rechazada sin control:", reason);
});
