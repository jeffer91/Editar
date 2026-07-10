/* =========================================================
Nombre completo: transition-sound-request-validation.ts
Ruta o ubicación: /apps/desktop/main/timeline/transition-sound-request-validation.ts

Función o funciones:
- Validar solicitudes IPC de transiciones y efectos de sonido.
- Restringir identificadores, presets, tiempos y parámetros de mezcla.
- Rechazar payloads parciales o valores fuera de rango.
========================================================= */

import {
  SOUND_EFFECT_PRESET_IDS,
  TRANSITION_PRESET_IDS,
  DomainValidationError,
  parseEntityId,
  type EntityId,
  type SoundEffectPresetId,
  type TransitionAlignment,
  type TransitionPresetId,
} from "../../shared/domain/index.js";
import type {
  AddSoundEffectRequest,
  DeleteSoundEffectRequest,
  RemoveTransitionRequest,
  SetTransitionRequest,
  SoundEffectValuesRequest,
  UpdateSoundEffectRequest,
} from "../../shared/timeline-editing-contracts.js";
import { IpcRequestError, isRecord } from "../ipc/ipc-validation.js";

function requireRecord(
  value: unknown,
  message: string,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new IpcRequestError("INVALID_REQUEST", message);
  }
  return value;
}

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

function parseTransitionPreset(value: unknown): TransitionPresetId {
  if (
    typeof value !== "string" ||
    !TRANSITION_PRESET_IDS.includes(value as TransitionPresetId)
  ) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El preset de transición no está permitido.",
    );
  }
  return value as TransitionPresetId;
}

function parseAlignment(value: unknown): TransitionAlignment {
  if (value !== "start" && value !== "center" && value !== "end") {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "La alineación de la transición no es válida.",
    );
  }
  return value;
}

function parseSetTransitionRequest(value: unknown): SetTransitionRequest {
  const input = requireRecord(value, "Los datos de transición no son válidos.");
  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    fromClipId: parseId(input.fromClipId, "clip", "El clip de origen"),
    toClipId: parseId(input.toClipId, "clip", "El clip de destino"),
    presetId: parseTransitionPreset(input.presetId),
    durationMs: parseNumber(input.durationMs, "La duración", 10, 60_000),
    alignment: parseAlignment(input.alignment),
  });
}

function parseRemoveTransitionRequest(value: unknown): RemoveTransitionRequest {
  const input = requireRecord(
    value,
    "Los datos para eliminar la transición no son válidos.",
  );
  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    transitionId: parseId(
      input.transitionId,
      "transition",
      "La transición",
    ),
  });
}

function parseSoundPreset(value: unknown): SoundEffectPresetId {
  if (
    typeof value !== "string" ||
    !SOUND_EFFECT_PRESET_IDS.includes(value as SoundEffectPresetId)
  ) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El efecto de sonido no está permitido.",
    );
  }
  return value as SoundEffectPresetId;
}

function parseSoundValues(
  input: Readonly<Record<string, unknown>>,
): SoundEffectValuesRequest {
  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    sequenceId: parseId(input.sequenceId, "sequence", "La secuencia"),
    presetId: parseSoundPreset(input.presetId),
    startMs: parseNumber(input.startMs, "El inicio", 0, 86_400_000),
    durationMs: parseNumber(input.durationMs, "La duración", 50, 30_000),
    gainDb: parseNumber(input.gainDb, "La ganancia", -60, 12),
    pan: parseNumber(input.pan, "El paneo", -1, 1),
    fadeInMs: parseNumber(input.fadeInMs, "La entrada", 0, 30_000),
    fadeOutMs: parseNumber(input.fadeOutMs, "La salida", 0, 30_000),
  });
}

function parseAddSoundEffectRequest(value: unknown): AddSoundEffectRequest {
  return parseSoundValues(
    requireRecord(value, "Los datos del efecto de sonido no son válidos."),
  );
}

function parseUpdateSoundEffectRequest(
  value: unknown,
): UpdateSoundEffectRequest {
  const input = requireRecord(
    value,
    "Los datos del efecto de sonido no son válidos.",
  );
  return Object.freeze({
    ...parseSoundValues(input),
    effectId: parseId(input.effectId, "effect", "El efecto de sonido"),
  });
}

function parseDeleteSoundEffectRequest(
  value: unknown,
): DeleteSoundEffectRequest {
  const input = requireRecord(
    value,
    "Los datos para eliminar el efecto no son válidos.",
  );
  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    effectId: parseId(input.effectId, "effect", "El efecto de sonido"),
  });
}

export {
  parseAddSoundEffectRequest,
  parseDeleteSoundEffectRequest,
  parseRemoveTransitionRequest,
  parseSetTransitionRequest,
  parseUpdateSoundEffectRequest,
};
