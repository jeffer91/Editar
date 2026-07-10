/* =========================================================
Nombre completo: clip-properties-request-validation.ts
Ruta o ubicación: /apps/desktop/main/timeline/clip-properties-request-validation.ts

Función o funciones:
- Validar mezcla de audio, transformaciones y presets visuales recibidos por IPC.
- Limitar valores antes de ejecutar operaciones del dominio.
- Rechazar propiedades incompatibles o formatos inseguros.
========================================================= */

import {
  ANIMATION_EASINGS,
  DomainValidationError,
  VIDEO_ANIMATION_PRESET_IDS,
  VIDEO_STYLE_PRESET_IDS,
  parseEntityId,
  type AnimationEasing,
  type EntityId,
  type VideoAnimationPresetId,
  type VideoStylePresetId,
} from "../../shared/domain/index.js";
import type {
  ClipTransformPatch,
  UpdateClipAudioMixRequest,
  UpdateClipVisualRequest,
} from "../../shared/timeline-editing-contracts.js";
import { IpcRequestError, isRecord } from "../ipc/ipc-validation.js";

function parseId<TEntity extends string>(
  value: unknown,
  type: TEntity,
  label: string,
): EntityId<TEntity> {
  if (typeof value !== "string") {
    throw new IpcRequestError("INVALID_REQUEST", `${label} no es válido.`);
  }

  try {
    return parseEntityId(value, type);
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new IpcRequestError("INVALID_REQUEST", error.message);
    }
    throw error;
  }
}

function requireRecord(
  value: unknown,
  message: string,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new IpcRequestError("INVALID_REQUEST", message);
  }
  return value;
}

function parseNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      `${label} debe estar entre ${minimum} y ${maximum}.`,
    );
  }

  return parsed;
}

function parseBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      `${label} debe ser verdadero o falso.`,
    );
  }
  return value;
}

function parseUpdateClipAudioMixRequest(
  value: unknown,
): UpdateClipAudioMixRequest {
  const input = requireRecord(
    value,
    "Los datos de mezcla de audio no son válidos.",
  );

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    clipId: parseId(input.clipId, "clip", "El clip"),
    gainDb: parseNumber(input.gainDb, "La ganancia", -60, 12),
    pan: parseNumber(input.pan, "El paneo", -1, 1),
    muted: parseBoolean(input.muted, "Silenciar"),
    fadeInMs: parseNumber(input.fadeInMs, "La entrada", 0, 86_400_000),
    fadeOutMs: parseNumber(input.fadeOutMs, "La salida", 0, 86_400_000),
    normalize: parseBoolean(input.normalize, "Normalizar"),
    normalizationTargetDb: parseNumber(
      input.normalizationTargetDb,
      "El objetivo de normalización",
      -24,
      0,
    ),
  });
}

function parseTransform(value: unknown): ClipTransformPatch {
  const input = requireRecord(
    value,
    "La transformación visual no es válida.",
  );

  return Object.freeze({
    positionX: parseNumber(input.positionX, "La posición X", -1_000_000, 1_000_000),
    positionY: parseNumber(input.positionY, "La posición Y", -1_000_000, 1_000_000),
    scaleX: parseNumber(input.scaleX, "La escala X", 0.001, 1_000),
    scaleY: parseNumber(input.scaleY, "La escala Y", 0.001, 1_000),
    rotationDegrees: parseNumber(
      input.rotationDegrees,
      "La rotación",
      -1_000_000,
      1_000_000,
    ),
    opacity: parseNumber(input.opacity, "La opacidad", 0, 1),
    anchorX: parseNumber(input.anchorX, "El anclaje X", 0, 1),
    anchorY: parseNumber(input.anchorY, "El anclaje Y", 0, 1),
  });
}

function parseStylePreset(value: unknown): VideoStylePresetId {
  if (
    typeof value !== "string" ||
    !VIDEO_STYLE_PRESET_IDS.includes(value as VideoStylePresetId)
  ) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El preset visual no está permitido.",
    );
  }
  return value as VideoStylePresetId;
}

function parseAnimationPreset(value: unknown): VideoAnimationPresetId {
  if (
    typeof value !== "string" ||
    !VIDEO_ANIMATION_PRESET_IDS.includes(value as VideoAnimationPresetId)
  ) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "La animación visual no está permitida.",
    );
  }
  return value as VideoAnimationPresetId;
}

function parseEasing(value: unknown): AnimationEasing {
  if (
    typeof value !== "string" ||
    !ANIMATION_EASINGS.includes(value as AnimationEasing)
  ) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "La curva de animación no está permitida.",
    );
  }
  return value as AnimationEasing;
}

function parseUpdateClipVisualRequest(
  value: unknown,
): UpdateClipVisualRequest {
  const input = requireRecord(
    value,
    "Los datos de efectos visuales no son válidos.",
  );

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    clipId: parseId(input.clipId, "clip", "El clip"),
    transform: parseTransform(input.transform),
    stylePresetId: parseStylePreset(input.stylePresetId),
    styleIntensity: parseNumber(
      input.styleIntensity,
      "La intensidad visual",
      0,
      1,
    ),
    animationPresetId: parseAnimationPreset(input.animationPresetId),
    animationDurationMs: parseNumber(
      input.animationDurationMs,
      "La duración de la animación",
      0,
      86_400_000,
    ),
    animationEasing: parseEasing(input.animationEasing),
  });
}

export {
  parseUpdateClipAudioMixRequest,
  parseUpdateClipVisualRequest,
};
