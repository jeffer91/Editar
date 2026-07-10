/* =========================================================
Nombre completo: register-timeline-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-timeline-ipc.ts

Función o funciones:
- Registrar operaciones IPC de clips, audio, video, transiciones y sonidos.
- Validar remitente y payload antes de editar proyectos.
- Traducir conflictos de dominio a respuestas controladas.
========================================================= */

import { ipcMain } from "electron";
import {
  DomainValidationError,
  type ProjectDocument,
} from "../../shared/domain/index.js";
import { IPC_CHANNELS, type IpcResult } from "../../shared/ipc-contracts.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
import {
  UntrustedSenderError,
  assertTrustedIpcSender,
  type TrustedSourceOptions,
} from "../security/trusted-sources.js";
import {
  parseUpdateClipAudioMixRequest,
  parseUpdateClipVisualRequest,
} from "../timeline/clip-properties-request-validation.js";
import {
  TimelineEditingConflictError,
  TimelineEditingService,
} from "../timeline/timeline-editing-service.js";
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
import {
  parseAddSoundEffectRequest,
  parseDeleteSoundEffectRequest,
  parseRemoveTransitionRequest,
  parseSetTransitionRequest,
  parseUpdateSoundEffectRequest,
} from "../timeline/transition-sound-request-validation.js";
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
    IPC_CHANNELS.timelineSetTransition,
    IPC_CHANNELS.timelineRemoveTransition,
    IPC_CHANNELS.timelineAddSoundEffect,
    IPC_CHANNELS.timelineUpdateSoundEffect,
    IPC_CHANNELS.timelineDeleteSoundEffect,
  ];
  for (const channel of channels) ipcMain.removeHandler(channel);

  const handle = (
    channel: string,
    action: (raw: unknown) => Promise<ProjectDocument>,
  ): void => {
    ipcMain.handle(
      channel,
      async (event, payload): Promise<IpcResult<ProjectDocument>> => {
        try {
          assertTrustedIpcSender(event, trustedSources);
          const { request, payload: raw } = parseRequestWithPayload(payload);
          return createSuccess(request.requestId, await action(raw));
        } catch (error) {
          return handleTimelineError(payload, error);
        }
      },
    );
  };

  handle(IPC_CHANNELS.timelineAddMediaClip, (raw) =>
    timelineService.addMediaClip(parseAddMediaClipRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineMoveClip, (raw) =>
    timelineService.moveClip(parseMoveClipRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineTrimClip, (raw) =>
    timelineService.trimClip(parseTrimClipRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineSplitClip, (raw) =>
    timelineService.splitClip(parseSplitClipRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineDeleteClip, (raw) =>
    timelineService.deleteClip(parseDeleteClipRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineUpdateTrackState, (raw) =>
    timelineService.updateTrackState(parseUpdateTrackStateRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineAddTextClip, (raw) =>
    timelineService.addTextClip(parseAddTextClipRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineUpdateTextClip, (raw) =>
    timelineService.updateTextClip(parseUpdateTextClipRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineUpdateClipAudioMix, (raw) =>
    timelineService.updateClipAudioMix(parseUpdateClipAudioMixRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineUpdateClipVisual, (raw) =>
    timelineService.updateClipVisual(parseUpdateClipVisualRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineSetTransition, (raw) =>
    timelineService.setTransition(parseSetTransitionRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineRemoveTransition, (raw) =>
    timelineService.removeTransition(parseRemoveTransitionRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineAddSoundEffect, (raw) =>
    timelineService.addSoundEffect(parseAddSoundEffectRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineUpdateSoundEffect, (raw) =>
    timelineService.updateSoundEffect(parseUpdateSoundEffectRequest(raw)),
  );
  handle(IPC_CHANNELS.timelineDeleteSoundEffect, (raw) =>
    timelineService.deleteSoundEffect(parseDeleteSoundEffectRequest(raw)),
  );
}

export { registerTimelineIpc, type RegisterTimelineIpcOptions };
