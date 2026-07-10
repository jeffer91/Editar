/* =========================================================
Nombre completo: media-request-validation.ts
Ruta o ubicación: /apps/desktop/main/media/media-request-validation.ts

Función o funciones:
- Validar identificadores de proyecto y medio recibidos por IPC.
- Impedir que el renderer envíe rutas o comandos multimedia.
- Compartir validación entre análisis y generación de derivados.
========================================================= */

import {
  DomainValidationError,
  parseEntityId,
  type EntityId,
} from "../../shared/domain/index.js";
import type { GenerateMediaDerivativesInput } from "../../shared/media-cache-contracts.js";
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

function parseProjectMediaInput(value: unknown): GenerateMediaDerivativesInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos del recurso multimedia no son válidos.",
    );
  }

  return Object.freeze({
    projectId: parseTypedId(value.projectId, "project"),
    mediaId: parseTypedId(value.mediaId, "media"),
  });
}

function parseAnalyzeMediaInput(value: unknown): AnalyzeMediaInput {
  return parseProjectMediaInput(value);
}

function parseGenerateMediaDerivativesInput(
  value: unknown,
): GenerateMediaDerivativesInput {
  return parseProjectMediaInput(value);
}

export {
  parseAnalyzeMediaInput,
  parseGenerateMediaDerivativesInput,
  parseProjectMediaInput,
  parseTypedId,
};
