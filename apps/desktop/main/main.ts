/* =========================================================
Nombre completo: main.ts
Ruta o ubicación: /apps/desktop/main/main.ts

Función o funciones:
- Iniciar el proceso principal de Electron.
- Inicializar SQLite y la cola persistente.
- Registrar IPC de sistema, proyectos, medios y trabajos.
- Cerrar trabajadores y base de datos de forma ordenada.
========================================================= */

import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DatabaseService,
  createDatabasePaths,
} from "./database/database-service.js";
import { registerDatabaseIpc } from "./ipc/register-database-ipc.js";
import { registerJobQueueIpc } from "./ipc/register-job-queue-ipc.js";
import { registerMediaIpc } from "./ipc/register-media-ipc.js";
import { registerProjectIpc } from "./ipc/register-project-ipc.js";
import { registerSystemIpc } from "./ipc/register-system-ipc.js";
import { JobQueueService } from "./jobs/job-queue-service.js";
import { WorkerThreadJobExecutor } from "./jobs/worker-thread-job-executor.js";
import { MediaImportService } from "./media/media-import-service.js";
import { ProjectManagementService } from "./projects/project-management-service.js";
import { applyWindowSecurity } from "./security/window-security.js";
import type { TrustedSourceOptions } from "./security/trusted-sources.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const developmentUrl = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let databaseService: DatabaseService | null = null;
let jobQueueService: JobQueueService | null = null;
let shutdownStarted = false;

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

async function shutdownApplication(): Promise<void> {
  await jobQueueService?.stop();
  jobQueueService = null;
  databaseService?.close();
  databaseService = null;
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
    const mediaImportService = new MediaImportService(service.projects);
    const jobQueue = new JobQueueService({
      repository: service.jobs,
      projects: service.projects,
      executor: new WorkerThreadJobExecutor(),
      concurrency: 2,
      pollIntervalMs: 250,
    });
    jobQueueService = jobQueue;
    await jobQueue.start();

    registerSystemIpc(trustedSources);
    registerDatabaseIpc({
      trustedSources,
      databaseService: service,
    });
    registerProjectIpc({
      trustedSources,
      projectService,
    });
    registerMediaIpc({
      trustedSources,
      mediaImportService,
    });
    registerJobQueueIpc({
      trustedSources,
      jobQueue,
    });
    await createMainWindow(trustedSources);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow(trustedSources);
      }
    });
  })
  .catch((error: unknown) => {
    void shutdownApplication().finally(() => {
      console.error("No fue posible iniciar la aplicación:", error);
      app.quit();
    });
  });

app.on("before-quit", (event) => {
  if (shutdownStarted) {
    return;
  }

  event.preventDefault();
  shutdownStarted = true;
  void shutdownApplication().finally(() => app.quit());
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
