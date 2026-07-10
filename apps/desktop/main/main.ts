/* =========================================================
Nombre completo: main.ts
Ruta o ubicación: /apps/desktop/main/main.ts

Función o funciones:
- Iniciar el proceso principal de Electron.
- Inicializar y cerrar SQLite de forma controlada.
- Registrar IPC de sistema, base de datos y proyectos.
- Gestionar correctamente el ciclo de vida de la aplicación.
========================================================= */

import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DatabaseService,
  createDatabasePaths,
} from "./database/database-service.js";
import { registerDatabaseIpc } from "./ipc/register-database-ipc.js";
import { registerProjectIpc } from "./ipc/register-project-ipc.js";
import { registerSystemIpc } from "./ipc/register-system-ipc.js";
import { ProjectManagementService } from "./projects/project-management-service.js";
import { applyWindowSecurity } from "./security/window-security.js";
import type { TrustedSourceOptions } from "./security/trusted-sources.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const developmentUrl = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let databaseService: DatabaseService | null = null;

function getPreloadPath(): string {
  return join(currentDirectory, "../preload/preload.cjs");
}

function getRendererPath(): string {
  return join(currentDirectory, "../../dist-renderer/index.html");
}

function getTrustedSources(): TrustedSourceOptions {
  return {
    developmentUrl,
    productionUrl: pathToFileURL(getRendererPath()).href,
  };
}

async function createMainWindow(
  trustedSources: TrustedSourceOptions,
): Promise<void> {
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
      webviewTag: false,
    },
  });

  applyWindowSecurity(mainWindow, trustedSources);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("El proceso renderer terminó inesperadamente.", details);
  });

  if (!app.isPackaged && developmentUrl) {
    await mainWindow.loadURL(developmentUrl);
    return;
  }

  await mainWindow.loadFile(getRendererPath());
}

app
  .whenReady()
  .then(async () => {
    const trustedSources = getTrustedSources();
    const service = new DatabaseService({
      paths: createDatabasePaths(app.getPath("userData")),
      automaticBackups: true,
      maxBackups: 10,
    });

    await service.initialize();
    databaseService = service;

    const projectService = new ProjectManagementService(service.projects);

    registerSystemIpc(trustedSources);
    registerDatabaseIpc({
      trustedSources,
      databaseService: service,
    });
    registerProjectIpc({
      trustedSources,
      projectService,
    });
    await createMainWindow(trustedSources);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow(trustedSources);
      }
    });
  })
  .catch((error: unknown) => {
    databaseService?.close();
    databaseService = null;
    console.error("No fue posible iniciar la aplicación:", error);
    app.quit();
  });

app.once("will-quit", () => {
  databaseService?.close();
  databaseService = null;
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
