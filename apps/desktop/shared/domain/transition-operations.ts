/* =========================================================
Nombre completo: transition-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/transition-operations.ts

Función o funciones:
- Crear, actualizar, consultar y eliminar transiciones entre clips.
- Validar continuidad, compatibilidad visual y duración.
- Mantener una sola transición por unión de clips.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  createTransition,
  type TransitionAlignment,
  type TransitionInstance,
} from "./effects.js";
import { toMicroseconds, type EntityId } from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";
import {
  finalizeTimelineDocument,
  requireClip,
  requireTrack,
} from "./timeline-operations.js";
import { getClipEndUs } from "./timeline.js";
import { isVisualClip } from "./video-effects.js";

const TRANSITION_PRESET_IDS = Object.freeze([
  "crossfade",
  "dip-black",
  "dip-white",
  "slide-left",
  "slide-right",
  "zoom",
  "blur",
] as const);

type TransitionPresetId = (typeof TRANSITION_PRESET_IDS)[number];

interface SetTransitionInput {
  readonly fromClipId: EntityId<"clip">;
  readonly toClipId: EntityId<"clip">;
  readonly presetId: TransitionPresetId;
  readonly durationUs: number;
  readonly alignment: TransitionAlignment;
}

function findTransitionBetween(
  document: ProjectDocument,
  fromClipId: EntityId<"clip">,
  toClipId: EntityId<"clip">,
): TransitionInstance | undefined {
  return document.transitions.find(
    (transition) =>
      transition.fromClipId === fromClipId &&
      transition.toClipId === toClipId,
  );
}

function assertTransitionPair(
  document: ProjectDocument,
  fromClipId: EntityId<"clip">,
  toClipId: EntityId<"clip">,
): void {
  const fromClip = requireClip(document, fromClipId);
  const toClip = requireClip(document, toClipId);
  const track = requireTrack(document, fromClip.trackId);

  assertDomain(
    document.project.status !== "archived",
    "INVALID_RELATION",
    "project.status",
    "Restaura el proyecto antes de editar sus transiciones.",
  );
  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );
  assertDomain(
    fromClip.trackId === toClip.trackId,
    "INVALID_RELATION",
    "toClipId",
    "Los clips de una transición deben estar en la misma pista.",
  );
  assertDomain(
    track.kind === "video" || track.kind === "overlay" || track.kind === "text",
    "UNSUPPORTED_VALUE",
    "track.kind",
    "Las transiciones solo se permiten en pistas visuales.",
  );
  assertDomain(
    isVisualClip(document, fromClip.id) && isVisualClip(document, toClip.id),
    "UNSUPPORTED_VALUE",
    "clipId",
    "Ambos clips deben contener una capa visual.",
  );
  assertDomain(
    getClipEndUs(fromClip) === toClip.timelineStartUs,
    "INVALID_RELATION",
    "timelineStartUs",
    "Los clips deben estar unidos sin espacio para aplicar una transición.",
  );
}

function setTransition(
  document: ProjectDocument,
  input: SetTransitionInput,
  now: Date | string = new Date(),
): ProjectDocument {
  assertTransitionPair(document, input.fromClipId, input.toClipId);
  const fromClip = requireClip(document, input.fromClipId);
  const toClip = requireClip(document, input.toClipId);
  const durationUs = toMicroseconds(input.durationUs, "transition.durationUs");

  assertDomain(
    TRANSITION_PRESET_IDS.includes(input.presetId),
    "UNSUPPORTED_VALUE",
    "presetId",
    "El preset de transición no está permitido.",
  );
  assertDomain(
    durationUs >= 10_000,
    "OUT_OF_RANGE",
    "durationUs",
    "La transición debe durar al menos 10 milisegundos.",
  );
  assertDomain(
    durationUs <= fromClip.durationUs && durationUs <= toClip.durationUs,
    "OUT_OF_RANGE",
    "durationUs",
    "La transición no puede durar más que los clips conectados.",
  );

  const current = findTransitionBetween(
    document,
    input.fromClipId,
    input.toClipId,
  );
  const transition = createTransition({
    id: current?.id,
    fromClipId: input.fromClipId,
    toClipId: input.toClipId,
    transitionType: input.presetId,
    version: current?.version ?? 1,
    durationUs,
    alignment: input.alignment,
    parameters: Object.freeze({ presetId: input.presetId }),
  });
  const transitions = current
    ? document.transitions.map((candidate) =>
        candidate.id === current.id ? transition : candidate,
      )
    : [...document.transitions, transition];
  const updated: ProjectDocument = Object.freeze({
    ...document,
    transitions: Object.freeze(transitions),
  });

  return finalizeTimelineDocument(
    updated,
    document.clips,
    document.tracks,
    document.textLayers,
    now,
  );
}

function removeTransition(
  document: ProjectDocument,
  transitionId: EntityId<"transition">,
  now: Date | string = new Date(),
): ProjectDocument {
  const transition = document.transitions.find(
    (candidate) => candidate.id === transitionId,
  );

  assertDomain(
    transition !== undefined,
    "INVALID_RELATION",
    "transitionId",
    "La transición seleccionada no existe.",
  );
  assertTransitionPair(
    document,
    transition.fromClipId,
    transition.toClipId,
  );

  const updated: ProjectDocument = Object.freeze({
    ...document,
    transitions: Object.freeze(
      document.transitions.filter((candidate) => candidate.id !== transition.id),
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
  TRANSITION_PRESET_IDS,
  assertTransitionPair,
  findTransitionBetween,
  removeTransition,
  setTransition,
  type SetTransitionInput,
  type TransitionPresetId,
};
