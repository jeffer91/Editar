/* =========================================================
Nombre completo: text-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/text-operations.ts

Función o funciones:
- Definir plantillas de títulos, subtítulos y rótulos.
- Insertar clips de texto animados en la línea de tiempo.
- Actualizar contenido, estilo y animaciones de capas existentes.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  createTextLayer,
  type TextAnimationReference,
  type TextLayer,
  type TextStyle,
} from "./text.js";
import {
  finalizeTimelineDocument,
  insertClipIntoDocument,
  requireClip,
  requireTrack,
} from "./timeline-operations.js";
import {
  createClip,
  type ClipTransform,
} from "./timeline.js";
import {
  toMicroseconds,
  type EntityId,
} from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";

type TextTemplateId = "title" | "subtitle" | "lower-third" | "caption";

interface TextTemplate {
  readonly id: TextTemplateId;
  readonly label: string;
  readonly defaultName: string;
  readonly defaultContent: string;
  readonly style: Partial<TextStyle>;
  readonly transform: Partial<ClipTransform>;
  readonly entranceAnimation?: TextAnimationReference;
  readonly exitAnimation?: TextAnimationReference;
}

interface AddTextClipInput {
  readonly trackId: EntityId<"track">;
  readonly templateId: TextTemplateId;
  readonly content: string;
  readonly timelineStartUs: number;
  readonly durationUs: number;
}

interface UpdateTextLayerInput {
  readonly clipId: EntityId<"clip">;
  readonly content: string;
  readonly style?: Partial<TextStyle>;
  readonly entranceAnimation?: TextAnimationReference | null;
  readonly exitAnimation?: TextAnimationReference | null;
}

const TEXT_TEMPLATES: Readonly<Record<TextTemplateId, TextTemplate>> = Object.freeze({
  title: Object.freeze({
    id: "title",
    label: "Título",
    defaultName: "Título principal",
    defaultContent: "Título principal",
    style: Object.freeze({
      fontSizePx: 76,
      fontWeight: 800,
      alignment: "center",
      verticalAlignment: "middle",
      maxWidthPx: 1500,
    }),
    transform: Object.freeze({ positionY: -40 }),
    entranceAnimation: Object.freeze({ presetId: "scale-in", durationMs: 450 }),
    exitAnimation: Object.freeze({ presetId: "fade", durationMs: 300 }),
  }),
  subtitle: Object.freeze({
    id: "subtitle",
    label: "Subtítulo",
    defaultName: "Subtítulo",
    defaultContent: "Escribe aquí el subtítulo",
    style: Object.freeze({
      fontSizePx: 42,
      fontWeight: 600,
      backgroundOpacity: 0.68,
      alignment: "center",
      verticalAlignment: "bottom",
      maxWidthPx: 1500,
    }),
    transform: Object.freeze({ positionY: 360 }),
    entranceAnimation: Object.freeze({ presetId: "fade", durationMs: 220 }),
    exitAnimation: Object.freeze({ presetId: "fade", durationMs: 220 }),
  }),
  "lower-third": Object.freeze({
    id: "lower-third",
    label: "Rótulo inferior",
    defaultName: "Rótulo inferior",
    defaultContent: "Nombre\nCargo o descripción",
    style: Object.freeze({
      fontSizePx: 44,
      fontWeight: 700,
      backgroundOpacity: 0.72,
      alignment: "left",
      verticalAlignment: "bottom",
      maxWidthPx: 900,
    }),
    transform: Object.freeze({ positionX: -420, positionY: 310 }),
    entranceAnimation: Object.freeze({ presetId: "slide-left", durationMs: 420 }),
    exitAnimation: Object.freeze({ presetId: "fade", durationMs: 250 }),
  }),
  caption: Object.freeze({
    id: "caption",
    label: "Texto flotante",
    defaultName: "Texto flotante",
    defaultContent: "Texto destacado",
    style: Object.freeze({
      fontSizePx: 52,
      fontWeight: 800,
      color: "#FFFFFF",
      backgroundColor: "#6C63FF",
      backgroundOpacity: 0.88,
      alignment: "center",
      verticalAlignment: "middle",
      maxWidthPx: 1000,
    }),
    transform: Object.freeze({ positionY: 180, rotationDegrees: -2 }),
    entranceAnimation: Object.freeze({ presetId: "slide-up", durationMs: 380 }),
    exitAnimation: Object.freeze({ presetId: "fade", durationMs: 240 }),
  }),
});

function requireTextLayerForClip(
  document: ProjectDocument,
  clipId: EntityId<"clip">,
): { readonly clip: ReturnType<typeof requireClip>; readonly layer: TextLayer } {
  const clip = requireClip(document, clipId);

  assertDomain(
    clip.source.type === "text",
    "UNSUPPORTED_VALUE",
    "clipId",
    "El clip seleccionado no es una capa de texto.",
  );

  const layer = document.textLayers.find(
    (candidate) => candidate.id === clip.source.textLayerId,
  );

  assertDomain(
    layer !== undefined,
    "INVALID_RELATION",
    "textLayerId",
    "La capa de texto asociada no existe.",
  );

  return Object.freeze({ clip, layer });
}

function addTextClip(
  document: ProjectDocument,
  input: AddTextClipInput,
  now: Date | string = new Date(),
): ProjectDocument {
  const track = requireTrack(document, input.trackId);

  assertDomain(
    track.kind === "text" || track.kind === "overlay",
    "UNSUPPORTED_VALUE",
    "trackId",
    "Los textos solo pueden insertarse en pistas de texto o superposición.",
  );
  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );

  const template = TEXT_TEMPLATES[input.templateId];
  const layer = createTextLayer({
    projectId: document.project.id,
    name: template.defaultName,
    content: input.content || template.defaultContent,
    style: template.style,
    entranceAnimation: template.entranceAnimation,
    exitAnimation: template.exitAnimation,
  });
  const clip = createClip({
    kind: "text",
    trackId: track.id,
    name: template.defaultName,
    timelineStartUs: toMicroseconds(input.timelineStartUs, "timelineStartUs"),
    durationUs: toMicroseconds(input.durationUs, "durationUs"),
    textLayerId: layer.id,
    transform: template.transform,
  });
  const withLayer: ProjectDocument = Object.freeze({
    ...document,
    textLayers: Object.freeze([...document.textLayers, layer]),
  });

  return insertClipIntoDocument(withLayer, clip, now);
}

function updateTextLayerForClip(
  document: ProjectDocument,
  input: UpdateTextLayerInput,
  now: Date | string = new Date(),
): ProjectDocument {
  const { clip, layer } = requireTextLayerForClip(document, input.clipId);
  const track = requireTrack(document, clip.trackId);

  assertDomain(
    !track.locked,
    "INVALID_RELATION",
    "track.locked",
    "La pista está bloqueada.",
  );

  const updated = createTextLayer({
    id: layer.id,
    projectId: layer.projectId,
    name: layer.name,
    content: input.content,
    style: {
      ...layer.style,
      ...input.style,
    },
    entranceAnimation:
      input.entranceAnimation === null
        ? undefined
        : input.entranceAnimation ?? layer.entranceAnimation,
    exitAnimation:
      input.exitAnimation === null
        ? undefined
        : input.exitAnimation ?? layer.exitAnimation,
  });

  return finalizeTimelineDocument(
    document,
    document.clips,
    document.tracks,
    document.textLayers.map((candidate) =>
      candidate.id === layer.id ? updated : candidate,
    ),
    now,
  );
}

export {
  TEXT_TEMPLATES,
  addTextClip,
  requireTextLayerForClip,
  updateTextLayerForClip,
  type AddTextClipInput,
  type TextTemplate,
  type TextTemplateId,
  type UpdateTextLayerInput,
};
