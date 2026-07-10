/* =========================================================
Nombre completo: timeline-request-validation.ts
Ruta o ubicación: /apps/desktop/main/timeline/timeline-request-validation.ts

Función o funciones:
- Validar IDs, tiempos, estilos y presets recibidos por IPC.
- Limitar valores numéricos antes de llegar al dominio.
- Rechazar propiedades desconocidas o inseguras.
========================================================= */

import {
  DomainValidationError,
  TEXT_ANIMATION_PRESET_IDS,
  TEXT_TEMPLATES,
  parseEntityId,
  type EntityId,
  type TextAnimationPresetId,
  type TextStyle,
  type TextTemplateId,
} from "../../shared/domain/index.js";
import type {
  AddMediaClipRequest,
  AddTextClipRequest,
  DeleteClipRequest,
  MoveClipRequest,
  SplitClipRequest,
  TextStylePatch,
  TrimClipRequest,
  UpdateTextClipRequest,
  UpdateTrackStateRequest,
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

function parseNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  optional = false,
): number | undefined {
  if (value === undefined && optional) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      `${label} debe estar entre ${minimum} y ${maximum}.`,
    );
  }

  return parsed;
}

function requireRecord(value: unknown, message: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new IpcRequestError("INVALID_REQUEST", message);
  }

  return value;
}

function parseAddMediaClipRequest(value: unknown): AddMediaClipRequest {
  const input = requireRecord(value, "Los datos para añadir el medio no son válidos.");

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    mediaId: parseId(input.mediaId, "media", "El medio"),
    trackId:
      input.trackId === undefined
        ? undefined
        : parseId(input.trackId, "track", "La pista"),
    timelineStartMs: parseNumber(
      input.timelineStartMs,
      "La posición",
      0,
      86_400_000,
      true,
    ),
    sourceStartMs: parseNumber(
      input.sourceStartMs,
      "El punto de entrada",
      0,
      86_400_000,
      true,
    ),
    sourceDurationMs: parseNumber(
      input.sourceDurationMs,
      "La duración de origen",
      10,
      86_400_000,
      true,
    ),
    imageDurationMs: parseNumber(
      input.imageDurationMs,
      "La duración de la imagen",
      100,
      3_600_000,
      true,
    ),
  });
}

function parseMoveClipRequest(value: unknown): MoveClipRequest {
  const input = requireRecord(value, "Los datos para mover el clip no son válidos.");

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    clipId: parseId(input.clipId, "clip", "El clip"),
    trackId: parseId(input.trackId, "track", "La pista"),
    timelineStartMs: parseNumber(
      input.timelineStartMs,
      "La posición",
      0,
      86_400_000,
    )!,
  });
}

function parseTrimClipRequest(value: unknown): TrimClipRequest {
  const input = requireRecord(value, "Los datos para recortar el clip no son válidos.");

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    clipId: parseId(input.clipId, "clip", "El clip"),
    timelineStartMs: parseNumber(
      input.timelineStartMs,
      "La posición",
      0,
      86_400_000,
    )!,
    durationMs: parseNumber(input.durationMs, "La duración", 10, 86_400_000)!,
    sourceStartMs: parseNumber(
      input.sourceStartMs,
      "El punto de entrada",
      0,
      86_400_000,
      true,
    ),
  });
}

function parseSplitClipRequest(value: unknown): SplitClipRequest {
  const input = requireRecord(value, "Los datos para dividir el clip no son válidos.");

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    clipId: parseId(input.clipId, "clip", "El clip"),
    splitAtMs: parseNumber(input.splitAtMs, "El punto de corte", 10, 86_400_000)!,
  });
}

function parseDeleteClipRequest(value: unknown): DeleteClipRequest {
  const input = requireRecord(value, "Los datos para eliminar el clip no son válidos.");

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    clipId: parseId(input.clipId, "clip", "El clip"),
  });
}

function parseBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new IpcRequestError("INVALID_REQUEST", `${label} debe ser verdadero o falso.`);
  }
  return value;
}

function parseUpdateTrackStateRequest(value: unknown): UpdateTrackStateRequest {
  const input = requireRecord(value, "Los datos de la pista no son válidos.");

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    trackId: parseId(input.trackId, "track", "La pista"),
    muted: parseBoolean(input.muted, "Silenciar"),
    hidden: parseBoolean(input.hidden, "Ocultar"),
    locked: parseBoolean(input.locked, "Bloquear"),
  });
}

function parseContent(value: unknown): string {
  if (typeof value !== "string") {
    throw new IpcRequestError("INVALID_REQUEST", "El contenido del texto no es válido.");
  }

  const content = value.replace(/\r\n/g, "\n").trim();
  if (content.length < 1 || content.length > 100_000) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El texto debe contener entre 1 y 100000 caracteres.",
    );
  }

  return content;
}

function parseAddTextClipRequest(value: unknown): AddTextClipRequest {
  const input = requireRecord(value, "Los datos para crear el texto no son válidos.");
  const templateId = input.templateId;

  if (
    typeof templateId !== "string" ||
    !(templateId in TEXT_TEMPLATES)
  ) {
    throw new IpcRequestError("INVALID_REQUEST", "La plantilla de texto no está permitida.");
  }

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    trackId:
      input.trackId === undefined
        ? undefined
        : parseId(input.trackId, "track", "La pista"),
    templateId: templateId as TextTemplateId,
    content: parseContent(input.content),
    timelineStartMs: parseNumber(
      input.timelineStartMs,
      "La posición",
      0,
      86_400_000,
      true,
    ),
    durationMs: parseNumber(
      input.durationMs,
      "La duración",
      100,
      3_600_000,
      true,
    ),
  });
}

function parseColor(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new IpcRequestError("INVALID_REQUEST", `${label} debe usar #RRGGBB.`);
  }
  return value.toUpperCase();
}

function parseTextStylePatch(value: unknown): TextStylePatch | undefined {
  if (value === undefined) return undefined;
  const style = requireRecord(value, "El estilo del texto no es válido.");
  const output: Partial<TextStyle> = {};

  if (style.fontFamily !== undefined) {
    if (typeof style.fontFamily !== "string" || style.fontFamily.trim().length === 0) {
      throw new IpcRequestError("INVALID_REQUEST", "La tipografía no es válida.");
    }
    output.fontFamily = style.fontFamily.trim().slice(0, 120);
  }
  if (style.fontSizePx !== undefined) {
    output.fontSizePx = parseNumber(style.fontSizePx, "El tamaño", 1, 10_000)!;
  }
  if (style.fontWeight !== undefined) {
    const weight = parseNumber(style.fontWeight, "El peso", 100, 900)!;
    if (!Number.isInteger(weight) || weight % 100 !== 0) {
      throw new IpcRequestError("INVALID_REQUEST", "El peso debe ser múltiplo de 100.");
    }
    output.fontWeight = weight;
  }
  if (style.fontStyle !== undefined) {
    if (style.fontStyle !== "normal" && style.fontStyle !== "italic") {
      throw new IpcRequestError("INVALID_REQUEST", "El estilo tipográfico no es válido.");
    }
    output.fontStyle = style.fontStyle;
  }
  if (style.color !== undefined) output.color = parseColor(style.color, "El color");
  if (style.backgroundColor !== undefined) {
    output.backgroundColor = parseColor(style.backgroundColor, "El fondo");
  }
  if (style.backgroundOpacity !== undefined) {
    output.backgroundOpacity = parseNumber(style.backgroundOpacity, "La opacidad", 0, 1)!;
  }
  if (style.alignment !== undefined) {
    if (!["left", "center", "right", "justify"].includes(String(style.alignment))) {
      throw new IpcRequestError("INVALID_REQUEST", "La alineación no es válida.");
    }
    output.alignment = style.alignment as TextStyle["alignment"];
  }
  if (style.verticalAlignment !== undefined) {
    if (!["top", "middle", "bottom"].includes(String(style.verticalAlignment))) {
      throw new IpcRequestError("INVALID_REQUEST", "La alineación vertical no es válida.");
    }
    output.verticalAlignment = style.verticalAlignment as TextStyle["verticalAlignment"];
  }
  if (style.lineHeight !== undefined) {
    output.lineHeight = parseNumber(style.lineHeight, "El interlineado", 0.1, 10)!;
  }
  if (style.letterSpacingPx !== undefined) {
    output.letterSpacingPx = parseNumber(
      style.letterSpacingPx,
      "El espaciado",
      -1_000,
      1_000,
    )!;
  }
  if (style.maxWidthPx !== undefined) {
    output.maxWidthPx = parseNumber(style.maxWidthPx, "El ancho", 1, 100_000)!;
  }

  return Object.freeze(output);
}

function parseAnimationPreset(
  value: unknown,
  label: string,
): TextAnimationPresetId | null | undefined {
  if (value === undefined || value === null) return value;
  if (
    typeof value !== "string" ||
    !TEXT_ANIMATION_PRESET_IDS.includes(value as TextAnimationPresetId)
  ) {
    throw new IpcRequestError("INVALID_REQUEST", `${label} no está permitida.`);
  }
  return value as TextAnimationPresetId;
}

function parseUpdateTextClipRequest(value: unknown): UpdateTextClipRequest {
  const input = requireRecord(value, "Los datos para actualizar el texto no son válidos.");

  return Object.freeze({
    projectId: parseId(input.projectId, "project", "El proyecto"),
    clipId: parseId(input.clipId, "clip", "El clip"),
    content: parseContent(input.content),
    style: parseTextStylePatch(input.style),
    entrancePresetId: parseAnimationPreset(input.entrancePresetId, "La entrada"),
    entranceDurationMs: parseNumber(
      input.entranceDurationMs,
      "La duración de entrada",
      0,
      60_000,
      true,
    ),
    exitPresetId: parseAnimationPreset(input.exitPresetId, "La salida"),
    exitDurationMs: parseNumber(
      input.exitDurationMs,
      "La duración de salida",
      0,
      60_000,
      true,
    ),
  });
}

export {
  parseAddMediaClipRequest,
  parseAddTextClipRequest,
  parseDeleteClipRequest,
  parseMoveClipRequest,
  parseSplitClipRequest,
  parseTrimClipRequest,
  parseUpdateTextClipRequest,
  parseUpdateTrackStateRequest,
};
