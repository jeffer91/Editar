/* =========================================================
Nombre completo: ipc-contracts.ts
Ruta o ubicación: /apps/desktop/shared/ipc-contracts.ts

Función o funciones:
- Definir los canales IPC permitidos por la aplicación.
- Compartir contratos tipados entre main, preload y renderer.
- Estandarizar respuestas exitosas y errores controlados.
========================================================= */

import type { DatabaseBridge } from "./database-contracts.js";
import type { JobQueueBridge } from "./job-queue-contracts.js";
import type { MediaImportBridge } from "./media-import-contracts.js";
import type { ProjectBridge } from "./project-management-contracts.js";

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
  jobsGetSnapshot: "jobs:get-snapshot",
  jobsEnqueueDiagnostic: "jobs:enqueue-diagnostic",
  jobsPause: "jobs:pause",
  jobsResume: "jobs:resume",
  jobsCancel: "jobs:cancel",
  jobsRetry: "jobs:retry",
} as const);

type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

interface RequestEnvelope {
  readonly requestId: string;
  readonly sentAt: number;
}

interface RuntimeInfo {
  readonly appName: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly isPackaged: boolean;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
  };
}

interface PingInfo {
  readonly message: "pong";
  readonly receivedAt: number;
  readonly respondedAt: number;
}

type IpcErrorCode =
  | "INVALID_REQUEST"
  | "UNTRUSTED_SENDER"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

interface IpcSuccess<T> {
  readonly ok: true;
  readonly requestId: string;
  readonly data: T;
}

interface IpcFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly error: {
    readonly code: IpcErrorCode;
    readonly message: string;
  };
}

type IpcResult<T> = IpcSuccess<T> | IpcFailure;

interface SystemBridge {
  getRuntimeInfo(): Promise<IpcResult<RuntimeInfo>>;
  ping(): Promise<IpcResult<PingInfo>>;
}

interface EditarBridge {
  readonly system: SystemBridge;
  readonly database: DatabaseBridge;
  readonly projects: ProjectBridge;
  readonly media: MediaImportBridge;
  readonly jobs: JobQueueBridge;
}

export {
  IPC_CHANNELS,
  type EditarBridge,
  type IpcChannel,
  type IpcErrorCode,
  type IpcFailure,
  type IpcResult,
  type IpcSuccess,
  type PingInfo,
  type RequestEnvelope,
  type RuntimeInfo,
  type SystemBridge,
};
