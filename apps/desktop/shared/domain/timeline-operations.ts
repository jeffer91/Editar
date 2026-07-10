/* =========================================================
Nombre completo: timeline-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/timeline-operations.ts

Función o funciones:
- Insertar, mover, recortar, dividir y eliminar clips.
- Actualizar estados de pistas y duración de secuencias.
- Aplicar edición no destructiva con validación de colisiones.
========================================================= */

import { assertDomain } from "./domain-error.js";
import { getMediaDuration, type MediaAsset } from "./media.js";
import {
  createEntityId,
  toIsoDateTime,
  toMicroseconds,
  type EntityId,
  type Microseconds,
} from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";
import {
  calculateSequenceDuration,
  clipsOverlap,
  createClip,
  getClipEndUs,
  isTrackCompatibleWithClip,
  type Clip,
  type Track,
} from "./timeline.js";
import { validateProjectDocument } from "./project-document.js";

interface AddMediaClipInput {
  readonly mediaId: EntityId<"media">;
  readonly trackId: EntityId<"track">;
  readonly timelineStartUs: number;
  readonly sourceStartUs?: number;
  readonly sourceDurationUs?: number;
  readonly imageDurationUs?: number;
}

interface MoveClipInput {
  readonly clipId: EntityId<"clip">;
  readonly trackId: EntityId<"track">;
  readonly timelineStartUs: number;
}

interface TrimClipInput {
  readonly clipId: EntityId<"clip">;
  readonly timelineStartUs: number;
  readonly durationUs: number;
  readonly sourceStartUs?: number;
}

interface SplitClipInput {
  readonly clipId: EntityId<"clip">;
  readonly splitAtUs: number;
}

interface UpdateTrackStateInput {
  readonly trackId: EntityId<"track">;
  readonly muted?: boolean;
  readonly hidden?: boolean;
  readonly locked?: boolean;
}

function requireTrack(
  document: ProjectDocument,
  trackId: EntityId<"track">,
): Track {
  const track = document.tracks.find((candidate) => candidate.id === trackId);

  assertDomain(
    track !== undefined,
    "INVALID_RELATION",
    "trackId",
    "La pista seleccionada no existe.",
  );

  return track;
}

function requireClip(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
): Clip {
  const clip = document.clips.find((candidate) => candidate.id === clipId);

  assertDomain(
    clip !== undefined,
    "INVALID_RELATION",
    "clipId",
    "El clip seleccionado no existe.",
  );

  return clip;
}

function requireMedia(
  document: ProjectDocument,
  mediaId: EntityId<"media">,
): MediaAsset {
  const media = document.media.find((candidate) => candidate.id === mediaId);

  assertDomain(
    media !== undefined,
    "INVALID_RELATION",
    "mediaId",
    "El recurso multimedia seleccionado no existe.",
  );

  return media;
}

function assertEditable(document: ProjectDocument): void {
  assertDomain(
    document.project.status !== "archived",
    "INVALID_RELATION",
    "project.status",
    "Restaura el proyecto antes de editar su línea de tiempo.",
  );
}

function assertTrackAcceptsMedia(track: Track, media: MediaAsset): void {
  const hasAudio =
    media.metadata?.kind === "audio" ||
    (media.metadata?.kind === "video" && media.metadata.audio !== undefined);
  const compatible =
    track.kind === "audio"
      ? hasAudio
      : track.kind === "video" || track.kind === "overlay"
        ? media.kind === "video" || media.kind === "image"
        : false;

  assertDomain(
    compatible,
    "UNSUPPORTED_VALUE",
    "trackId",
    "El recurso no es compatible con el tipo de pista seleccionado.",
  );
}

function assertNoCollision(
  document: ProjectDocument,
  candidate: Clip,
  ignoredClipId?: EntityId<"clip">,
): void {
  const track = requireTrack(document, candidate.trackId);

  if (track.kind !== "video" && track.kind !== "audio") {
    return;
  }

  const collision = document.clips.some(
    (current) =>
      current.id !== ignoredClipId &&
      current.id !== candidate.id &&
      clipsOverlap(current, candidate),
  );

  assertDomain(
    !collision,
    "INVALID_RELATION",
    "timelineStartUs",
    "El clip se superpone con otro clip de la misma pista.",
  );
}

function sortedClipIds(
  clips: readonly Clip[],
  trackId: EntityId<"track">,
): readonly EntityId<"clip">[] {
  return Object.freeze(
    clips
      .filter((clip) => clip.trackId === trackId)
      .sort((left, right) =>
        left.timelineStartUs === right.timelineStartUs
          ? left.id.localeCompare(right.id)
          : left.timelineStartUs - right.timelineStartUs,
      )
      .map((clip) => clip.id),
  );
}

function finalizeTimelineDocument(
  document: ProjectDocument,
  clips: readonly Clip[],
  tracks: readonly Track[] = document.tracks,
  textLayers = document.textLayers,
  now: Date | string = new Date(),
): ProjectDocument {
  const normalizedTracks = Object.freeze(
    tracks.map((track) =>
      Object.freeze({
        ...track,
        clipIds: sortedClipIds(clips, track.id),
      }),
    ),
  );
  const normalizedSequences = Object.freeze(
    document.sequences.map((sequence) => {
      const sequenceTrackIds = new Set(sequence.trackIds);
      const sequenceClips = clips.filter((clip) => {
        const track = normalizedTracks.find((item) => item.id === clip.trackId);
        return Boolean(track && sequenceTrackIds.has(track.id));
      });

      return Object.freeze({
        ...sequence,
        durationUs: calculateSequenceDuration(sequenceClips),
      });
    }),
  );
  const updated: ProjectDocument = Object.freeze({
    ...document,
    project: Object.freeze({
      ...document.project,
      updatedAt: toIsoDateTime(now, "project.updatedAt"),
    }),
    sequences: normalizedSequences,
    tracks: normalizedTracks,
    clips: Object.freeze([...clips]),
    textLayers: Object.freeze([...textLayers]),
  });

  return validateProjectDocument(updated);
}

function insertClipIntoDocument(
  document: ProjectDocument,
  clip: Clip,
  now: Date | string = new Date(),
): ProjectDocument {
  assertEditable(document);
  const track = requireTrack(document, clip.trackId);

  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );
  assertDomain(
    isTrackCompatibleWithClip(track, clip),
    "UNSUPPORTED_VALUE",
    "clip.kind",
    "El clip no es compatible con la pista seleccionada.",
  );
  assertNoCollision(document, clip);

  return finalizeTimelineDocument(document, [...document.clips, clip], document.tracks, document.textLayers, now);
}

function addMediaClip(
  document: ProjectDocument,
  input: AddMediaClipInput,
  now: Date | string = new Date(),
): ProjectDocument {
  assertEditable(document);
  const media = requireMedia(document, input.mediaId);
  const track = requireTrack(document, input.trackId);

  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );
  assertTrackAcceptsMedia(track, media);

  const sourceStartUs = toMicroseconds(input.sourceStartUs ?? 0, "sourceStartUs");
  const technicalDuration = getMediaDuration(media);
  const sourceDurationUs = toMicroseconds(
    input.sourceDurationUs ??
      technicalDuration ??
      input.imageDurationUs ??
      5_000_000,
    "sourceDurationUs",
  );

  if (technicalDuration !== null) {
    assertDomain(
      sourceStartUs + sourceDurationUs <= technicalDuration,
      "OUT_OF_RANGE",
      "sourceDurationUs",
      "El recorte supera la duración del recurso original.",
    );
  }

  const clip = createClip({
    kind: "media",
    trackId: track.id,
    name: media.fileName,
    timelineStartUs: toMicroseconds(input.timelineStartUs, "timelineStartUs"),
    mediaId: media.id,
    sourceStartUs,
    sourceDurationUs,
  });

  return insertClipIntoDocument(document, clip, now);
}

function moveClip(
  document: ProjectDocument,
  input: MoveClipInput,
  now: Date | string = new Date(),
): ProjectDocument {
  assertEditable(document);
  const current = requireClip(document, input.clipId);
  const sourceTrack = requireTrack(document, current.trackId);
  const targetTrack = requireTrack(document, input.trackId);

  assertDomain(
    !sourceTrack.locked && !targetTrack.locked,
    "INVALID_RELATION",
    "track.locked",
    "No se puede mover un clip desde o hacia una pista bloqueada.",
  );

  const moved: Clip = Object.freeze({
    ...current,
    trackId: targetTrack.id,
    timelineStartUs: toMicroseconds(input.timelineStartUs, "timelineStartUs"),
  });

  assertDomain(
    isTrackCompatibleWithClip(targetTrack, moved),
    "UNSUPPORTED_VALUE",
    "trackId",
    "El clip no es compatible con la pista de destino.",
  );
  assertNoCollision(document, moved, current.id);

  return finalizeTimelineDocument(
    document,
    document.clips.map((clip) => (clip.id === current.id ? moved : clip)),
    document.tracks,
    document.textLayers,
    now,
  );
}

function trimClip(
  document: ProjectDocument,
  input: TrimClipInput,
  now: Date | string = new Date(),
): ProjectDocument {
  assertEditable(document);
  const current = requireClip(document, input.clipId);
  const track = requireTrack(document, current.trackId);

  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );

  const timelineStartUs = toMicroseconds(input.timelineStartUs, "timelineStartUs");
  const durationUs = toMicroseconds(input.durationUs, "durationUs");

  assertDomain(
    durationUs >= 10_000,
    "OUT_OF_RANGE",
    "durationUs",
    "El clip debe durar al menos 10 milisegundos.",
  );

  let trimmed: Clip;

  if (current.source.type === "media") {
    const media = requireMedia(document, current.source.mediaId);
    const sourceStartUs = toMicroseconds(
      input.sourceStartUs ?? current.source.sourceStartUs,
      "sourceStartUs",
    );
    const sourceDurationUs = toMicroseconds(
      Math.round(durationUs * current.playbackRate),
      "sourceDurationUs",
    );
    const technicalDuration = getMediaDuration(media);

    if (technicalDuration !== null) {
      assertDomain(
        sourceStartUs + sourceDurationUs <= technicalDuration,
        "OUT_OF_RANGE",
        "sourceDurationUs",
        "El recorte supera la duración del recurso original.",
      );
    }

    trimmed = Object.freeze({
      ...current,
      timelineStartUs,
      durationUs,
      source: Object.freeze({
        ...current.source,
        sourceStartUs,
        sourceDurationUs,
      }),
    });
  } else {
    trimmed = Object.freeze({
      ...current,
      timelineStartUs,
      durationUs,
    });
  }

  assertNoCollision(document, trimmed, current.id);

  return finalizeTimelineDocument(
    document,
    document.clips.map((clip) => (clip.id === current.id ? trimmed : clip)),
    document.tracks,
    document.textLayers,
    now,
  );
}

function splitClip(
  document: ProjectDocument,
  input: SplitClipInput,
  now: Date | string = new Date(),
): ProjectDocument {
  assertEditable(document);
  const current = requireClip(document, input.clipId);
  const track = requireTrack(document, current.trackId);
  const splitAtUs = toMicroseconds(input.splitAtUs, "splitAtUs");
  const clipEndUs = getClipEndUs(current);

  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );
  assertDomain(
    splitAtUs >= current.timelineStartUs + 10_000 && splitAtUs <= clipEndUs - 10_000,
    "OUT_OF_RANGE",
    "splitAtUs",
    "El punto de división debe dejar al menos 10 ms en cada fragmento.",
  );

  const leftDurationUs = toMicroseconds(
    splitAtUs - current.timelineStartUs,
    "leftDurationUs",
  );
  const rightDurationUs = toMicroseconds(
    clipEndUs - splitAtUs,
    "rightDurationUs",
  );
  let left: Clip;
  let right: Clip;

  if (current.source.type === "media") {
    const leftSourceDurationUs = toMicroseconds(
      Math.round(leftDurationUs * current.playbackRate),
      "leftSourceDurationUs",
    );
    const rightSourceDurationUs = toMicroseconds(
      current.source.sourceDurationUs - leftSourceDurationUs,
      "rightSourceDurationUs",
    );

    left = Object.freeze({
      ...current,
      durationUs: leftDurationUs,
      source: Object.freeze({
        ...current.source,
        sourceDurationUs: leftSourceDurationUs,
      }),
    });
    right = Object.freeze({
      ...current,
      id: createEntityId("clip"),
      name: `${current.name} · 2`,
      timelineStartUs: splitAtUs,
      durationUs: rightDurationUs,
      source: Object.freeze({
        ...current.source,
        sourceStartUs: toMicroseconds(
          current.source.sourceStartUs + leftSourceDurationUs,
          "rightSourceStartUs",
        ),
        sourceDurationUs: rightSourceDurationUs,
      }),
      effectIds: Object.freeze([]),
    });
  } else {
    left = Object.freeze({ ...current, durationUs: leftDurationUs });
    right = Object.freeze({
      ...current,
      id: createEntityId("clip"),
      name: `${current.name} · 2`,
      timelineStartUs: splitAtUs,
      durationUs: rightDurationUs,
      effectIds: Object.freeze([]),
    });
  }

  const clips = document.clips.flatMap((clip) =>
    clip.id === current.id ? [left, right] : [clip],
  );

  return finalizeTimelineDocument(document, clips, document.tracks, document.textLayers, now);
}

function removeClip(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
  now: Date | string = new Date(),
): ProjectDocument {
  assertEditable(document);
  const current = requireClip(document, clipId);
  const track = requireTrack(document, current.trackId);

  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );

  const clips = document.clips.filter((clip) => clip.id !== current.id);
  const referencedTextIds = new Set(
    clips
      .filter((clip) => clip.source.type === "text")
      .map((clip) => (clip.source.type === "text" ? clip.source.textLayerId : "")),
  );
  const textLayers = document.textLayers.filter((layer) => referencedTextIds.has(layer.id));
  const effectIds = new Set(current.effectIds);
  const updated: ProjectDocument = Object.freeze({
    ...document,
    effects: Object.freeze(
      document.effects.filter(
        (effect) => effect.ownerId !== current.id && !effectIds.has(effect.id),
      ),
    ),
    transitions: Object.freeze(
      document.transitions.filter(
        (transition) =>
          transition.fromClipId !== current.id && transition.toClipId !== current.id,
      ),
    ),
  });

  return finalizeTimelineDocument(updated, clips, document.tracks, textLayers, now);
}

function updateTrackState(
  document: ProjectDocument,
  input: UpdateTrackStateInput,
  now: Date | string = new Date(),
): ProjectDocument {
  assertEditable(document);
  const current = requireTrack(document, input.trackId);
  const updatedTrack: Track = Object.freeze({
    ...current,
    muted: input.muted ?? current.muted,
    hidden: input.hidden ?? current.hidden,
    locked: input.locked ?? current.locked,
  });

  return finalizeTimelineDocument(
    document,
    document.clips,
    document.tracks.map((track) => (track.id === current.id ? updatedTrack : track)),
    document.textLayers,
    now,
  );
}

function appendPositionForTrack(
  document: ProjectDocument,
  trackId: EntityId<"track">,
): Microseconds {
  const clips = document.clips.filter((clip) => clip.trackId === trackId);

  return clips.length === 0
    ? toMicroseconds(0, "appendPositionUs")
    : toMicroseconds(
        Math.max(...clips.map((clip) => getClipEndUs(clip))),
        "appendPositionUs",
      );
}

export {
  addMediaClip,
  appendPositionForTrack,
  assertNoCollision,
  finalizeTimelineDocument,
  insertClipIntoDocument,
  moveClip,
  removeClip,
  requireClip,
  requireMedia,
  requireTrack,
  splitClip,
  trimClip,
  updateTrackState,
  type AddMediaClipInput,
  type MoveClipInput,
  type SplitClipInput,
  type TrimClipInput,
  type UpdateTrackStateInput,
};
