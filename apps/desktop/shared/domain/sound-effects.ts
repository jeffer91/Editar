/* =========================================================
Nombre completo: sound-effects.ts
Ruta o ubicación: /apps/desktop/shared/domain/sound-effects.ts

Función o funciones:
- Definir eventos temporales de efectos de sonido por secuencia.
- Crear, actualizar, listar y eliminar cues no destructivos.
- Validar ganancia, paneo, fundidos y duración.
========================================================= */

import { assertDomain } from "./domain-error.js";
import { createEffect } from "./effects.js";
import {
  clampNumber,
  toMicroseconds,
  type EntityId,
  type Microseconds,
} from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";
import { finalizeTimelineDocument } from "./timeline-operations.js";

const SOUND_EFFECT_TYPE = "sound-effect-cue";
const SOUND_EFFECT_PRESET_IDS = Object.freeze([
  "click",
  "whoosh",
  "pop",
  "impact",
  "notification",
  "camera",
  "applause",
] as const);

type SoundEffectPresetId = (typeof SOUND_EFFECT_PRESET_IDS)[number];

const SOUND_EFFECT_DEFAULT_DURATION_US: Readonly<
  Record<SoundEffectPresetId, Microseconds>
> = Object.freeze({
  click: toMicroseconds(180_000, "soundEffect.durationUs"),
  whoosh: toMicroseconds(900_000, "soundEffect.durationUs"),
  pop: toMicroseconds(260_000, "soundEffect.durationUs"),
  impact: toMicroseconds(1_100_000, "soundEffect.durationUs"),
  notification: toMicroseconds(650_000, "soundEffect.durationUs"),
  camera: toMicroseconds(350_000, "soundEffect.durationUs"),
  applause: toMicroseconds(3_000_000, "soundEffect.durationUs"),
});

interface SoundEffectCue {
  readonly id: EntityId<"effect">;
  readonly sequenceId: EntityId<"sequence">;
  readonly presetId: SoundEffectPresetId;
  readonly startOffsetUs: Microseconds;
  readonly durationUs: Microseconds;
  readonly gainDb: number;
  readonly pan: number;
  readonly fadeInUs: Microseconds;
  readonly fadeOutUs: Microseconds;
}

interface AddSoundEffectCueInput {
  readonly sequenceId: EntityId<"sequence">;
  readonly presetId: SoundEffectPresetId;
  readonly startOffsetUs: number;
  readonly durationUs?: number;
  readonly gainDb?: number;
  readonly pan?: number;
  readonly fadeInUs?: number;
  readonly fadeOutUs?: number;
}

interface UpdateSoundEffectCueInput extends AddSoundEffectCueInput {
  readonly effectId: EntityId<"effect">;
}

function requireSequence(
  document: ProjectDocument,
  sequenceId: EntityId<"sequence">,
): void {
  assertDomain(
    document.sequences.some((sequence) => sequence.id === sequenceId),
    "INVALID_RELATION",
    "sequenceId",
    "La secuencia seleccionada no existe.",
  );
  assertDomain(
    document.project.status !== "archived",
    "INVALID_RELATION",
    "project.status",
    "Restaura el proyecto antes de editar sus efectos de sonido.",
  );
}

function validateSoundEffectValues(input: AddSoundEffectCueInput): {
  readonly startOffsetUs: Microseconds;
  readonly durationUs: Microseconds;
  readonly gainDb: number;
  readonly pan: number;
  readonly fadeInUs: Microseconds;
  readonly fadeOutUs: Microseconds;
} {
  assertDomain(
    SOUND_EFFECT_PRESET_IDS.includes(input.presetId),
    "UNSUPPORTED_VALUE",
    "presetId",
    "El efecto de sonido no está permitido.",
  );

  const startOffsetUs = toMicroseconds(
    input.startOffsetUs,
    "soundEffect.startOffsetUs",
  );
  const durationUs = toMicroseconds(
    input.durationUs ?? SOUND_EFFECT_DEFAULT_DURATION_US[input.presetId],
    "soundEffect.durationUs",
  );
  const gainDb = clampNumber(
    input.gainDb ?? 0,
    -60,
    12,
    "soundEffect.gainDb",
  );
  const pan = clampNumber(input.pan ?? 0, -1, 1, "soundEffect.pan");
  const fadeInUs = toMicroseconds(
    input.fadeInUs ?? 0,
    "soundEffect.fadeInUs",
  );
  const fadeOutUs = toMicroseconds(
    input.fadeOutUs ?? 0,
    "soundEffect.fadeOutUs",
  );

  assertDomain(
    durationUs >= 50_000 && durationUs <= 30_000_000,
    "OUT_OF_RANGE",
    "durationUs",
    "El efecto de sonido debe durar entre 50 ms y 30 segundos.",
  );
  assertDomain(
    fadeInUs <= durationUs && fadeOutUs <= durationUs,
    "OUT_OF_RANGE",
    "fade",
    "Los fundidos no pueden durar más que el efecto de sonido.",
  );
  assertDomain(
    fadeInUs + fadeOutUs <= durationUs,
    "OUT_OF_RANGE",
    "fade",
    "La suma de los fundidos no puede superar la duración.",
  );

  return Object.freeze({
    startOffsetUs,
    durationUs,
    gainDb,
    pan,
    fadeInUs,
    fadeOutUs,
  });
}

function parseSoundEffectCue(
  document: ProjectDocument,
  effectId: EntityId<"effect">,
): SoundEffectCue {
  const effect = document.effects.find((candidate) => candidate.id === effectId);

  assertDomain(
    effect !== undefined &&
      effect.ownerType === "sequence" &&
      effect.effectType === SOUND_EFFECT_TYPE &&
      effect.durationUs !== undefined,
    "INVALID_RELATION",
    "effectId",
    "El efecto de sonido seleccionado no existe.",
  );

  const presetId = effect.parameters.presetId;
  assertDomain(
    typeof presetId === "string" &&
      SOUND_EFFECT_PRESET_IDS.includes(presetId as SoundEffectPresetId),
    "UNSUPPORTED_VALUE",
    "presetId",
    "El preset guardado no es válido.",
  );

  const values = validateSoundEffectValues({
    sequenceId: effect.ownerId as EntityId<"sequence">,
    presetId: presetId as SoundEffectPresetId,
    startOffsetUs: effect.startOffsetUs,
    durationUs: effect.durationUs,
    gainDb:
      typeof effect.parameters.gainDb === "number"
        ? effect.parameters.gainDb
        : 0,
    pan: typeof effect.parameters.pan === "number" ? effect.parameters.pan : 0,
    fadeInUs:
      typeof effect.parameters.fadeInUs === "number"
        ? effect.parameters.fadeInUs
        : 0,
    fadeOutUs:
      typeof effect.parameters.fadeOutUs === "number"
        ? effect.parameters.fadeOutUs
        : 0,
  });

  return Object.freeze({
    id: effect.id,
    sequenceId: effect.ownerId as EntityId<"sequence">,
    presetId: presetId as SoundEffectPresetId,
    ...values,
  });
}

function listSoundEffectCues(
  document: ProjectDocument,
  sequenceId: EntityId<"sequence"> = document.project.mainSequenceId,
): readonly SoundEffectCue[] {
  return Object.freeze(
    document.effects
      .filter(
        (effect) =>
          effect.ownerType === "sequence" &&
          effect.ownerId === sequenceId &&
          effect.effectType === SOUND_EFFECT_TYPE,
      )
      .map((effect) => parseSoundEffectCue(document, effect.id))
      .sort((left, right) =>
        left.startOffsetUs === right.startOffsetUs
          ? left.id.localeCompare(right.id)
          : left.startOffsetUs - right.startOffsetUs,
      ),
  );
}

function saveSoundEffectCue(
  document: ProjectDocument,
  input: AddSoundEffectCueInput,
  effectId: EntityId<"effect"> | undefined,
  now: Date | string,
): ProjectDocument {
  requireSequence(document, input.sequenceId);
  const values = validateSoundEffectValues(input);
  const current = effectId
    ? document.effects.find((effect) => effect.id === effectId)
    : undefined;

  if (effectId) {
    assertDomain(
      current !== undefined &&
        current.ownerType === "sequence" &&
        current.effectType === SOUND_EFFECT_TYPE,
      "INVALID_RELATION",
      "effectId",
      "El efecto de sonido seleccionado no existe.",
    );
  }

  const effect = createEffect({
    id: effectId,
    ownerType: "sequence",
    ownerId: input.sequenceId,
    effectType: SOUND_EFFECT_TYPE,
    version: current?.version ?? 1,
    enabled: true,
    order: current?.order ?? 40,
    startOffsetUs: values.startOffsetUs,
    durationUs: values.durationUs,
    parameters: Object.freeze({
      presetId: input.presetId,
      gainDb: values.gainDb,
      pan: values.pan,
      fadeInUs: values.fadeInUs,
      fadeOutUs: values.fadeOutUs,
    }),
  });
  const effects = current
    ? document.effects.map((candidate) =>
        candidate.id === current.id ? effect : candidate,
      )
    : [...document.effects, effect];
  const updated: ProjectDocument = Object.freeze({
    ...document,
    effects: Object.freeze(effects),
  });

  return finalizeTimelineDocument(
    updated,
    document.clips,
    document.tracks,
    document.textLayers,
    now,
  );
}

function addSoundEffectCue(
  document: ProjectDocument,
  input: AddSoundEffectCueInput,
  now: Date | string = new Date(),
): ProjectDocument {
  return saveSoundEffectCue(document, input, undefined, now);
}

function updateSoundEffectCue(
  document: ProjectDocument,
  input: UpdateSoundEffectCueInput,
  now: Date | string = new Date(),
): ProjectDocument {
  return saveSoundEffectCue(document, input, input.effectId, now);
}

function removeSoundEffectCue(
  document: ProjectDocument,
  effectId: EntityId<"effect">,
  now: Date | string = new Date(),
): ProjectDocument {
  const cue = parseSoundEffectCue(document, effectId);
  requireSequence(document, cue.sequenceId);
  const updated: ProjectDocument = Object.freeze({
    ...document,
    effects: Object.freeze(
      document.effects.filter((effect) => effect.id !== cue.id),
    ),
  });

  return finalizeTimelineDocument(
    updated,
    document.clips,
    document.tracks,
    document.textLayers,
    now,
  );
}

export {
  SOUND_EFFECT_DEFAULT_DURATION_US,
  SOUND_EFFECT_PRESET_IDS,
  SOUND_EFFECT_TYPE,
  addSoundEffectCue,
  listSoundEffectCues,
  parseSoundEffectCue,
  removeSoundEffectCue,
  updateSoundEffectCue,
  validateSoundEffectValues,
  type AddSoundEffectCueInput,
  type SoundEffectCue,
  type SoundEffectPresetId,
  type UpdateSoundEffectCueInput,
};
