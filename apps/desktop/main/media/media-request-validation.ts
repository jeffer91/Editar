/* =========================================================
Nombre completo: media-request-validation.ts
Ruta o ubicación: /apps/desktop/main/media/media-request-validation.ts

Función o funciones:
- Validar identificadores de proyecto y medio recibidos por IPC.
- Validar umbral, duración mínima y configuración de reducción.
- Impedir que el renderer envíe rutas o comandos multimedia.
========================================================= */

import type {
  AnalyzeAudioInput,
  ReduceSilenceInput,
} from "../../shared/audio-processing-contracts.js";
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

function parseNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const result = value === undefined ? fallback : Number(value);

  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      `${label} debe estar entre ${minimum} y ${maximum}.`,
    );
  }

  return result;
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

function parseAnalyzeAudioInput(value: unknown): Required<AnalyzeAudioInput> {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los parámetros del análisis acústico no son válidos.",
    );
  }

  return Object.freeze({
    projectId: parseTypedId(value.projectId, "project"),
    mediaId: parseTypedId(value.mediaId, "media"),
    thresholdDb: parseNumber(value.thresholdDb, -35, -96, -1, "El umbral"),
    minSilenceMs: parseNumber(
      value.minSilenceMs,
      500,
      10,
      30_000,
      "La duración mínima",
    ),
  });
}

function parseReduceSilenceInput(value: unknown): Required<ReduceSilenceInput> {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los parámetros de reducción de silencios no son válidos.",
    );
  }

  const mode = value.mode ?? "shorten";

  if (mode !== "remove" && mode !== "shorten") {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El modo debe ser eliminar o acortar silencios.",
    );
  }

  return Object.freeze({
    projectId: parseTypedId(value.projectId, "project"),
    mediaId: parseTypedId(value.mediaId, "media"),
    mode,
    targetSilenceMs: parseNumber(
      value.targetSilenceMs,
      300,
      mode === "shorten" ? 10 : 0,
      10_000,
      "El silencio conservado",
    ),
    edgePaddingMs: parseNumber(
      value.edgePaddingMs,
      80,
      0,
      2_000,
      "El margen de voz",
    ),
  });
}

export {
  parseAnalyzeAudioInput,
  parseAnalyzeMediaInput,
  parseGenerateMediaDerivativesInput,
  parseProjectMediaInput,
  parseReduceSilenceInput,
  parseTypedId,
};
