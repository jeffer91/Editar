/* =========================================================
Nombre completo: audio-analysis.ts
Ruta o ubicación: /apps/desktop/shared/domain/audio-analysis.ts

Función o funciones:
- Definir segmentos de silencio y análisis acústicos persistentes.
- Validar umbrales, duraciones y resultados de FFmpeg.
- Calcular planes seguros para eliminar o acortar silencios.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  clampNumber,
  toIsoDateTime,
  toMicroseconds,
  type IsoDateTime,
  type Microseconds,
} from "./primitives.js";

type SilenceReductionMode = "remove" | "shorten";

interface SilenceDetectionSettings {
  readonly thresholdDb: number;
  readonly minSilenceUs: Microseconds;
}

interface SilenceSegment {
  readonly startUs: Microseconds;
  readonly endUs: Microseconds;
  readonly durationUs: Microseconds;
}

interface AudioAnalysis {
  readonly analyzedAt: IsoDateTime;
  readonly sourceKey: string;
  readonly durationUs: Microseconds;
  readonly thresholdDb: number;
  readonly minSilenceUs: Microseconds;
  readonly silenceDurationUs: Microseconds;
  readonly audibleDurationUs: Microseconds;
  readonly silenceRatio: number;
  readonly segments: readonly SilenceSegment[];
}

interface SilenceReductionSettings {
  readonly mode: SilenceReductionMode;
  readonly targetSilenceUs: Microseconds;
  readonly edgePaddingUs: Microseconds;
}

interface SilenceKeepRange {
  readonly sourceStartUs: Microseconds;
  readonly sourceEndUs: Microseconds;
  readonly durationUs: Microseconds;
}

interface SilenceReductionPlan {
  readonly createdAt: IsoDateTime;
  readonly analysisSourceKey: string;
  readonly mode: SilenceReductionMode;
  readonly originalDurationUs: Microseconds;
  readonly outputDurationUs: Microseconds;
  readonly removedDurationUs: Microseconds;
  readonly retainedSilenceUs: Microseconds;
  readonly settings: SilenceReductionSettings;
  readonly keepRanges: readonly SilenceKeepRange[];
}

interface CreateAudioAnalysisInput {
  readonly analyzedAt?: Date | string;
  readonly sourceKey: string;
  readonly durationUs: number;
  readonly thresholdDb: number;
  readonly minSilenceUs: number;
  readonly segments: readonly {
    readonly startUs: number;
    readonly endUs: number;
  }[];
}

interface CreateSilenceReductionPlanInput {
  readonly createdAt?: Date | string;
  readonly analysis: AudioAnalysis;
  readonly settings: {
    readonly mode: SilenceReductionMode;
    readonly targetSilenceUs: number;
    readonly edgePaddingUs: number;
  };
}

const DEFAULT_SILENCE_DETECTION_SETTINGS: SilenceDetectionSettings = Object.freeze({
  thresholdDb: -35,
  minSilenceUs: toMicroseconds(500_000, "minSilenceUs"),
});

const DEFAULT_SILENCE_REDUCTION_SETTINGS: SilenceReductionSettings = Object.freeze({
  mode: "shorten",
  targetSilenceUs: toMicroseconds(300_000, "targetSilenceUs"),
  edgePaddingUs: toMicroseconds(80_000, "edgePaddingUs"),
});

function validateSourceKey(value: string, field: string): string {
  const normalized = value.trim();

  assertDomain(
    normalized.length >= 8 && normalized.length <= 256,
    "INVALID_FORMAT",
    field,
    "La clave de origen debe contener entre 8 y 256 caracteres.",
  );

  return normalized;
}

function validateThresholdDb(value: number): number {
  return clampNumber(value, -96, -1, "thresholdDb");
}

function validateSilenceDetectionSettings(
  value: SilenceDetectionSettings,
): SilenceDetectionSettings {
  return Object.freeze({
    thresholdDb: validateThresholdDb(value.thresholdDb),
    minSilenceUs: toMicroseconds(
      clampNumber(Number(value.minSilenceUs), 10_000, 30_000_000, "minSilenceUs"),
      "minSilenceUs",
    ),
  });
}

function validateSilenceSegment(
  value: SilenceSegment,
  totalDurationUs: Microseconds,
): SilenceSegment {
  const startUs = toMicroseconds(value.startUs, "segment.startUs");
  const endUs = toMicroseconds(value.endUs, "segment.endUs");

  assertDomain(
    startUs >= 0 && endUs > startUs && endUs <= totalDurationUs,
    "OUT_OF_RANGE",
    "segments",
    "El segmento de silencio está fuera de la duración del recurso.",
  );

  return Object.freeze({
    startUs,
    endUs,
    durationUs: toMicroseconds(endUs - startUs, "segment.durationUs"),
  });
}

function normalizeSilenceSegments(
  segments: readonly SilenceSegment[],
  durationUs: Microseconds,
): readonly SilenceSegment[] {
  const sorted = [...segments]
    .map((segment) => validateSilenceSegment(segment, durationUs))
    .sort((left, right) => left.startUs - right.startUs);
  const merged: SilenceSegment[] = [];

  for (const segment of sorted) {
    const previous = merged.at(-1);

    if (!previous || segment.startUs > previous.endUs) {
      merged.push(segment);
      continue;
    }

    const endUs = toMicroseconds(
      Math.max(previous.endUs, segment.endUs),
      "segment.endUs",
    );
    merged[merged.length - 1] = Object.freeze({
      startUs: previous.startUs,
      endUs,
      durationUs: toMicroseconds(endUs - previous.startUs, "segment.durationUs"),
    });
  }

  assertDomain(
    merged.length <= 5_000,
    "OUT_OF_RANGE",
    "segments",
    "El análisis contiene demasiados segmentos de silencio.",
  );

  return Object.freeze(merged);
}

function createAudioAnalysis(input: CreateAudioAnalysisInput): AudioAnalysis {
  const durationUs = toMicroseconds(input.durationUs, "durationUs");

  assertDomain(
    durationUs > 0,
    "OUT_OF_RANGE",
    "durationUs",
    "La duración del análisis debe ser mayor a cero.",
  );

  const settings = validateSilenceDetectionSettings({
    thresholdDb: input.thresholdDb,
    minSilenceUs: toMicroseconds(input.minSilenceUs, "minSilenceUs"),
  });
  const segments = normalizeSilenceSegments(
    input.segments.map((segment) => ({
      startUs: toMicroseconds(segment.startUs, "segment.startUs"),
      endUs: toMicroseconds(segment.endUs, "segment.endUs"),
      durationUs: toMicroseconds(
        segment.endUs - segment.startUs,
        "segment.durationUs",
      ),
    })),
    durationUs,
  );
  const silenceDurationUs = toMicroseconds(
    segments.reduce((total, segment) => total + segment.durationUs, 0),
    "silenceDurationUs",
  );
  const audibleDurationUs = toMicroseconds(
    Math.max(0, durationUs - silenceDurationUs),
    "audibleDurationUs",
  );
  const silenceRatio = durationUs === 0 ? 0 : silenceDurationUs / durationUs;

  return Object.freeze({
    analyzedAt: toIsoDateTime(input.analyzedAt ?? new Date(), "analyzedAt"),
    sourceKey: validateSourceKey(input.sourceKey, "sourceKey"),
    durationUs,
    thresholdDb: settings.thresholdDb,
    minSilenceUs: settings.minSilenceUs,
    silenceDurationUs,
    audibleDurationUs,
    silenceRatio: clampNumber(silenceRatio, 0, 1, "silenceRatio"),
    segments,
  });
}

function validateAudioAnalysis(value: AudioAnalysis): AudioAnalysis {
  return createAudioAnalysis({
    analyzedAt: value.analyzedAt,
    sourceKey: value.sourceKey,
    durationUs: value.durationUs,
    thresholdDb: value.thresholdDb,
    minSilenceUs: value.minSilenceUs,
    segments: value.segments,
  });
}

function validateSilenceReductionSettings(
  value: SilenceReductionSettings,
): SilenceReductionSettings {
  assertDomain(
    value.mode === "remove" || value.mode === "shorten",
    "UNSUPPORTED_VALUE",
    "mode",
    "El modo de reducción de silencios no está permitido.",
  );

  const edgePaddingUs = toMicroseconds(
    clampNumber(Number(value.edgePaddingUs), 0, 2_000_000, "edgePaddingUs"),
    "edgePaddingUs",
  );
  const targetSilenceUs = toMicroseconds(
    clampNumber(Number(value.targetSilenceUs), 0, 10_000_000, "targetSilenceUs"),
    "targetSilenceUs",
  );

  assertDomain(
    value.mode !== "shorten" || targetSilenceUs > 0,
    "OUT_OF_RANGE",
    "targetSilenceUs",
    "El modo acortar requiere conservar una duración de silencio mayor a cero.",
  );

  return Object.freeze({
    mode: value.mode,
    targetSilenceUs,
    edgePaddingUs,
  });
}

interface RemovalRange {
  readonly startUs: number;
  readonly endUs: number;
}

function mergeRemovalRanges(
  ranges: readonly RemovalRange[],
): readonly RemovalRange[] {
  const sorted = [...ranges].sort((left, right) => left.startUs - right.startUs);
  const merged: RemovalRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);

    if (!previous || range.startUs > previous.endUs) {
      merged.push(Object.freeze({ ...range }));
      continue;
    }

    merged[merged.length - 1] = Object.freeze({
      startUs: previous.startUs,
      endUs: Math.max(previous.endUs, range.endUs),
    });
  }

  return Object.freeze(merged);
}

function createSilenceReductionPlan(
  input: CreateSilenceReductionPlanInput,
): SilenceReductionPlan {
  const analysis = validateAudioAnalysis(input.analysis);
  const settings = validateSilenceReductionSettings({
    mode: input.settings.mode,
    targetSilenceUs: toMicroseconds(
      input.settings.targetSilenceUs,
      "targetSilenceUs",
    ),
    edgePaddingUs: toMicroseconds(
      input.settings.edgePaddingUs,
      "edgePaddingUs",
    ),
  });
  const removals: RemovalRange[] = [];
  let retainedSilenceUs = 0;

  for (const segment of analysis.segments) {
    const duration = Number(segment.durationUs);
    const minimumRetained = Number(settings.edgePaddingUs) * 2;
    const requestedRetained =
      settings.mode === "remove"
        ? minimumRetained
        : Math.max(Number(settings.targetSilenceUs), minimumRetained);
    const retained = Math.min(duration, requestedRetained);
    const removable = duration - retained;

    retainedSilenceUs += retained;

    if (removable <= 0) {
      continue;
    }

    const leftRetained = Math.floor(retained / 2);
    const rightRetained = retained - leftRetained;
    const startUs = Number(segment.startUs) + leftRetained;
    const endUs = Number(segment.endUs) - rightRetained;

    if (endUs > startUs) {
      removals.push(Object.freeze({ startUs, endUs }));
    }
  }

  const mergedRemovals = mergeRemovalRanges(removals);
  const keepRanges: SilenceKeepRange[] = [];
  let cursor = 0;

  for (const removal of mergedRemovals) {
    if (removal.startUs > cursor) {
      keepRanges.push(
        Object.freeze({
          sourceStartUs: toMicroseconds(cursor, "keepRange.sourceStartUs"),
          sourceEndUs: toMicroseconds(
            removal.startUs,
            "keepRange.sourceEndUs",
          ),
          durationUs: toMicroseconds(
            removal.startUs - cursor,
            "keepRange.durationUs",
          ),
        }),
      );
    }

    cursor = Math.max(cursor, removal.endUs);
  }

  if (cursor < analysis.durationUs) {
    keepRanges.push(
      Object.freeze({
        sourceStartUs: toMicroseconds(cursor, "keepRange.sourceStartUs"),
        sourceEndUs: analysis.durationUs,
        durationUs: toMicroseconds(
          analysis.durationUs - cursor,
          "keepRange.durationUs",
        ),
      }),
    );
  }

  assertDomain(
    keepRanges.length > 0,
    "INVALID_RELATION",
    "keepRanges",
    "La reducción no puede eliminar todo el contenido del recurso.",
  );
  assertDomain(
    keepRanges.length <= 500,
    "OUT_OF_RANGE",
    "keepRanges",
    "El plan contiene demasiados cortes para procesarse de forma segura.",
  );

  const outputDurationUs = toMicroseconds(
    keepRanges.reduce((total, range) => total + range.durationUs, 0),
    "outputDurationUs",
  );
  const removedDurationUs = toMicroseconds(
    analysis.durationUs - outputDurationUs,
    "removedDurationUs",
  );

  return Object.freeze({
    createdAt: toIsoDateTime(input.createdAt ?? new Date(), "createdAt"),
    analysisSourceKey: analysis.sourceKey,
    mode: settings.mode,
    originalDurationUs: analysis.durationUs,
    outputDurationUs,
    removedDurationUs,
    retainedSilenceUs: toMicroseconds(
      Math.min(retainedSilenceUs, outputDurationUs),
      "retainedSilenceUs",
    ),
    settings,
    keepRanges: Object.freeze(keepRanges),
  });
}

function validateSilenceReductionPlan(
  value: SilenceReductionPlan,
): SilenceReductionPlan {
  const settings = validateSilenceReductionSettings(value.settings);
  const originalDurationUs = toMicroseconds(
    value.originalDurationUs,
    "originalDurationUs",
  );
  const keepRanges = value.keepRanges.map((range) => {
    const sourceStartUs = toMicroseconds(
      range.sourceStartUs,
      "keepRange.sourceStartUs",
    );
    const sourceEndUs = toMicroseconds(
      range.sourceEndUs,
      "keepRange.sourceEndUs",
    );

    assertDomain(
      sourceStartUs >= 0 &&
        sourceEndUs > sourceStartUs &&
        sourceEndUs <= originalDurationUs,
      "OUT_OF_RANGE",
      "keepRanges",
      "Un rango conservado está fuera de la duración original.",
    );

    return Object.freeze({
      sourceStartUs,
      sourceEndUs,
      durationUs: toMicroseconds(
        sourceEndUs - sourceStartUs,
        "keepRange.durationUs",
      ),
    });
  });
  const outputDurationUs = toMicroseconds(
    keepRanges.reduce((total, range) => total + range.durationUs, 0),
    "outputDurationUs",
  );

  assertDomain(
    outputDurationUs === value.outputDurationUs,
    "INVALID_RELATION",
    "outputDurationUs",
    "La duración de salida no coincide con los rangos conservados.",
  );

  return Object.freeze({
    createdAt: toIsoDateTime(value.createdAt, "createdAt"),
    analysisSourceKey: validateSourceKey(
      value.analysisSourceKey,
      "analysisSourceKey",
    ),
    mode: settings.mode,
    originalDurationUs,
    outputDurationUs,
    removedDurationUs: toMicroseconds(
      originalDurationUs - outputDurationUs,
      "removedDurationUs",
    ),
    retainedSilenceUs: toMicroseconds(
      value.retainedSilenceUs,
      "retainedSilenceUs",
    ),
    settings,
    keepRanges: Object.freeze(keepRanges),
  });
}

function hasUsableAudioAnalysis(value: AudioAnalysis | undefined): value is AudioAnalysis {
  return Boolean(value && value.durationUs > 0);
}

export {
  DEFAULT_SILENCE_DETECTION_SETTINGS,
  DEFAULT_SILENCE_REDUCTION_SETTINGS,
  createAudioAnalysis,
  createSilenceReductionPlan,
  hasUsableAudioAnalysis,
  normalizeSilenceSegments,
  validateAudioAnalysis,
  validateSilenceDetectionSettings,
  validateSilenceReductionPlan,
  validateSilenceReductionSettings,
  type AudioAnalysis,
  type CreateAudioAnalysisInput,
  type CreateSilenceReductionPlanInput,
  type SilenceDetectionSettings,
  type SilenceKeepRange,
  type SilenceReductionMode,
  type SilenceReductionPlan,
  type SilenceReductionSettings,
  type SilenceSegment,
};
