/* =========================================================
Nombre completo: timeline.ts
Ruta o ubicación: /apps/desktop/shared/domain/timeline.ts

Función o funciones:
- Definir secuencias, pistas y clips de la línea de tiempo.
- Validar posiciones, recortes, velocidades y relaciones.
- Calcular finales, duraciones y colisiones entre clips.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  addMicroseconds,
  clampNumber,
  createEntityId,
  normalizeName,
  toMicroseconds,
  type EntityId,
  type Microseconds,
} from "./primitives.js";

type TrackKind = "video" | "audio" | "text" | "overlay" | "adjustment";
type ClipKind = "media" | "text" | "generator" | "adjustment";

interface Sequence {
  readonly id: EntityId<"sequence">;
  readonly projectId: EntityId<"project">;
  readonly name: string;
  readonly trackIds: readonly EntityId<"track">[];
  readonly durationUs: Microseconds;
}

interface Track {
  readonly id: EntityId<"track">;
  readonly sequenceId: EntityId<"sequence">;
  readonly kind: TrackKind;
  readonly name: string;
  readonly order: number;
  readonly muted: boolean;
  readonly hidden: boolean;
  readonly locked: boolean;
  readonly clipIds: readonly EntityId<"clip">[];
}

interface MediaClipSource {
  readonly type: "media";
  readonly mediaId: EntityId<"media">;
  readonly sourceStartUs: Microseconds;
  readonly sourceDurationUs: Microseconds;
}

interface TextClipSource {
  readonly type: "text";
  readonly textLayerId: EntityId<"text-layer">;
}

interface GeneratorClipSource {
  readonly type: "generator";
  readonly generatorId: string;
}

interface AdjustmentClipSource {
  readonly type: "adjustment";
}

type ClipSource =
  | MediaClipSource
  | TextClipSource
  | GeneratorClipSource
  | AdjustmentClipSource;

interface ClipTransform {
  readonly positionX: number;
  readonly positionY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotationDegrees: number;
  readonly opacity: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

interface Clip {
  readonly id: EntityId<"clip">;
  readonly trackId: EntityId<"track">;
  readonly kind: ClipKind;
  readonly name: string;
  readonly timelineStartUs: Microseconds;
  readonly durationUs: Microseconds;
  readonly playbackRate: number;
  readonly enabled: boolean;
  readonly source: ClipSource;
  readonly transform: ClipTransform;
  readonly effectIds: readonly EntityId<"effect">[];
}

interface CreateSequenceInput {
  readonly id?: EntityId<"sequence">;
  readonly projectId: EntityId<"project">;
  readonly name?: string;
  readonly trackIds?: readonly EntityId<"track">[];
  readonly durationUs?: Microseconds;
}

interface CreateTrackInput {
  readonly id?: EntityId<"track">;
  readonly sequenceId: EntityId<"sequence">;
  readonly kind: TrackKind;
  readonly name?: string;
  readonly order: number;
  readonly muted?: boolean;
  readonly hidden?: boolean;
  readonly locked?: boolean;
  readonly clipIds?: readonly EntityId<"clip">[];
}

interface CreateBaseClipInput {
  readonly id?: EntityId<"clip">;
  readonly trackId: EntityId<"track">;
  readonly name: string;
  readonly timelineStartUs: Microseconds;
  readonly playbackRate?: number;
  readonly enabled?: boolean;
  readonly transform?: Partial<ClipTransform>;
  readonly effectIds?: readonly EntityId<"effect">[];
}

interface CreateMediaClipInput extends CreateBaseClipInput {
  readonly kind: "media";
  readonly mediaId: EntityId<"media">;
  readonly sourceStartUs?: Microseconds;
  readonly sourceDurationUs: Microseconds;
}

interface CreateTextClipInput extends CreateBaseClipInput {
  readonly kind: "text";
  readonly textLayerId: EntityId<"text-layer">;
  readonly durationUs: Microseconds;
}

interface CreateGeneratorClipInput extends CreateBaseClipInput {
  readonly kind: "generator";
  readonly generatorId: string;
  readonly durationUs: Microseconds;
}

interface CreateAdjustmentClipInput extends CreateBaseClipInput {
  readonly kind: "adjustment";
  readonly durationUs: Microseconds;
}

type CreateClipInput =
  | CreateMediaClipInput
  | CreateTextClipInput
  | CreateGeneratorClipInput
  | CreateAdjustmentClipInput;

const DEFAULT_CLIP_TRANSFORM: ClipTransform = Object.freeze({
  positionX: 0,
  positionY: 0,
  scaleX: 1,
  scaleY: 1,
  rotationDegrees: 0,
  opacity: 1,
  anchorX: 0.5,
  anchorY: 0.5,
});

function assertUniqueIds(
  ids: readonly string[],
  field: string,
): void {
  assertDomain(
    new Set(ids).size === ids.length,
    "DUPLICATE_VALUE",
    field,
    "La lista contiene identificadores duplicados.",
  );
}

function validateTransform(input: ClipTransform): ClipTransform {
  clampNumber(input.positionX, -1_000_000, 1_000_000, "transform.positionX");
  clampNumber(input.positionY, -1_000_000, 1_000_000, "transform.positionY");
  clampNumber(input.scaleX, 0.001, 1_000, "transform.scaleX");
  clampNumber(input.scaleY, 0.001, 1_000, "transform.scaleY");
  clampNumber(
    input.rotationDegrees,
    -1_000_000,
    1_000_000,
    "transform.rotationDegrees",
  );
  clampNumber(input.opacity, 0, 1, "transform.opacity");
  clampNumber(input.anchorX, 0, 1, "transform.anchorX");
  clampNumber(input.anchorY, 0, 1, "transform.anchorY");

  return Object.freeze({ ...input });
}

function createSequence(input: CreateSequenceInput): Sequence {
  const trackIds = Object.freeze([...(input.trackIds ?? [])]);
  assertUniqueIds(trackIds, "trackIds");

  return Object.freeze({
    id: input.id ?? createEntityId("sequence"),
    projectId: input.projectId,
    name: normalizeName(input.name ?? "Secuencia principal", "name", 120),
    trackIds,
    durationUs: toMicroseconds(input.durationUs ?? 0, "durationUs"),
  });
}

function createTrack(input: CreateTrackInput): Track {
  assertDomain(
    Number.isSafeInteger(input.order) && input.order >= 0,
    "OUT_OF_RANGE",
    "order",
    "El orden de la pista debe ser un entero mayor o igual a cero.",
  );

  const clipIds = Object.freeze([...(input.clipIds ?? [])]);
  assertUniqueIds(clipIds, "clipIds");

  const defaultName = `${input.kind.charAt(0).toUpperCase()}${input.kind.slice(1)} ${
    input.order + 1
  }`;

  return Object.freeze({
    id: input.id ?? createEntityId("track"),
    sequenceId: input.sequenceId,
    kind: input.kind,
    name: normalizeName(input.name ?? defaultName, "name", 120),
    order: input.order,
    muted: input.muted ?? false,
    hidden: input.hidden ?? false,
    locked: input.locked ?? false,
    clipIds,
  });
}

function calculateMediaClipDuration(
  sourceDurationUs: Microseconds,
  playbackRate: number,
): Microseconds {
  const duration = Math.round(sourceDurationUs / playbackRate);

  assertDomain(
    duration > 0,
    "OUT_OF_RANGE",
    "durationUs",
    "La duración calculada del clip debe ser mayor a cero.",
  );

  return toMicroseconds(duration, "durationUs");
}

function createClip(input: CreateClipInput): Clip {
  const timelineStartUs = toMicroseconds(
    input.timelineStartUs,
    "timelineStartUs",
  );
  const playbackRate = clampNumber(
    input.playbackRate ?? 1,
    0.01,
    100,
    "playbackRate",
  );
  const transform = validateTransform({
    ...DEFAULT_CLIP_TRANSFORM,
    ...input.transform,
  });
  const effectIds = Object.freeze([...(input.effectIds ?? [])]);
  assertUniqueIds(effectIds, "effectIds");

  let source: ClipSource;
  let durationUs: Microseconds;

  switch (input.kind) {
    case "media": {
      const sourceStartUs = toMicroseconds(
        input.sourceStartUs ?? 0,
        "sourceStartUs",
      );
      const sourceDurationUs = toMicroseconds(
        input.sourceDurationUs,
        "sourceDurationUs",
      );
      assertDomain(
        sourceDurationUs > 0,
        "OUT_OF_RANGE",
        "sourceDurationUs",
        "La duración de origen debe ser mayor a cero.",
      );

      source = Object.freeze({
        type: "media",
        mediaId: input.mediaId,
        sourceStartUs,
        sourceDurationUs,
      });
      durationUs = calculateMediaClipDuration(sourceDurationUs, playbackRate);
      break;
    }
    case "text":
      source = Object.freeze({
        type: "text",
        textLayerId: input.textLayerId,
      });
      durationUs = toMicroseconds(input.durationUs, "durationUs");
      break;
    case "generator":
      source = Object.freeze({
        type: "generator",
        generatorId: normalizeName(input.generatorId, "generatorId", 120),
      });
      durationUs = toMicroseconds(input.durationUs, "durationUs");
      break;
    case "adjustment":
      source = Object.freeze({ type: "adjustment" });
      durationUs = toMicroseconds(input.durationUs, "durationUs");
      break;
  }

  assertDomain(
    durationUs > 0,
    "OUT_OF_RANGE",
    "durationUs",
    "La duración del clip debe ser mayor a cero.",
  );

  return Object.freeze({
    id: input.id ?? createEntityId("clip"),
    trackId: input.trackId,
    kind: input.kind,
    name: normalizeName(input.name, "name", 160),
    timelineStartUs,
    durationUs,
    playbackRate,
    enabled: input.enabled ?? true,
    source,
    transform,
    effectIds,
  });
}

function getClipEndUs(clip: Clip): Microseconds {
  return addMicroseconds(clip.timelineStartUs, clip.durationUs, "clipEndUs");
}

function clipsOverlap(left: Clip, right: Clip): boolean {
  if (left.trackId !== right.trackId) {
    return false;
  }

  return (
    left.timelineStartUs < getClipEndUs(right) &&
    right.timelineStartUs < getClipEndUs(left)
  );
}

function calculateSequenceDuration(clips: readonly Clip[]): Microseconds {
  if (clips.length === 0) {
    return toMicroseconds(0, "sequenceDurationUs");
  }

  return toMicroseconds(
    Math.max(...clips.map((clip) => getClipEndUs(clip))),
    "sequenceDurationUs",
  );
}

function isTrackCompatibleWithClip(track: Track, clip: Clip): boolean {
  if (clip.trackId !== track.id) {
    return false;
  }

  const compatibility: Readonly<Record<TrackKind, readonly ClipKind[]>> = {
    video: ["media", "generator"],
    audio: ["media"],
    text: ["text"],
    overlay: ["media", "text", "generator"],
    adjustment: ["adjustment"],
  };

  return compatibility[track.kind].includes(clip.kind);
}

export {
  DEFAULT_CLIP_TRANSFORM,
  calculateMediaClipDuration,
  calculateSequenceDuration,
  clipsOverlap,
  createClip,
  createSequence,
  createTrack,
  getClipEndUs,
  isTrackCompatibleWithClip,
  validateTransform,
  type Clip,
  type ClipKind,
  type ClipSource,
  type ClipTransform,
  type CreateClipInput,
  type CreateSequenceInput,
  type CreateTrackInput,
  type MediaClipSource,
  type Sequence,
  type Track,
  type TrackKind,
};
