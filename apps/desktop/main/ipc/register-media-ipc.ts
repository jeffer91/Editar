/* =========================================================
Nombre completo: register-media-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-media-ipc.ts

Función o funciones:
- Abrir el selector nativo y ejecutar operaciones multimedia.
- Exponer análisis, derivados y diagnóstico de caché por IPC seguro.
- Rechazar rutas y comandos enviados desde el renderer.
========================================================= */

import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from "electron";
import {
  IPC_CHANNELS,
  type IpcResult,
} from "../../shared/ipc-contracts.js";
import type {
  MediaCacheClearResult,
  MediaCacheStatus,
  MediaDerivativeRequestResult,
} from "../../shared/media-cache-contracts.js";
import type {
  MediaAnalysisRequestResult,
  MediaEngineStatus,
} from "../../shared/media-engine-contracts.js";
import type { MediaImportResult } from "../../shared/media-import-contracts.js";
import {
  MediaAnalysisConflictError,
  MediaAnalysisService,
} from "../media/media-analysis-service.js";
import {
  MediaCacheConflictError,
  MediaCacheService,
} from "../media/media-cache-service.js";
import {
  MediaDerivativeConflictError,
  MediaDerivativeService,
} from "../media/media-derivative-service.js";
import {
  MediaImportConflictError,
  MediaImportService,
} from "../media/media-import-service.js";
import { SUPPORTED_MEDIA_EXTENSIONS } from "../media/media-file-inspector.js";
import {
  parseAnalyzeMediaInput,
  parseGenerateMediaDerivativesInput,
} from "../media/media-request-validation.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
import { parseProjectIdInput } from "../projects/project-request-validation.js";
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

interface RegisterMediaIpcOptions {
  readonly trustedSources: TrustedSourceOptions;
  readonly mediaImportService: MediaImportService;
  readonly mediaAnalysisService: MediaAnalysisService;
  readonly mediaDerivativeService: MediaDerivativeService;
  readonly mediaCacheService: MediaCacheService;
}

const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "mkv", "webm", "avi"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

function handleMediaError<T>(
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

  if (
    error instanceof MediaImportConflictError ||
    error instanceof MediaAnalysisConflictError ||
    error instanceof MediaDerivativeConflictError ||
    error instanceof MediaCacheConflictError
  ) {
    return createFailure(requestId, "CONFLICT", error.message);
  }

  console.error("Error procesando una operación multimedia:", error);

  return createFailure(
    requestId,
    "INTERNAL_ERROR",
    "No fue posible completar la operación multimedia.",
  );
}

async function chooseMediaFiles(
  event: IpcMainInvokeEvent,
): Promise<readonly string[] | null> {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const options: OpenDialogOptions = {
    title: "Importar archivos multimedia",
    buttonLabel: "Importar",
    properties: ["openFile", "multiSelections", "dontAddToRecent"],
    filters: [
      { name: "Archivos multimedia", extensions: [...SUPPORTED_MEDIA_EXTENSIONS] },
      { name: "Videos", extensions: VIDEO_EXTENSIONS },
      { name: "Audio", extensions: AUDIO_EXTENSIONS },
      { name: "Imágenes", extensions: IMAGE_EXTENSIONS },
    ],
  };
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options);

  return result.canceled ? null : Object.freeze(result.filePaths);
}

function registerMediaIpc(options: RegisterMediaIpcOptions): void {
  const {
    trustedSources,
    mediaImportService,
    mediaAnalysisService,
    mediaDerivativeService,
    mediaCacheService,
  } = options;

  for (const channel of [
    IPC_CHANNELS.mediaChooseAndImport,
    IPC_CHANNELS.mediaGetEngineStatus,
    IPC_CHANNELS.mediaAnalyze,
    IPC_CHANNELS.mediaGenerateDerivatives,
    IPC_CHANNELS.mediaGetCacheStatus,
    IPC_CHANNELS.mediaClearCache,
  ]) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(
    IPC_CHANNELS.mediaChooseAndImport,
    async (event, payload): Promise<IpcResult<MediaImportResult>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseProjectIdInput(inputPayload);
        const selectedPaths = await chooseMediaFiles(event);

        if (!selectedPaths) {
          return createSuccess(
            request.requestId,
            await mediaImportService.createCanceledResult(input.projectId),
          );
        }

        return createSuccess(
          request.requestId,
          await mediaImportService.importPaths(input.projectId, selectedPaths),
        );
      } catch (error) {
        return handleMediaError<MediaImportResult>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.mediaGetEngineStatus,
    async (event, payload): Promise<IpcResult<MediaEngineStatus>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const request = parseRequestEnvelope(payload);
        return createSuccess(
          request.requestId,
          await mediaAnalysisService.getEngineStatus(true),
        );
      } catch (error) {
        return handleMediaError<MediaEngineStatus>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.mediaAnalyze,
    async (event, payload): Promise<IpcResult<MediaAnalysisRequestResult>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseAnalyzeMediaInput(inputPayload);
        return createSuccess(
          request.requestId,
          await mediaAnalysisService.enqueue(input.projectId, input.mediaId),
        );
      } catch (error) {
        return handleMediaError<MediaAnalysisRequestResult>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.mediaGenerateDerivatives,
    async (event, payload): Promise<IpcResult<MediaDerivativeRequestResult>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const { request, payload: inputPayload } = parseRequestWithPayload(payload);
        const input = parseGenerateMediaDerivativesInput(inputPayload);
        return createSuccess(
          request.requestId,
          await mediaDerivativeService.enqueue(input.projectId, input.mediaId),
        );
      } catch (error) {
        return handleMediaError<MediaDerivativeRequestResult>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.mediaGetCacheStatus,
    async (event, payload): Promise<IpcResult<MediaCacheStatus>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const request = parseRequestEnvelope(payload);
        return createSuccess(request.requestId, await mediaCacheService.getStatus());
      } catch (error) {
        return handleMediaError<MediaCacheStatus>(payload, error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.mediaClearCache,
    async (event, payload): Promise<IpcResult<MediaCacheClearResult>> => {
      try {
        assertTrustedIpcSender(event, trustedSources);
        const request = parseRequestEnvelope(payload);
        return createSuccess(request.requestId, await mediaCacheService.clear());
      } catch (error) {
        return handleMediaError<MediaCacheClearResult>(payload, error);
      }
    },
  );
}

export {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  chooseMediaFiles,
  registerMediaIpc,
  type RegisterMediaIpcOptions,
};
