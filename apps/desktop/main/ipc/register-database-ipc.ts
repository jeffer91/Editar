/* =========================================================
Nombre completo: register-database-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-database-ipc.ts

Función o funciones:
- Exponer estado, integridad y respaldos mediante IPC seguro.
- Validar el origen y estructura de cada solicitud.
- Impedir que el renderer acceda directamente a SQLite.
========================================================= */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type {
  DatabaseBackupInfo,
  DatabaseStatus,
} from "../../shared/database-contracts.js";
import {
  IPC_CHANNELS,
  type IpcResult,
} from "../../shared/ipc-contracts.js";
import type { DatabaseService } from "../database/database-service.js";
import {
  UntrustedSenderError,
  assertTrustedIpcSender,
  type TrustedSourceOptions,
} from "../security/trusted-sources.js";
import {
  IpcRequestError,
  createFailure,
  createSuccess,
  getSafeRequestId,
  parseRequestEnvelope,
} from "./ipc-validation.js";

interface RegisterDatabaseIpcOptions {
  readonly trustedSources: TrustedSourceOptions;
  readonly databaseService: DatabaseService;
}

function validateRequest(
  event: IpcMainInvokeEvent,
  payload: unknown,
  trustedSources: TrustedSourceOptions,
) {
  assertTrustedIpcSender(event, trustedSources);
  return parseRequestEnvelope(payload);
}

function handleDatabaseError<T>(
  payload: unknown,
  error: unknown,
): IpcResult<T> {
  const requestId = getSafeRequestId(payload);

  if (error instanceof UntrustedSenderError) {
    return createFailure(
      requestId,
      "UNTRUSTED_SENDER",
      "La solicitud fue bloqueada por seguridad.",
    );
  }

  if (error instanceof IpcRequestError) {
    return createFailure(requestId, error.code, error.message);
  }

  console.error("Error procesando una operación de SQLite:", error);

  return createFailure(
    requestId,
    "DATABASE_ERROR",
    "No fue posible completar la operación de almacenamiento.",
  );
}

function registerDatabaseIpc(options: RegisterDatabaseIpcOptions): void {
  const { trustedSources, databaseService } = options;

  ipcMain.removeHandler(IPC_CHANNELS.databaseGetStatus);
  ipcMain.removeHandler(IPC_CHANNELS.databaseCheckIntegrity);
  ipcMain.removeHandler(IPC_CHANNELS.databaseCreateBackup);

  ipcMain.handle(
    IPC_CHANNELS.databaseGetStatus,
    async (event, payload): Promise<IpcResult<DatabaseStatus>> => {
      try {
        const request = validateRequest(event, payload, trustedSources);
        const status = await databaseService.getStatus(false);
        return createSuccess(request.requestId, status);
      } catch (error) {
        return handleDatabaseError<DatabaseStatus>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.databaseCheckIntegrity,
    async (event, payload): Promise<IpcResult<DatabaseStatus>> => {
      try {
        const request = validateRequest(event, payload, trustedSources);
        const status = await databaseService.getStatus(true);
        return createSuccess(request.requestId, status);
      } catch (error) {
        return handleDatabaseError<DatabaseStatus>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.databaseCreateBackup,
    async (event, payload): Promise<IpcResult<DatabaseBackupInfo>> => {
      try {
        const request = validateRequest(event, payload, trustedSources);
        const backupInfo = await databaseService.createBackup(false);
        return createSuccess(request.requestId, backupInfo);
      } catch (error) {
        return handleDatabaseError<DatabaseBackupInfo>(payload, error);
      }
    },
  );
}

export { registerDatabaseIpc, type RegisterDatabaseIpcOptions };
