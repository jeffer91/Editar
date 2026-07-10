/* =========================================================
Nombre completo: effect-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/effect-operations.ts

Función o funciones:
- Buscar, crear, actualizar y eliminar efectos de clips y pistas.
- Mantener sincronizados effectIds y ProjectDocument.effects.
- Reutilizar validación, bloqueo y persistencia no destructiva.
========================================================= */

import { assertDomain } from "./domain-error.js";
import { createEffect, type EffectInstance } from "./effects.js";
import type { JsonValue } from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";
import {
  finalizeTimelineDocument,
  requireClip,
  requireTrack,
} from "./timeline-operations.js";
import type { EntityId } from "./primitives.js";

interface UpsertClipEffectInput {
  readonly clipId: EntityId<"clip">;
  readonly effectType: string;
  readonly parameters: Readonly<Record<string, JsonValue>>;
  readonly enabled?: boolean;
  readonly order?: number;
}

interface UpsertTrackEffectInput {
  readonly trackId: EntityId<"track">;
  readonly effectType: string;
  readonly parameters: Readonly<Record<string, JsonValue>>;
  readonly enabled?: boolean;
  readonly order?: number;
}

function findOwnedEffect(
  document: ProjectDocument,
  ownerType: "clip" | "track",
  ownerId: string,
  effectType: string,
): EffectInstance | undefined {
  return document.effects.find(
    (effect) =>
      effect.ownerType === ownerType &&
      effect.ownerId === ownerId &&
      effect.effectType === effectType,
  );
}

function upsertClipEffect(
  document: ProjectDocument,
  input: UpsertClipEffectInput,
  now: Date | string = new Date(),
): ProjectDocument {
  const clip = requireClip(document, input.clipId);
  const track = requireTrack(document, clip.trackId);

  assertDomain(
    document.project.status !== "archived",
    "INVALID_RELATION",
    "project.status",
    "Restaura el proyecto antes de editar sus efectos.",
  );
  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );

  const current = findOwnedEffect(
    document,
    "clip",
    clip.id,
    input.effectType,
  );
  const effect = createEffect({
    id: current?.id,
    ownerType: "clip",
    ownerId: clip.id,
    effectType: input.effectType,
    version: current?.version ?? 1,
    enabled: input.enabled ?? current?.enabled ?? true,
    order: input.order ?? current?.order ?? clip.effectIds.length,
    startOffsetUs: current?.startOffsetUs,
    durationUs: current?.durationUs,
    parameters: input.parameters,
  });
  const effects = current
    ? document.effects.map((candidate) =>
        candidate.id === current.id ? effect : candidate,
      )
    : [...document.effects, effect];
  const clips = document.clips.map((candidate) =>
    candidate.id === clip.id
      ? Object.freeze({
          ...candidate,
          effectIds: candidate.effectIds.includes(effect.id)
            ? candidate.effectIds
            : Object.freeze([...candidate.effectIds, effect.id]),
        })
      : candidate,
  );
  const updated: ProjectDocument = Object.freeze({
    ...document,
    effects: Object.freeze(effects),
  });

  return finalizeTimelineDocument(
    updated,
    clips,
    document.tracks,
    document.textLayers,
    now,
  );
}

function removeClipEffectByType(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
  effectType: string,
  now: Date | string = new Date(),
): ProjectDocument {
  const clip = requireClip(document, clipId);
  const track = requireTrack(document, clip.trackId);
  const current = findOwnedEffect(document, "clip", clip.id, effectType);

  assertDomain(
    document.project.status !== "archived",
    "INVALID_RELATION",
    "project.status",
    "Restaura el proyecto antes de editar sus efectos.",
  );
  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );

  if (!current) {
    return document;
  }

  const clips = document.clips.map((candidate) =>
    candidate.id === clip.id
      ? Object.freeze({
          ...candidate,
          effectIds: Object.freeze(
            candidate.effectIds.filter((effectId) => effectId !== current.id),
          ),
        })
      : candidate,
  );
  const updated: ProjectDocument = Object.freeze({
    ...document,
    effects: Object.freeze(
      document.effects.filter((effect) => effect.id !== current.id),
    ),
  });

  return finalizeTimelineDocument(
    updated,
    clips,
    document.tracks,
    document.textLayers,
    now,
  );
}

function upsertTrackEffect(
  document: ProjectDocument,
  input: UpsertTrackEffectInput,
  now: Date | string = new Date(),
): ProjectDocument {
  const track = requireTrack(document, input.trackId);

  assertDomain(
    document.project.status !== "archived",
    "INVALID_RELATION",
    "project.status",
    "Restaura el proyecto antes de editar sus efectos.",
  );
  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );

  const current = findOwnedEffect(
    document,
    "track",
    track.id,
    input.effectType,
  );
  const effect = createEffect({
    id: current?.id,
    ownerType: "track",
    ownerId: track.id,
    effectType: input.effectType,
    version: current?.version ?? 1,
    enabled: input.enabled ?? current?.enabled ?? true,
    order: input.order ?? current?.order ?? 0,
    startOffsetUs: current?.startOffsetUs,
    durationUs: current?.durationUs,
    parameters: input.parameters,
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

export {
  findOwnedEffect,
  removeClipEffectByType,
  upsertClipEffect,
  upsertTrackEffect,
  type UpsertClipEffectInput,
  type UpsertTrackEffectInput,
};
