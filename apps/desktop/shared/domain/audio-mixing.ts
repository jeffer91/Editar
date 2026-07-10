/* =========================================================
Nombre completo: audio-mixing.ts
Ruta o ubicación: /apps/desktop/shared/domain/audio-mixing.ts

Función o funciones:
- Definir ganancia, paneo, mute, fundidos y normalización por clip.
- Validar que el recurso posea audio y que los fundidos sean coherentes.
- Guardar la mezcla como efecto no destructivo serializable.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  findOwnedEffect,
  removeClipEffectByType,
  upsertClipEffect,
} from "./effect-operations.js";
import { clampNumber, toMicroseconds, type EntityId, type Microseconds } from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";
import { requireClip, requireMedia } from "./timeline-operations.js";

const AUDIO_MIX_EFFECT_TYPE = "audio-mix";

interface AudioMixSettings {
  readonly gainDb: number;
  readonly pan: number;
  readonly muted: boolean;
  readonly fadeInUs: Microseconds;
  readonly fadeOutUs: Microseconds;
  readonly normalize: boolean;
  readonly normalizationTargetDb: number;
}

interface UpdateClipAudioMixInput {
  readonly clipId: EntityId<"clip">;
  readonly gainDb: number;
  readonly pan: number;
  readonly muted: boolean;
  readonly fadeInUs: number;
  readonly fadeOutUs: number;
  readonly normalize: boolean;
  readonly normalizationTargetDb: number;
}

const DEFAULT_AUDIO_MIX_SETTINGS: AudioMixSettings = Object.freeze({
  gainDb: 0,
  pan: 0,
  muted: false,
  fadeInUs: toMicroseconds(0, "fadeInUs"),
  fadeOutUs: toMicroseconds(0, "fadeOutUs"),
  normalize: false,
  normalizationTargetDb: -1,
});

function clipHasAudio(document: ProjectDocument, clipId: EntityId<"clip">): boolean {
  const clip = requireClip(document, clipId);

  if (clip.source.type !== "media") return false;
  const media = requireMedia(document, clip.source.mediaId);

  return (
    media.kind === "audio" ||
    (media.metadata?.kind === "video" && media.metadata.audio !== undefined)
  );
}

function validateAudioMixSettings(
  value: AudioMixSettings,
  clipDurationUs: number,
): AudioMixSettings {
  const gainDb = clampNumber(value.gainDb, -60, 12, "audioMix.gainDb");
  const pan = clampNumber(value.pan, -1, 1, "audioMix.pan");
  const normalizationTargetDb = clampNumber(
    value.normalizationTargetDb,
    -24,
    0,
    "audioMix.normalizationTargetDb",
  );
  const fadeInUs = toMicroseconds(value.fadeInUs, "audioMix.fadeInUs");
  const fadeOutUs = toMicroseconds(value.fadeOutUs, "audioMix.fadeOutUs");

  assertDomain(
    fadeInUs <= clipDurationUs && fadeOutUs <= clipDurationUs,
    "OUT_OF_RANGE",
    "audioMix.fade",
    "Los fundidos no pueden durar más que el clip.",
  );
  assertDomain(
    fadeInUs + fadeOutUs <= clipDurationUs,
    "OUT_OF_RANGE",
    "audioMix.fade",
    "La suma de entrada y salida no puede superar la duración del clip.",
  );

  return Object.freeze({
    gainDb,
    pan,
    muted: Boolean(value.muted),
    fadeInUs,
    fadeOutUs,
    normalize: Boolean(value.normalize),
    normalizationTargetDb,
  });
}

function readClipAudioMix(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
): AudioMixSettings {
  const clip = requireClip(document, clipId);
  const effect = findOwnedEffect(
    document,
    "clip",
    clip.id,
    AUDIO_MIX_EFFECT_TYPE,
  );

  if (!effect) return DEFAULT_AUDIO_MIX_SETTINGS;

  const parameters = effect.parameters;
  return validateAudioMixSettings(
    {
      gainDb:
        typeof parameters.gainDb === "number"
          ? parameters.gainDb
          : DEFAULT_AUDIO_MIX_SETTINGS.gainDb,
      pan:
        typeof parameters.pan === "number"
          ? parameters.pan
          : DEFAULT_AUDIO_MIX_SETTINGS.pan,
      muted:
        typeof parameters.muted === "boolean"
          ? parameters.muted
          : DEFAULT_AUDIO_MIX_SETTINGS.muted,
      fadeInUs:
        typeof parameters.fadeInUs === "number"
          ? toMicroseconds(parameters.fadeInUs, "fadeInUs")
          : DEFAULT_AUDIO_MIX_SETTINGS.fadeInUs,
      fadeOutUs:
        typeof parameters.fadeOutUs === "number"
          ? toMicroseconds(parameters.fadeOutUs, "fadeOutUs")
          : DEFAULT_AUDIO_MIX_SETTINGS.fadeOutUs,
      normalize:
        typeof parameters.normalize === "boolean"
          ? parameters.normalize
          : DEFAULT_AUDIO_MIX_SETTINGS.normalize,
      normalizationTargetDb:
        typeof parameters.normalizationTargetDb === "number"
          ? parameters.normalizationTargetDb
          : DEFAULT_AUDIO_MIX_SETTINGS.normalizationTargetDb,
    },
    clip.durationUs,
  );
}

function isDefaultAudioMix(value: AudioMixSettings): boolean {
  return (
    value.gainDb === DEFAULT_AUDIO_MIX_SETTINGS.gainDb &&
    value.pan === DEFAULT_AUDIO_MIX_SETTINGS.pan &&
    value.muted === DEFAULT_AUDIO_MIX_SETTINGS.muted &&
    value.fadeInUs === DEFAULT_AUDIO_MIX_SETTINGS.fadeInUs &&
    value.fadeOutUs === DEFAULT_AUDIO_MIX_SETTINGS.fadeOutUs &&
    value.normalize === DEFAULT_AUDIO_MIX_SETTINGS.normalize &&
    value.normalizationTargetDb ===
      DEFAULT_AUDIO_MIX_SETTINGS.normalizationTargetDb
  );
}

function updateClipAudioMix(
  document: ProjectDocument,
  input: UpdateClipAudioMixInput,
  now: Date | string = new Date(),
): ProjectDocument {
  const clip = requireClip(document, input.clipId);

  assertDomain(
    clipHasAudio(document, clip.id),
    "UNSUPPORTED_VALUE",
    "clipId",
    "El clip seleccionado no contiene audio.",
  );

  const settings = validateAudioMixSettings(
    {
      gainDb: input.gainDb,
      pan: input.pan,
      muted: input.muted,
      fadeInUs: toMicroseconds(input.fadeInUs, "fadeInUs"),
      fadeOutUs: toMicroseconds(input.fadeOutUs, "fadeOutUs"),
      normalize: input.normalize,
      normalizationTargetDb: input.normalizationTargetDb,
    },
    clip.durationUs,
  );

  if (isDefaultAudioMix(settings)) {
    return removeClipEffectByType(
      document,
      clip.id,
      AUDIO_MIX_EFFECT_TYPE,
      now,
    );
  }

  return upsertClipEffect(
    document,
    {
      clipId: clip.id,
      effectType: AUDIO_MIX_EFFECT_TYPE,
      order: 10,
      parameters: Object.freeze({
        gainDb: settings.gainDb,
        pan: settings.pan,
        muted: settings.muted,
        fadeInUs: settings.fadeInUs,
        fadeOutUs: settings.fadeOutUs,
        normalize: settings.normalize,
        normalizationTargetDb: settings.normalizationTargetDb,
      }),
    },
    now,
  );
}

export {
  AUDIO_MIX_EFFECT_TYPE,
  DEFAULT_AUDIO_MIX_SETTINGS,
  clipHasAudio,
  readClipAudioMix,
  updateClipAudioMix,
  validateAudioMixSettings,
  type AudioMixSettings,
  type UpdateClipAudioMixInput,
};
