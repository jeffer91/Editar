/* =========================================================
Nombre completo: media-request-validation.ts
Ruta o ubicación: /apps/desktop/main/media/media-request-validation.ts

Función o funciones:
- Validar identificadores de proyecto y medio recibidos por IPC.
- Impedir que el renderer envíe rutas o comandos de FFprobe.
- Convertir errores del dominio a solicitudes controladas.
========================================================= */

import {
  DomainValidationError,
  parseEntityId,
  type EntityId,
} from "../../shared/domain/index.js";
import type { AnalyzeMediaInput } from "../../shared/media-engine-contracts.js";
import { IpcRequestError, isRecord } from "../ipc/ipc-validation.js";

function parseTypedId<TKind extends "project" | "media">(
  value: unknown,
  kind: TKind,
): EntityId<TKind> {
  if (typeof value !== "string") {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      `El identificador de ${kind === "project" ? "proyecto" : "medio"} no es válido.`,
    );
  }

  try {
    return parseEntityId(value, kind);
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new IpcRequestError("INVALID_REQUEST", error.message);
    }

    throw error;
  }
}

function parseAnalyzeMediaInput(value: unknown): AnalyzeMediaInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos para analizar el recurso no son válidos.",
    );
  }

  return Object.freeze({
    projectId: parseTypedId(value.projectId, "project"),
    mediaId: parseTypedId(value.mediaId, "media"),
  });
}

export { parseAnalyzeMediaInput, parseTypedId };
