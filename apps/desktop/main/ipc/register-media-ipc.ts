/* =========================================================
Nombre completo: register-media-ipc.ts
Ruta o ubicación: /apps/desktop/main/ipc/register-media-ipc.ts

Función o funciones:
- Abrir el selector nativo de archivos multimedia.
- Validar solicitudes y ejecutar la importación en el proceso principal.
- Devolver resultados controlados sin aceptar rutas arbitrarias del renderer.
========================================================= */

import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
} from "electron";
import {
  IPC_CHANNELS,
  type IpcResult,
} from "../../shared/ipc-contracts.js";
import type { MediaImportResult } from "../../shared/media-import-contracts.js";
import {
  MediaImportConflictError,
  MediaImportService,
} from "../media/media-import-service.js";
import { SUPPORTED_MEDIA_EXTENSIONS } from "../media/media-file-inspector.js";
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
  parseRequestWithPayload,
} from "./ipc-validation.js";

interface RegisterMediaIpcOptions {
  readonly trustedSources: TrustedSourceOptions;
  readonly mediaImportService: MediaImportService;
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

  if (error instanceof MediaImportConflictError) {
    return createFailure(requestId, "CONFLICT", error.message);
  }

  console.error("Error procesando la importación multimedia:", error);

  return createFailure(
    requestId,
    "INTERNAL_ERROR",
    "No fue posible completar la importación multimedia.",
  );
}

async function chooseMediaFiles(
  event: IpcMainInvokeEvent,
): Promise<readonly string[] | null> {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const options = {
    title: "Importar archivos multimedia",
    buttonLabel: "Importar",
    properties: ["openFile", "multiSelections", "dontAddToRecent"] as const,
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
  const { trustedSources, mediaImportService } = options;

  ipcMain.removeHandler(IPC_CHANNELS.mediaChooseAndImport);

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
}

export {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  chooseMediaFiles,
  registerMediaIpc,
  type RegisterMediaIpcOptions,
};
