/* =========================================================
Nombre completo: silence-detect-parser.ts
Ruta o ubicación: /apps/desktop/main/media/silence-detect-parser.ts

Función o funciones:
- Interpretar eventos silence_start y silence_end de FFmpeg.
- Cerrar silencios abiertos al inicio o final del recurso.
- Construir un AudioAnalysis validado por el dominio.
========================================================= */

import {
  createAudioAnalysis,
  type AudioAnalysis,
} from "../../shared/domain/index.js";

interface ParseSilenceDetectionInput {
  readonly stderr: string;
  readonly durationUs: number;
  readonly thresholdDb: number;
  readonly minSilenceUs: number;
  readonly sourceKey: string;
  readonly analyzedAt?: Date | string;
}

class SilenceDetectionParseError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SilenceDetectionParseError";
  }
}

const START_PATTERN = /silence_start:\s*(-?\d+(?:\.\d+)?)/i;
const END_PATTERN = /silence_end:\s*(-?\d+(?:\.\d+)?)/i;

function secondsToMicroseconds(value: string): number | null {
  const seconds = Number(value);

  if (!Number.isFinite(seconds)) {
    return null;
  }

  return Math.max(0, Math.round(seconds * 1_000_000));
}

function parseSilenceSegments(
  stderr: string,
  durationUs: number,
): readonly { readonly startUs: number; readonly endUs: number }[] {
  if (!Number.isSafeInteger(durationUs) || durationUs <= 0) {
    throw new SilenceDetectionParseError(
      "INVALID_DURATION",
      "La duración del recurso no es válida para analizar silencios.",
    );
  }

  const segments: { startUs: number; endUs: number }[] = [];
  let openStartUs: number | null = null;

  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = START_PATTERN.exec(line);

    if (startMatch) {
      const startUs = secondsToMicroseconds(startMatch[1]);

      if (startUs !== null) {
        openStartUs = Math.min(startUs, durationUs);
      }

      continue;
    }

    const endMatch = END_PATTERN.exec(line);

    if (!endMatch) {
      continue;
    }

    const endUsRaw = secondsToMicroseconds(endMatch[1]);

    if (endUsRaw === null) {
      continue;
    }

    const endUs = Math.min(endUsRaw, durationUs);
    const startUs = openStartUs ?? 0;

    if (endUs > startUs) {
      segments.push(Object.freeze({ startUs, endUs }));
    }

    openStartUs = null;
  }

  if (openStartUs !== null && openStartUs < durationUs) {
    segments.push(Object.freeze({ startUs: openStartUs, endUs: durationUs }));
  }

  return Object.freeze(segments);
}

function parseSilenceDetection(
  input: ParseSilenceDetectionInput,
): AudioAnalysis {
  const segments = parseSilenceSegments(input.stderr, input.durationUs);

  return createAudioAnalysis({
    analyzedAt: input.analyzedAt,
    sourceKey: input.sourceKey,
    durationUs: input.durationUs,
    thresholdDb: input.thresholdDb,
    minSilenceUs: input.minSilenceUs,
    segments,
  });
}

export {
  END_PATTERN,
  START_PATTERN,
  SilenceDetectionParseError,
  parseSilenceDetection,
  parseSilenceSegments,
  secondsToMicroseconds,
  type ParseSilenceDetectionInput,
};
