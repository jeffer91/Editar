/* =========================================================
Nombre completo: preload.cts
Ruta o ubicación: /apps/desktop/preload/preload.cts

Función o funciones:
- Exponer una API limitada y tipada al renderer.
- Enviar solicitudes únicamente por canales IPC autorizados.
- Proporcionar operaciones seguras de audio, caché y trabajos.
========================================================= */

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

type AnalyzeAudioInput = import("../shared/audio-processing-contracts.js").AnalyzeAudioInput;
type AudioAnalysisRequestResult = import("../shared/audio-processing-contracts.js").AudioAnalysisRequestResult;
type ReduceSilenceInput = import("../shared/audio-processing-contracts.js").ReduceSilenceInput;
type SilenceReductionRequestResult = import("../shared/audio-processing-contracts.js").SilenceReductionRequestResult;
type DatabaseBackupInfo = import("../shared/database-contracts.js").DatabaseBackupInfo;
type DatabaseStatus = import("../shared/database-contracts.js").DatabaseStatus;
type ProjectDocument = import("../shared/domain/index.js").ProjectDocument;
type EditarBridge = import("../shared/ipc-contracts.js").EditarBridge;
type IpcResult<T> = import("../shared/ipc-contracts.js").IpcResult<T>;
type PingInfo = import("../shared/ipc-contracts.js").PingInfo;
type RequestEnvelope = import("../shared/ipc-contracts.js").RequestEnvelope;
type RuntimeInfo = import("../shared/ipc-contracts.js").RuntimeInfo;
type JobActionResult = import("../shared/job-queue-contracts.js").JobActionResult;
type JobIdInput = import("../shared/job-queue-contracts.js").JobIdInput;
type JobQueueSnapshot = import("../shared/job-queue-contracts.js").JobQueueSnapshot;
type ProjectJobInput = import("../shared/job-queue-contracts.js").ProjectJobInput;
type GenerateMediaDerivativesInput = import("../shared/media-cache-contracts.js").GenerateMediaDerivativesInput;
type MediaCacheClearResult = import("../shared/media-cache-contracts.js").MediaCacheClearResult;
type MediaCacheStatus = import("../shared/media-cache-contracts.js").MediaCacheStatus;
type MediaDerivativeRequestResult = import("../shared/media-cache-contracts.js").MediaDerivativeRequestResult;
type AnalyzeMediaInput = import("../shared/media-engine-contracts.js").AnalyzeMediaInput;
type MediaAnalysisRequestResult = import("../shared/media-engine-contracts.js").MediaAnalysisRequestResult;
type MediaEngineStatus = import("../shared/media-engine-contracts.js").MediaEngineStatus;
type ImportMediaInput = import("../shared/media-import-contracts.js").ImportMediaInput;
type MediaImportResult = import("../shared/media-import-contracts.js").MediaImportResult;
type CreateProjectInput = import("../shared/project-management-contracts.js").CreateProjectInput;
type DeleteProjectResult = import("../shared/project-management-contracts.js").DeleteProjectResult;
type DuplicateProjectInput = import("../shared/project-management-contracts.js").DuplicateProjectInput;
type ProjectIdInput = import("../shared/project-management-contracts.js").ProjectIdInput;
type RenameProjectInput = import("../shared/project-management-contracts.js").RenameProjectInput;
type SetProjectStatusInput = import("../shared/project-management-contracts.js").SetProjectStatusInput;
type ProjectListItem = import("../shared/persistence/project-repository.js").ProjectListItem;

const IPC_CHANNELS = Object.freeze({
  systemGetRuntimeInfo: "system:get-runtime-info",
  systemPing: "system:ping",
  databaseGetStatus: "database:get-status",
  databaseCheckIntegrity: "database:check-integrity",
  databaseCreateBackup: "database:create-backup",
  projectsList: "projects:list",
  projectsCreate: "projects:create",
  projectsOpen: "projects:open",
  projectsRename: "projects:rename",
  projectsDuplicate: "projects:duplicate",
  projectsSetStatus: "projects:set-status",
  projectsDelete: "projects:delete",
  mediaChooseAndImport: "media:choose-and-import",
  mediaGetEngineStatus: "media:get-engine-status",
  mediaAnalyze: "media:analyze",
  mediaAnalyzeAudio: "media:analyze-audio",
  mediaReduceSilence: "media:reduce-silence",
  mediaGenerateDerivatives: "media:generate-derivatives",
  mediaGetCacheStatus: "media:get-cache-status",
  mediaClearCache: "media:clear-cache",
  jobsGetSnapshot: "jobs:get-snapshot",
  jobsEnqueueDiagnostic: "jobs:enqueue-diagnostic",
  jobsPause: "jobs:pause",
  jobsResume: "jobs:resume",
  jobsCancel: "jobs:cancel",
  jobsRetry: "jobs:retry",
} as const);

function createRequestEnvelope(): RequestEnvelope {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 14);

  return {
    requestId: `${timestamp.toString(36)}-${randomPart}`,
    sentAt: timestamp,
  };
}

function invoke<TResponse, TPayload = undefined>(
  channel: string,
  payload?: TPayload,
): Promise<IpcResult<TResponse>> {
  const request =
    payload === undefined
      ? createRequestEnvelope()
      : { ...createRequestEnvelope(), payload };

  return ipcRenderer.invoke(channel, request) as Promise<IpcResult<TResponse>>;
}

const bridge: EditarBridge = Object.freeze({
  system: Object.freeze({
    getRuntimeInfo: () =>
      invoke<RuntimeInfo>(IPC_CHANNELS.systemGetRuntimeInfo),
    ping: () => invoke<PingInfo>(IPC_CHANNELS.systemPing),
  }),
  database: Object.freeze({
    getStatus: () =>
      invoke<DatabaseStatus>(IPC_CHANNELS.databaseGetStatus),
    checkIntegrity: () =>
      invoke<DatabaseStatus>(IPC_CHANNELS.databaseCheckIntegrity),
    createBackup: () =>
      invoke<DatabaseBackupInfo>(IPC_CHANNELS.databaseCreateBackup),
  }),
  projects: Object.freeze({
    list: () =>
      invoke<readonly ProjectListItem[]>(IPC_CHANNELS.projectsList),
    create: (input: CreateProjectInput) =>
      invoke<ProjectListItem, CreateProjectInput>(IPC_CHANNELS.projectsCreate, input),
    open: (input: ProjectIdInput) =>
      invoke<ProjectDocument, ProjectIdInput>(IPC_CHANNELS.projectsOpen, input),
    rename: (input: RenameProjectInput) =>
      invoke<ProjectListItem, RenameProjectInput>(IPC_CHANNELS.projectsRename, input),
    duplicate: (input: DuplicateProjectInput) =>
      invoke<ProjectListItem, DuplicateProjectInput>(
        IPC_CHANNELS.projectsDuplicate,
        input,
      ),
    setStatus: (input: SetProjectStatusInput) =>
      invoke<ProjectListItem, SetProjectStatusInput>(
        IPC_CHANNELS.projectsSetStatus,
        input,
      ),
    delete: (input: ProjectIdInput) =>
      invoke<DeleteProjectResult, ProjectIdInput>(
        IPC_CHANNELS.projectsDelete,
        input,
      ),
  }),
  media: Object.freeze({
    chooseAndImport: (input: ImportMediaInput) =>
      invoke<MediaImportResult, ImportMediaInput>(
        IPC_CHANNELS.mediaChooseAndImport,
        input,
      ),
    getEngineStatus: () =>
      invoke<MediaEngineStatus>(IPC_CHANNELS.mediaGetEngineStatus),
    analyze: (input: AnalyzeMediaInput) =>
      invoke<MediaAnalysisRequestResult, AnalyzeMediaInput>(
        IPC_CHANNELS.mediaAnalyze,
        input,
      ),
    analyzeAudio: (input: AnalyzeAudioInput) =>
      invoke<AudioAnalysisRequestResult, AnalyzeAudioInput>(
        IPC_CHANNELS.mediaAnalyzeAudio,
        input,
      ),
    reduceSilence: (input: ReduceSilenceInput) =>
      invoke<SilenceReductionRequestResult, ReduceSilenceInput>(
        IPC_CHANNELS.mediaReduceSilence,
        input,
      ),
    generateDerivatives: (input: GenerateMediaDerivativesInput) =>
      invoke<MediaDerivativeRequestResult, GenerateMediaDerivativesInput>(
        IPC_CHANNELS.mediaGenerateDerivatives,
        input,
      ),
    getCacheStatus: () =>
      invoke<MediaCacheStatus>(IPC_CHANNELS.mediaGetCacheStatus),
    clearCache: () =>
      invoke<MediaCacheClearResult>(IPC_CHANNELS.mediaClearCache),
  }),
  jobs: Object.freeze({
    getSnapshot: () =>
      invoke<JobQueueSnapshot>(IPC_CHANNELS.jobsGetSnapshot),
    enqueueDiagnostic: (input: ProjectJobInput) =>
      invoke<JobActionResult, ProjectJobInput>(
        IPC_CHANNELS.jobsEnqueueDiagnostic,
        input,
      ),
    pause: (input: JobIdInput) =>
      invoke<JobActionResult, JobIdInput>(IPC_CHANNELS.jobsPause, input),
    resume: (input: JobIdInput) =>
      invoke<JobActionResult, JobIdInput>(IPC_CHANNELS.jobsResume, input),
    cancel: (input: JobIdInput) =>
      invoke<JobActionResult, JobIdInput>(IPC_CHANNELS.jobsCancel, input),
    retry: (input: JobIdInput) =>
      invoke<JobActionResult, JobIdInput>(IPC_CHANNELS.jobsRetry, input),
  }),
});

contextBridge.exposeInMainWorld("editar", bridge);
