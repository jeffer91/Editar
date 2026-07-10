/* =========================================================
Nombre completo: register-job-queue-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-job-queue-ipc.ts

Función o funciones:
- Registrar consultas y acciones IPC de la cola.
- Validar remitente e identificadores antes de operar.
- Traducir conflictos y trabajos inexistentes a errores controlados.
========================================================= */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  IPC_CHANNELS,
  type IpcResult,
} from "../../shared/ipc-contracts.js";
import type {
  JobActionResult,
  JobQueueSnapshot,
} from "../../shared/job-queue-contracts.js";
import {
  JobNotFoundError,
  JobQueueConflictError,
  JobQueueService,
} from "../jobs/job-queue-service.js";
import {
  parseJobIdInput,
  parseProjectJobInput,
} from "../jobs/job-queue-request-validation.js";
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
  parseRequestWithPayload,
} from "./ipc-validation.js";

interface RegisterJobQueueIpcOptions {
  readonly trustedSources: TrustedSourceOptions;
  readonly jobQueue: JobQueueService;
}

function handleJobError<T>(payload: unknown, error: unknown): IpcResult<T> {
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

  if (error instanceof JobNotFoundError) {
    return createFailure(requestId, "NOT_FOUND", error.message);
  }

  if (error instanceof JobQueueConflictError) {
    return createFailure(requestId, "CONFLICT", error.message);
  }

  console.error("Error procesando la cola de trabajos:", error);
  return createFailure(
    requestId,
    "DATABASE_ERROR",
    "No fue posible completar la operación de la cola.",
  );
}

function validateSender(
  event: IpcMainInvokeEvent,
  trustedSources: TrustedSourceOptions,
): void {
  assertTrustedIpcSender(event, trustedSources);
}

function registerJobQueueIpc(options: RegisterJobQueueIpcOptions): void {
  const { trustedSources, jobQueue } = options;
  const actionChannels = [
    IPC_CHANNELS.jobsPause,
    IPC_CHANNELS.jobsResume,
    IPC_CHANNELS.jobsCancel,
    IPC_CHANNELS.jobsRetry,
  ] as const;

  for (const channel of [
    IPC_CHANNELS.jobsGetSnapshot,
    IPC_CHANNELS.jobsEnqueueDiagnostic,
    ...actionChannels,
  ]) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(
    IPC_CHANNELS.jobsGetSnapshot,
    async (event, payload): Promise<IpcResult<JobQueueSnapshot>> => {
      try {
        validateSender(event, trustedSources);
        const request = parseRequestEnvelope(payload);
        return createSuccess(request.requestId, await jobQueue.getSnapshot());
      } catch (error) {
        return handleJobError<JobQueueSnapshot>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.jobsEnqueueDiagnostic,
    async (event, payload): Promise<IpcResult<JobActionResult>> => {
      try {
        validateSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseProjectJobInput(inputPayload);
        return createSuccess(
          request.requestId,
          await jobQueue.enqueueDiagnostic(input.projectId),
        );
      } catch (error) {
        return handleJobError<JobActionResult>(payload, error);
      }
    },
  );

  const actions = new Map([
    [IPC_CHANNELS.jobsPause, (id: Parameters<JobQueueService["pause"]>[0]) => jobQueue.pause(id)],
    [IPC_CHANNELS.jobsResume, (id: Parameters<JobQueueService["resume"]>[0]) => jobQueue.resume(id)],
    [IPC_CHANNELS.jobsCancel, (id: Parameters<JobQueueService["cancel"]>[0]) => jobQueue.cancel(id)],
    [IPC_CHANNELS.jobsRetry, (id: Parameters<JobQueueService["retry"]>[0]) => jobQueue.retry(id)],
  ] as const);

  for (const channel of actionChannels) {
    ipcMain.handle(
      channel,
      async (event, payload): Promise<IpcResult<JobActionResult>> => {
        try {
          validateSender(event, trustedSources);
          const { request, payload: inputPayload } = parseRequestWithPayload(payload);
          const input = parseJobIdInput(inputPayload);
          const action = actions.get(channel);

          if (!action) {
            throw new IpcRequestError(
              "INVALID_REQUEST",
              "La acción solicitada no está registrada.",
            );
          }

          return createSuccess(request.requestId, await action(input.jobId));
        } catch (error) {
          return handleJobError<JobActionResult>(payload, error);
        }
      },
    );
  }
}

export {
  registerJobQueueIpc,
  type RegisterJobQueueIpcOptions,
};
