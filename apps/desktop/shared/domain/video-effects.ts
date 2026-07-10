/* =========================================================
Nombre completo: video-effects.ts
Ruta o ubicación: /apps/desktop/shared/domain/video-effects.ts

Función o funciones:
- Definir presets visuales, transformaciones y animaciones de clips.
- Validar intensidad, duración, easing y compatibilidad visual.
- Guardar estilos y movimiento como efectos no destructivos.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  findOwnedEffect,
  removeClipEffectByType,
  upsertClipEffect,
} from "./effect-operations.js";
import {
  clampNumber,
  toMicroseconds,
  type EntityId,
  type Microseconds,
} from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";
import {
  finalizeTimelineDocument,
  requireClip,
  requireTrack,
} from "./timeline-operations.js";
import { validateTransform, type ClipTransform } from "./timeline.js";

const VIDEO_STYLE_EFFECT_TYPE = "video-style";
const VIDEO_ANIMATION_EFFECT_TYPE = "video-animation";

type VideoStylePresetId =
  | "none"
  | "cinematic"
  | "monochrome"
  | "warm"
  | "cool"
  | "vivid"
  | "soft-blur"
  | "sharpen"
  | "vignette";

type VideoAnimationPresetId =
  | "none"
  | "fade-in"
  | "fade-out"
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right";

type AnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

interface ClipVisualSettings {
  readonly transform: ClipTransform;
  readonly stylePresetId: VideoStylePresetId;
  readonly styleIntensity: number;
  readonly animationPresetId: VideoAnimationPresetId;
  readonly animationDurationUs: Microseconds;
  readonly animationEasing: AnimationEasing;
}

interface UpdateClipVisualInput {
  readonly clipId: EntityId<"clip">;
  readonly transform: Partial<ClipTransform>;
  readonly stylePresetId: VideoStylePresetId;
  readonly styleIntensity: number;
  readonly animationPresetId: VideoAnimationPresetId;
  readonly animationDurationUs: number;
  readonly animationEasing: AnimationEasing;
}

const VIDEO_STYLE_PRESET_IDS: readonly VideoStylePresetId[] = Object.freeze([
  "none",
  "cinematic",
  "monochrome",
  "warm",
  "cool",
  "vivid",
  "soft-blur",
  "sharpen",
  "vignette",
]);

const VIDEO_ANIMATION_PRESET_IDS: readonly VideoAnimationPresetId[] =
  Object.freeze([
    "none",
    "fade-in",
    "fade-out",
    "zoom-in",
    "zoom-out",
    "pan-left",
    "pan-right",
  ]);

const ANIMATION_EASINGS: readonly AnimationEasing[] = Object.freeze([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
]);

function isVisualClip(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
): boolean {
  const clip = requireClip(document, clipId);

  if (
    clip.kind === "text" ||
    clip.kind === "generator" ||
    clip.kind === "adjustment"
  ) {
    return true;
  }

  if (clip.source.type !== "media") return false;
  const mediaId = clip.source.mediaId;
  const media = document.media.find((candidate) => candidate.id === mediaId);
  return media?.kind === "video" || media?.kind === "image";
}

function readStylePreset(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
): { readonly presetId: VideoStylePresetId; readonly intensity: number } {
  const effect = findOwnedEffect(
    document,
    "clip",
    clipId,
    VIDEO_STYLE_EFFECT_TYPE,
  );
  if (!effect) return Object.freeze({ presetId: "none", intensity: 1 });

  const presetId =
    typeof effect.parameters.presetId === "string" &&
    VIDEO_STYLE_PRESET_IDS.includes(
      effect.parameters.presetId as VideoStylePresetId,
    )
      ? (effect.parameters.presetId as VideoStylePresetId)
      : "none";
  const intensity =
    typeof effect.parameters.intensity === "number"
      ? clampNumber(effect.parameters.intensity, 0, 1, "styleIntensity")
      : 1;

  return Object.freeze({ presetId, intensity });
}

function readAnimationPreset(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
  clipDurationUs: number,
): {
  readonly presetId: VideoAnimationPresetId;
  readonly durationUs: Microseconds;
  readonly easing: AnimationEasing;
} {
  const effect = findOwnedEffect(
    document,
    "clip",
    clipId,
    VIDEO_ANIMATION_EFFECT_TYPE,
  );
  if (!effect) {
    return Object.freeze({
      presetId: "none",
      durationUs: toMicroseconds(0, "animationDurationUs"),
      easing: "ease-in-out",
    });
  }

  const presetId =
    typeof effect.parameters.presetId === "string" &&
    VIDEO_ANIMATION_PRESET_IDS.includes(
      effect.parameters.presetId as VideoAnimationPresetId,
    )
      ? (effect.parameters.presetId as VideoAnimationPresetId)
      : "none";
  const rawDuration =
    typeof effect.parameters.durationUs === "number"
      ? effect.parameters.durationUs
      : 0;
  const durationUs = toMicroseconds(
    Math.min(Math.max(Math.round(rawDuration), 0), clipDurationUs),
    "animationDurationUs",
  );
  const easing =
    typeof effect.parameters.easing === "string" &&
    ANIMATION_EASINGS.includes(effect.parameters.easing as AnimationEasing)
      ? (effect.parameters.easing as AnimationEasing)
      : "ease-in-out";

  return Object.freeze({ presetId, durationUs, easing });
}

function readClipVisualSettings(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
): ClipVisualSettings {
  const clip = requireClip(document, clipId);
  const style = readStylePreset(document, clip.id);
  const animation = readAnimationPreset(document, clip.id, clip.durationUs);

  return Object.freeze({
    transform: clip.transform,
    stylePresetId: style.presetId,
    styleIntensity: style.intensity,
    animationPresetId: animation.presetId,
    animationDurationUs: animation.durationUs,
    animationEasing: animation.easing,
  });
}

function updateClipTransform(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
  transform: Partial<ClipTransform>,
  now: Date | string = new Date(),
): ProjectDocument {
  const clip = requireClip(document, clipId);
  const track = requireTrack(document, clip.trackId);

  assertDomain(
    document.project.status !== "archived",
    "INVALID_RELATION",
    "project.status",
    "Restaura el proyecto antes de editar el clip.",
  );
  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );
  assertDomain(
    isVisualClip(document, clip.id),
    "UNSUPPORTED_VALUE",
    "clipId",
    "El clip seleccionado no contiene una capa visual.",
  );

  const updatedTransform = validateTransform({
    ...clip.transform,
    ...transform,
  });
  const clips = document.clips.map((candidate) =>
    candidate.id === clip.id
      ? Object.freeze({ ...candidate, transform: updatedTransform })
      : candidate,
  );

  return finalizeTimelineDocument(
    document,
    clips,
    document.tracks,
    document.textLayers,
    now,
  );
}

function updateClipVisualProperties(
  document: ProjectDocument,
  input: UpdateClipVisualInput,
  now: Date | string = new Date(),
): ProjectDocument {
  const clip = requireClip(document, input.clipId);

  assertDomain(
    isVisualClip(document, clip.id),
    "UNSUPPORTED_VALUE",
    "clipId",
    "El clip seleccionado no contiene una capa visual.",
  );
  assertDomain(
    VIDEO_STYLE_PRESET_IDS.includes(input.stylePresetId),
    "UNSUPPORTED_VALUE",
    "stylePresetId",
    "El preset visual no está permitido.",
  );
  assertDomain(
    VIDEO_ANIMATION_PRESET_IDS.includes(input.animationPresetId),
    "UNSUPPORTED_VALUE",
    "animationPresetId",
    "La animación visual no está permitida.",
  );
  assertDomain(
    ANIMATION_EASINGS.includes(input.animationEasing),
    "UNSUPPORTED_VALUE",
    "animationEasing",
    "La curva de animación no está permitida.",
  );

  const styleIntensity = clampNumber(
    input.styleIntensity,
    0,
    1,
    "styleIntensity",
  );
  const animationDurationUs = toMicroseconds(
    input.animationDurationUs,
    "animationDurationUs",
  );

  if (input.animationPresetId !== "none") {
    assertDomain(
      animationDurationUs >= 10_000 && animationDurationUs <= clip.durationUs,
      "OUT_OF_RANGE",
      "animationDurationUs",
      "La animación debe durar entre 10 ms y la duración total del clip.",
    );
  }

  let updated = updateClipTransform(document, clip.id, input.transform, now);

  updated =
    input.stylePresetId === "none"
      ? removeClipEffectByType(updated, clip.id, VIDEO_STYLE_EFFECT_TYPE, now)
      : upsertClipEffect(
          updated,
          {
            clipId: clip.id,
            effectType: VIDEO_STYLE_EFFECT_TYPE,
            order: 20,
            parameters: Object.freeze({
              presetId: input.stylePresetId,
              intensity: styleIntensity,
            }),
          },
          now,
        );

  updated =
    input.animationPresetId === "none"
      ? removeClipEffectByType(
          updated,
          clip.id,
          VIDEO_ANIMATION_EFFECT_TYPE,
          now,
        )
      : upsertClipEffect(
          updated,
          {
            clipId: clip.id,
            effectType: VIDEO_ANIMATION_EFFECT_TYPE,
            order: 30,
            parameters: Object.freeze({
              presetId: input.animationPresetId,
              durationUs: animationDurationUs,
              easing: input.animationEasing,
            }),
          },
          now,
        );

  return updated;
}

export {
  ANIMATION_EASINGS,
  VIDEO_ANIMATION_EFFECT_TYPE,
  VIDEO_ANIMATION_PRESET_IDS,
  VIDEO_STYLE_EFFECT_TYPE,
  VIDEO_STYLE_PRESET_IDS,
  isVisualClip,
  readClipVisualSettings,
  updateClipTransform,
  updateClipVisualProperties,
  type AnimationEasing,
  type ClipVisualSettings,
  type UpdateClipVisualInput,
  type VideoAnimationPresetId,
  type VideoStylePresetId,
};
