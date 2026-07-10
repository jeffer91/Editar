/* =========================================================
Nombre completo: preload.cts
Ruta o ubicación: /apps/desktop/preload/preload.cts

Función o funciones:
- Exponer una API limitada y tipada al renderer.
- Enviar solicitudes únicamente por canales IPC autorizados.
- Proporcionar operaciones seguras del sistema y SQLite.
========================================================= */

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

type DatabaseBackupInfo = import("../shared/database-contracts.js").DatabaseBackupInfo;
type DatabaseStatus = import("../shared/database-contracts.js").DatabaseStatus;
type EditarBridge = import("../shared/ipc-contracts.js").EditarBridge;
type IpcResult<T> = import("../shared/ipc-contracts.js").IpcResult<T>;
type PingInfo = import("../shared/ipc-contracts.js").PingInfo;
type RequestEnvelope = import("../shared/ipc-contracts.js").RequestEnvelope;
type RuntimeInfo = import("../shared/ipc-contracts.js").RuntimeInfo;

const IPC_CHANNELS = Object.freeze({
  systemGetRuntimeInfo: "system:get-runtime-info",
  systemPing: "system:ping",
  databaseGetStatus: "database:get-status",
  databaseCheckIntegrity: "database:check-integrity",
  databaseCreateBackup: "database:create-backup",
} as const);

function createRequestEnvelope(): RequestEnvelope {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 14);

  return {
    requestId: `${timestamp.toString(36)}-${randomPart}`,
    sentAt: timestamp,
  };
}

function invoke<T>(channel: string): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(
    channel,
    createRequestEnvelope(),
  ) as Promise<IpcResult<T>>;
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
});

contextBridge.exposeInMainWorld("editar", bridge);
