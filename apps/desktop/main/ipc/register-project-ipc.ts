/* =========================================================
Nombre completo: register-project-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-project-ipc.ts

Función o funciones:
- Registrar las operaciones IPC de gestión de proyectos.
- Validar remitente, solicitud y datos de cada operación.
- Traducir errores de dominio a respuestas controladas.
========================================================= */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { ProjectDocument } from "../../shared/domain/index.js";
import {
  IPC_CHANNELS,
  type IpcResult,
} from "../../shared/ipc-contracts.js";
import type { DeleteProjectResult } from "../../shared/project-management-contracts.js";
import type { ProjectListItem } from "../../shared/persistence/project-repository.js";
import {
  ProjectManagementService,
  ProjectNotFoundError,
} from "../projects/project-management-service.js";
import {
  parseCreateProjectInput,
  parseDuplicateProjectInput,
  parseProjectIdInput,
  parseRenameProjectInput,
  parseSetProjectStatusInput,
} from "../projects/project-request-validation.js";
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

interface RegisterProjectIpcOptions {
  readonly trustedSources: TrustedSourceOptions;
  readonly projectService: ProjectManagementService;
}

function validateSender(
  event: IpcMainInvokeEvent,
  trustedSources: TrustedSourceOptions,
): void {
  assertTrustedIpcSender(event, trustedSources);
}

function handleProjectError<T>(
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

  if (error instanceof ProjectNotFoundError) {
    return createFailure(requestId, "NOT_FOUND", error.message);
  }

  console.error("Error procesando una operación de proyectos:", error);

  return createFailure(
    requestId,
    "DATABASE_ERROR",
    "No fue posible completar la operación del proyecto.",
  );
}

function registerProjectIpc(options: RegisterProjectIpcOptions): void {
  const { trustedSources, projectService } = options;

  for (const channel of [
    IPC_CHANNELS.projectsList,
    IPC_CHANNELS.projectsCreate,
    IPC_CHANNELS.projectsOpen,
    IPC_CHANNELS.projectsRename,
    IPC_CHANNELS.projectsDuplicate,
    IPC_CHANNELS.projectsSetStatus,
    IPC_CHANNELS.projectsDelete,
  ]) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(
    IPC_CHANNELS.projectsList,
    async (event, payload): Promise<IpcResult<readonly ProjectListItem[]>> => {
      try {
        validateSender(event, trustedSources);
        const request = parseRequestEnvelope(payload);
        return createSuccess(request.requestId, await projectService.list());
      } catch (error) {
        return handleProjectError<readonly ProjectListItem[]>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.projectsCreate,
    async (event, payload): Promise<IpcResult<ProjectListItem>> => {
      try {
        validateSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseCreateProjectInput(inputPayload);
        return createSuccess(request.requestId, await projectService.create(input));
      } catch (error) {
        return handleProjectError<ProjectListItem>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.projectsOpen,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        validateSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseProjectIdInput(inputPayload);
        return createSuccess(
          request.requestId,
          await projectService.open(input.projectId),
        );
      } catch (error) {
        return handleProjectError<ProjectDocument>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.projectsRename,
    async (event, payload): Promise<IpcResult<ProjectListItem>> => {
      try {
        validateSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseRenameProjectInput(inputPayload);
        return createSuccess(request.requestId, await projectService.rename(input));
      } catch (error) {
        return handleProjectError<ProjectListItem>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.projectsDuplicate,
    async (event, payload): Promise<IpcResult<ProjectListItem>> => {
      try {
        validateSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseDuplicateProjectInput(inputPayload);
        return createSuccess(
          request.requestId,
          await projectService.duplicate(input),
        );
      } catch (error) {
        return handleProjectError<ProjectListItem>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.projectsSetStatus,
    async (event, payload): Promise<IpcResult<ProjectListItem>> => {
      try {
        validateSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseSetProjectStatusInput(inputPayload);
        return createSuccess(
          request.requestId,
          await projectService.setStatus(input),
        );
      } catch (error) {
        return handleProjectError<ProjectListItem>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.projectsDelete,
    async (event, payload): Promise<IpcResult<DeleteProjectResult>> => {
      try {
        validateSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseProjectIdInput(inputPayload);
        await projectService.delete(input.projectId);

        return createSuccess(request.requestId, {
          projectId: input.projectId,
          deleted: true,
        });
      } catch (error) {
        return handleProjectError<DeleteProjectResult>(payload, error);
      }
    },
  );
}

export { registerProjectIpc, type RegisterProjectIpcOptions };
