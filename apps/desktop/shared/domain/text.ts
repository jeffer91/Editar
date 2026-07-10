/* =========================================================
Nombre completo: text.ts
Ruta o ubicación: /apps/desktop/shared/domain/text.ts

Función o funciones:
- Definir capas de texto reutilizables en la línea de tiempo.
- Validar tipografía, color, alineación y contenido.
- Restringir animaciones a presets conocidos y seguros.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  clampNumber,
  createEntityId,
  normalizeName,
  type EntityId,
} from "./primitives.js";

type TextAlignment = "left" | "center" | "right" | "justify";
type TextVerticalAlignment = "top" | "middle" | "bottom";
type FontStyle = "normal" | "italic";
type TextAnimationPresetId =
  | "fade"
  | "slide-up"
  | "slide-left"
  | "scale-in"
  | "typewriter";

interface TextStyle {
  readonly fontFamily: string;
  readonly fontSizePx: number;
  readonly fontWeight: number;
  readonly fontStyle: FontStyle;
  readonly color: string;
  readonly backgroundColor: string;
  readonly backgroundOpacity: number;
  readonly alignment: TextAlignment;
  readonly verticalAlignment: TextVerticalAlignment;
  readonly lineHeight: number;
  readonly letterSpacingPx: number;
  readonly maxWidthPx?: number;
}

interface TextAnimationReference {
  readonly presetId: TextAnimationPresetId;
  readonly durationMs: number;
}

interface TextLayer {
  readonly id: EntityId<"text-layer">;
  readonly projectId: EntityId<"project">;
  readonly name: string;
  readonly content: string;
  readonly style: TextStyle;
  readonly entranceAnimation?: TextAnimationReference;
  readonly exitAnimation?: TextAnimationReference;
}

interface CreateTextLayerInput {
  readonly id?: EntityId<"text-layer">;
  readonly projectId: EntityId<"project">;
  readonly name: string;
  readonly content: string;
  readonly style?: Partial<TextStyle>;
  readonly entranceAnimation?: TextAnimationReference;
  readonly exitAnimation?: TextAnimationReference;
}

const TEXT_ANIMATION_PRESET_IDS: readonly TextAnimationPresetId[] = Object.freeze([
  "fade",
  "slide-up",
  "slide-left",
  "scale-in",
  "typewriter",
]);

const DEFAULT_TEXT_STYLE: TextStyle = Object.freeze({
  fontFamily: "Inter",
  fontSizePx: 64,
  fontWeight: 700,
  fontStyle: "normal",
  color: "#FFFFFF",
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  alignment: "center",
  verticalAlignment: "middle",
  lineHeight: 1.2,
  letterSpacingPx: 0,
});

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function validateAnimationReference(
  value: TextAnimationReference,
  field: string,
): TextAnimationReference {
  assertDomain(
    TEXT_ANIMATION_PRESET_IDS.includes(value.presetId),
    "UNSUPPORTED_VALUE",
    `${field}.presetId`,
    "La animación de texto seleccionada no está permitida.",
  );
  assertDomain(
    Number.isSafeInteger(value.durationMs) &&
      value.durationMs >= 0 &&
      value.durationMs <= 60_000,
    "OUT_OF_RANGE",
    `${field}.durationMs`,
    "La duración de la animación debe estar entre 0 y 60000 ms.",
  );

  return Object.freeze({
    presetId: value.presetId,
    durationMs: value.durationMs,
  });
}

function validateTextStyle(value: TextStyle): TextStyle {
  const fontFamily = normalizeName(value.fontFamily, "style.fontFamily", 120);
  clampNumber(value.fontSizePx, 1, 10_000, "style.fontSizePx");

  assertDomain(
    Number.isSafeInteger(value.fontWeight) &&
      value.fontWeight >= 100 &&
      value.fontWeight <= 900 &&
      value.fontWeight % 100 === 0,
    "OUT_OF_RANGE",
    "style.fontWeight",
    "El peso tipográfico debe ser un múltiplo de 100 entre 100 y 900.",
  );
  assertDomain(
    HEX_COLOR_PATTERN.test(value.color),
    "INVALID_FORMAT",
    "style.color",
    "El color del texto debe usar el formato #RRGGBB.",
  );
  assertDomain(
    HEX_COLOR_PATTERN.test(value.backgroundColor),
    "INVALID_FORMAT",
    "style.backgroundColor",
    "El color de fondo debe usar el formato #RRGGBB.",
  );
  clampNumber(
    value.backgroundOpacity,
    0,
    1,
    "style.backgroundOpacity",
  );
  clampNumber(value.lineHeight, 0.1, 10, "style.lineHeight");
  clampNumber(
    value.letterSpacingPx,
    -1_000,
    1_000,
    "style.letterSpacingPx",
  );

  if (value.maxWidthPx !== undefined) {
    clampNumber(value.maxWidthPx, 1, 100_000, "style.maxWidthPx");
  }

  return Object.freeze({
    ...value,
    fontFamily,
    color: value.color.toUpperCase(),
    backgroundColor: value.backgroundColor.toUpperCase(),
  });
}

function createTextLayer(input: CreateTextLayerInput): TextLayer {
  const content = input.content.replace(/\r\n/g, "\n").trim();

  assertDomain(
    content.length > 0,
    "REQUIRED",
    "content",
    "El contenido del texto es obligatorio.",
  );
  assertDomain(
    content.length <= 100_000,
    "OUT_OF_RANGE",
    "content",
    "El contenido del texto supera el tamaño permitido.",
  );

  return Object.freeze({
    id: input.id ?? createEntityId("text-layer"),
    projectId: input.projectId,
    name: normalizeName(input.name, "name", 120),
    content,
    style: validateTextStyle({
      ...DEFAULT_TEXT_STYLE,
      ...input.style,
    }),
    entranceAnimation: input.entranceAnimation
      ? validateAnimationReference(
          input.entranceAnimation,
          "entranceAnimation",
        )
      : undefined,
    exitAnimation: input.exitAnimation
      ? validateAnimationReference(input.exitAnimation, "exitAnimation")
      : undefined,
  });
}

export {
  DEFAULT_TEXT_STYLE,
  TEXT_ANIMATION_PRESET_IDS,
  createTextLayer,
  validateAnimationReference,
  validateTextStyle,
  type CreateTextLayerInput,
  type FontStyle,
  type TextAlignment,
  type TextAnimationPresetId,
  type TextAnimationReference,
  type TextLayer,
  type TextStyle,
  type TextVerticalAlignment,
};
