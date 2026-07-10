/* =========================================================
Nombre completo: register-timeline-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-timeline-ipc.ts

Función o funciones:
- Registrar operaciones IPC de clips, pistas, textos, audio y video.
- Validar remitente y payload antes de editar proyectos.
- Traducir conflictos de dominio a respuestas controladas.
========================================================= */

import { ipcMain } from "electron";
import {
  DomainValidationError,
  type ProjectDocument,
} from "../../shared/domain/index.js";
import {
  IPC_CHANNELS,
  type IpcResult,
} from "../../shared/ipc-contracts.js";
import {
  TimelineEditingConflictError,
  TimelineEditingService,
} from "../timeline/timeline-editing-service.js";
import {
  parseUpdateClipAudioMixRequest,
  parseUpdateClipVisualRequest,
} from "../timeline/clip-properties-request-validation.js";
import {
  parseAddMediaClipRequest,
  parseAddTextClipRequest,
  parseDeleteClipRequest,
  parseMoveClipRequest,
  parseSplitClipRequest,
  parseTrimClipRequest,
  parseUpdateTextClipRequest,
  parseUpdateTrackStateRequest,
} from "../timeline/timeline-request-validation.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
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
  parseRequestWithPayload,
} from "./ipc-validation.js";

interface RegisterTimelineIpcOptions {
  readonly trustedSources: TrustedSourceOptions;
  readonly timelineService: TimelineEditingService;
}

function handleTimelineError<T>(payload: unknown, error: unknown): IpcResult<T> {
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

  if (
    error instanceof TimelineEditingConflictError ||
    error instanceof DomainValidationError
  ) {
    return createFailure(requestId, "CONFLICT", error.message);
  }

  console.error("Error procesando una edición de línea de tiempo:", error);
  return createFailure(
    requestId,
    "DATABASE_ERROR",
    "No fue posible guardar la edición en el proyecto.",
  );
}

function registerTimelineIpc(options: RegisterTimelineIpcOptions): void {
  const { trustedSources, timelineService } = options;
  const channels = [
    IPC_CHANNELS.timelineAddMediaClip,
    IPC_CHANNELS.timelineMoveClip,
    IPC_CHANNELS.timelineTrimClip,
    IPC_CHANNELS.timelineSplitClip,
    IPC_CHANNELS.timelineDeleteClip,
    IPC_CHANNELS.timelineUpdateTrackState,
    IPC_CHANNELS.timelineAddTextClip,
    IPC_CHANNELS.timelineUpdateTextClip,
    IPC_CHANNELS.timelineUpdateClipAudioMix,
    IPC_CHANNELS.timelineUpdateClipVisual,
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(
    IPC_CHANNELS.timelineAddMediaClip,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.addMediaClip(parseAddMediaClipRequest(raw)),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineMoveClip,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.moveClip(parseMoveClipRequest(raw)),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineTrimClip,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.trimClip(parseTrimClipRequest(raw)),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineSplitClip,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.splitClip(parseSplitClipRequest(raw)),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineDeleteClip,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.deleteClip(parseDeleteClipRequest(raw)),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineUpdateTrackState,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.updateTrackState(
            parseUpdateTrackStateRequest(raw),
          ),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineAddTextClip,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.addTextClip(parseAddTextClipRequest(raw)),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineUpdateTextClip,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.updateTextClip(parseUpdateTextClipRequest(raw)),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineUpdateClipAudioMix,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.updateClipAudioMix(
            parseUpdateClipAudioMixRequest(raw),
          ),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.timelineUpdateClipVisual,
    async (event, payload): Promise<IpcResult<ProjectDocument>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: raw } = parseRequestWithPayload(payload);
        return createSuccess(
          request.requestId,
          await timelineService.updateClipVisual(
            parseUpdateClipVisualRequest(raw),
          ),
        );
      } catch (error) {
        return handleTimelineError(payload, error);
      }
    },
  );
}

export {
  registerTimelineIpc,
  type RegisterTimelineIpcOptions,
};
