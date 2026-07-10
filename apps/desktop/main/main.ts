/* =========================================================
Nombre completo: main.ts
Ruta o ubicación: /apps/desktop/main/main.ts

Función o funciones:
- Iniciar el proceso principal de Electron.
- Integrar SQLite, motores, audio, línea de tiempo y textos.
- Registrar IPC, protocolo interno y cierre ordenado de Workers.
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
import { registerTimelineIpc } from "./ipc/register-timeline-ipc.js";
import { AudioAnalysisJobHandler } from "./jobs/audio-analysis-job-handler.js";
import { CompositeJobResultHandler } from "./jobs/composite-job-result-handler.js";
import { JobQueueService } from "./jobs/job-queue-service.js";
import { MediaDerivativeJobHandler } from "./jobs/media-derivative-job-handler.js";
import { MediaProbeJobHandler } from "./jobs/media-probe-job-handler.js";
import { WorkerThreadJobExecutor } from "./jobs/worker-thread-job-executor.js";
import { AudioAnalysisService } from "./media/audio-analysis-service.js";
import { FfmpegBinaryService } from "./media/ffmpeg-binary-service.js";
import { MediaAnalysisService } from "./media/media-analysis-service.js";
import {
  registerMediaCacheProtocol,
  registerMediaCacheScheme,
} from "./media/media-cache-protocol.js";
import { MediaCachePaths } from "./media/media-cache-paths.js";
import { MediaCacheService } from "./media/media-cache-service.js";
import { MediaDerivativeService } from "./media/media-derivative-service.js";
import { MediaImportService } from "./media/media-import-service.js";
import { SilenceReductionService } from "./media/silence-reduction-service.js";
import { ProjectManagementService } from "./projects/project-management-service.js";
import { applyWindowSecurity } from "./security/window-security.js";
import type { TrustedSourceOptions } from "./security/trusted-sources.js";
import { TimelineEditingService } from "./timeline/timeline-editing-service.js";

registerMediaCacheScheme();

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
    const timelineService = new TimelineEditingService(service.projects);
    const engines = new FfmpegBinaryService({
      applicationPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      workspacePath: process.cwd(),
    });
    const cachePaths = new MediaCachePaths(
      join(app.getPath("userData"), "cache", "media"),
    );
    const mediaCacheService = new MediaCacheService({
      paths: cachePaths,
      media: service.media,
      jobs: service.jobs,
    });
    await mediaCacheService.reconcile();

    const resultHandler = new CompositeJobResultHandler();
    const jobQueue = new JobQueueService({
      repository: service.jobs,
      projects: service.projects,
      executor: new WorkerThreadJobExecutor(),
      resultHandler,
      concurrency: 2,
      pollIntervalMs: 250,
    });
    const mediaDerivativeService = new MediaDerivativeService({
      projects: service.projects,
      media: service.media,
      jobs: service.jobs,
      engines,
      queue: jobQueue,
      paths: cachePaths,
    });
    const audioAnalysisService = new AudioAnalysisService({
      projects: service.projects,
      media: service.media,
      jobs: service.jobs,
      engines,
      queue: jobQueue,
    });
    const silenceReductionService = new SilenceReductionService({
      projects: service.projects,
      media: service.media,
      jobs: service.jobs,
      engines,
      queue: jobQueue,
      paths: cachePaths,
    });

    resultHandler.add(
      new MediaProbeJobHandler(
        service.media,
        mediaDerivativeService,
        audioAnalysisService,
      ),
      new AudioAnalysisJobHandler(service.media),
      new MediaDerivativeJobHandler(service.media, cachePaths),
    );

    const mediaAnalysisService = new MediaAnalysisService({
      projects: service.projects,
      media: service.media,
      jobs: service.jobs,
      engines,
      queue: jobQueue,
    });
    const mediaImportService = new MediaImportService(
      service.projects,
      mediaAnalysisService,
    );

    await registerMediaCacheProtocol({
      media: service.media,
      paths: cachePaths,
    });

    jobQueueService = jobQueue;
    await jobQueue.start();
    void engines.getStatus().catch((error) => {
      console.error("No fue posible comprobar FFmpeg y FFprobe.", error);
    });

    registerSystemIpc(trustedSources);
    registerDatabaseIpc({
      trustedSources,
      databaseService: service,
    });
    registerProjectIpc({
      trustedSources,
      projectService,
    });
    registerTimelineIpc({
      trustedSources,
      timelineService,
    });
    registerMediaIpc({
      trustedSources,
      mediaImportService,
      mediaAnalysisService,
      audioAnalysisService,
      silenceReductionService,
      mediaDerivativeService,
      mediaCacheService,
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
