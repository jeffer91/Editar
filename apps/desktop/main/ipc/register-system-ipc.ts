/* =========================================================
Nombre completo: register-system-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-system-ipc.ts

Función o funciones:
- Registrar los canales IPC iniciales del sistema.
- Validar remitente y contenido antes de responder.
- Entregar información del entorno y comprobar conectividad.
========================================================= */

import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  IPC_CHANNELS,
  type IpcResult,
  type PingInfo,
  type RuntimeInfo,
} from "../../shared/ipc-contracts.js";
import {
  IpcRequestError,
  createFailure,
  createSuccess,
  getSafeRequestId,
  parseRequestEnvelope,
} from "./ipc-validation.js";
import {
  UntrustedSenderError,
  assertTrustedIpcSender,
  type TrustedSourceOptions,
} from "../security/trusted-sources.js";

function handleError<T>(payload: unknown, error: unknown): IpcResult<T> {
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

  console.error("Error interno procesando IPC:", error);

  return createFailure(
    requestId,
    "INTERNAL_ERROR",
    "No fue posible completar la solicitud.",
  );
}

function validateRequest(
  event: IpcMainInvokeEvent,
  payload: unknown,
  trustedSources: TrustedSourceOptions,
) {
  assertTrustedIpcSender(event, trustedSources);
  return parseRequestEnvelope(payload);
}

function registerSystemIpc(trustedSources: TrustedSourceOptions): void {
  ipcMain.removeHandler(IPC_CHANNELS.systemGetRuntimeInfo);
  ipcMain.removeHandler(IPC_CHANNELS.systemPing);

  ipcMain.handle(
    IPC_CHANNELS.systemGetRuntimeInfo,
    (event, payload): IpcResult<RuntimeInfo> => {
      try {
        const request = validateRequest(event, payload, trustedSources);

        return createSuccess(request.requestId, {
          appName: app.getName(),
          appVersion: app.getVersion(),
          platform: process.platform,
          isPackaged: app.isPackaged,
          versions: {
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            node: process.versions.node,
          },
        });
      } catch (error) {
        return handleError<RuntimeInfo>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.systemPing,
    (event, payload): IpcResult<PingInfo> => {
      const receivedAt = Date.now();

      try {
        const request = validateRequest(event, payload, trustedSources);

        return createSuccess(request.requestId, {
          message: "pong",
          receivedAt,
          respondedAt: Date.now(),
        });
      } catch (error) {
        return handleError<PingInfo>(payload, error);
      }
    },
  );
}

export { registerSystemIpc };
