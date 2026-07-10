/* =========================================================
Nombre completo: ffprobe-parser.ts
Ruta o ubicación: /apps/desktop/main/media/ffprobe-parser.ts

Función o funciones:
- Interpretar la salida JSON de FFprobe.
- Seleccionar streams principales de video y audio.
- Convertir duración, resolución, FPS y códecs al dominio.
========================================================= */

import {
  toMicroseconds,
  type AudioStreamInfo,
  type MediaKind,
  type MediaMetadata,
  type RationalFrameRate,
} from "../../shared/domain/index.js";

class FfprobeParseError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FfprobeParseError";
  }
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function toPositiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function toPositiveNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function requireString(
  value: unknown,
  code: string,
  message: string,
): string {
  const parsed = toStringValue(value);

  if (!parsed) {
    throw new FfprobeParseError(code, message);
  }

  return parsed.toLowerCase();
}

function requirePositiveInteger(
  value: unknown,
  code: string,
  message: string,
): number {
  const parsed = toPositiveInteger(value);

  if (!parsed) {
    throw new FfprobeParseError(code, message);
  }

  return parsed;
}

function parseFrameRate(value: unknown): RationalFrameRate | null {
  const raw = toStringValue(value);

  if (!raw) {
    return null;
  }

  const [numeratorRaw, denominatorRaw] = raw.split("/", 2);
  const numerator = Number.parseInt(numeratorRaw ?? "", 10);
  const denominator = Number.parseInt(denominatorRaw ?? "", 10);

  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return null;
  }

  return Object.freeze({ numerator, denominator });
}

function parseDurationUs(
  format: UnknownRecord | null,
  stream: UnknownRecord | null,
): ReturnType<typeof toMicroseconds> {
  const seconds =
    toPositiveNumber(format?.duration) ?? toPositiveNumber(stream?.duration);

  if (!seconds) {
    throw new FfprobeParseError(
      "DURATION_UNAVAILABLE",
      "FFprobe no pudo determinar una duración válida.",
    );
  }

  return toMicroseconds(Math.max(1, Math.round(seconds * 1_000_000)));
}

function parseOptionalBitRate(...values: readonly unknown[]): number | undefined {
  for (const value of values) {
    const parsed = toPositiveInteger(value);

    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function parseAudioStream(stream: UnknownRecord): AudioStreamInfo {
  const codec = requireString(
    stream.codec_name,
    "AUDIO_CODEC_UNAVAILABLE",
    "FFprobe no informó el códec de audio.",
  );
  const channels = requirePositiveInteger(
    stream.channels,
    "AUDIO_CHANNELS_UNAVAILABLE",
    "FFprobe no informó la cantidad de canales de audio.",
  );
  const sampleRate = requirePositiveInteger(
    stream.sample_rate,
    "AUDIO_SAMPLE_RATE_UNAVAILABLE",
    "FFprobe no informó la frecuencia de muestreo.",
  );
  const bitRate = parseOptionalBitRate(stream.bit_rate);

  return Object.freeze({
    codec,
    channels,
    sampleRate,
    bitRate,
  });
}

function streamType(stream: UnknownRecord): string | null {
  return toStringValue(stream.codec_type)?.toLowerCase() ?? null;
}

function isAttachedPicture(stream: UnknownRecord): boolean {
  const disposition = toRecord(stream.disposition);
  const attached = disposition?.attached_pic;

  return attached === 1 || attached === "1" || attached === true;
}

function parseProbeDocument(value: string | unknown): UnknownRecord {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch (error) {
      throw new FfprobeParseError(
        "INVALID_JSON",
        error instanceof Error
          ? `FFprobe devolvió JSON inválido: ${error.message}`
          : "FFprobe devolvió JSON inválido.",
      );
    }
  }

  const document = toRecord(parsed);

  if (!document) {
    throw new FfprobeParseError(
      "INVALID_DOCUMENT",
      "La respuesta de FFprobe no tiene una estructura válida.",
    );
  }

  const errorSection = toRecord(document.error);
  const errorMessage = toStringValue(errorSection?.string);

  if (errorMessage) {
    throw new FfprobeParseError("FFPROBE_REPORTED_ERROR", errorMessage);
  }

  return document;
}

function parseFfprobeMetadata(
  value: string | unknown,
  expectedKind: MediaKind,
): MediaMetadata {
  const document = parseProbeDocument(value);
  const streams = Array.isArray(document.streams)
    ? document.streams.map(toRecord).filter((stream): stream is UnknownRecord => Boolean(stream))
    : [];
  const format = toRecord(document.format);
  const videoStreams = streams.filter((stream) => streamType(stream) === "video");
  const audioStreams = streams.filter((stream) => streamType(stream) === "audio");
  const primaryVideo =
    videoStreams.find((stream) => !isAttachedPicture(stream)) ?? videoStreams[0] ?? null;
  const primaryAudio = audioStreams[0] ?? null;

  if (expectedKind === "image") {
    if (!primaryVideo) {
      throw new FfprobeParseError(
        "IMAGE_STREAM_UNAVAILABLE",
        "El archivo no contiene un stream de imagen reconocible.",
      );
    }

    return Object.freeze({
      kind: "image",
      width: requirePositiveInteger(
        primaryVideo.width,
        "IMAGE_WIDTH_UNAVAILABLE",
        "FFprobe no informó el ancho de la imagen.",
      ),
      height: requirePositiveInteger(
        primaryVideo.height,
        "IMAGE_HEIGHT_UNAVAILABLE",
        "FFprobe no informó el alto de la imagen.",
      ),
      imageCodec: requireString(
        primaryVideo.codec_name,
        "IMAGE_CODEC_UNAVAILABLE",
        "FFprobe no informó el formato de la imagen.",
      ),
    });
  }

  if (expectedKind === "audio") {
    if (!primaryAudio) {
      throw new FfprobeParseError(
        "AUDIO_STREAM_UNAVAILABLE",
        "El archivo no contiene un stream de audio reconocible.",
      );
    }

    return Object.freeze({
      kind: "audio",
      durationUs: parseDurationUs(format, primaryAudio),
      audio: parseAudioStream(primaryAudio),
    });
  }

  if (!primaryVideo) {
    throw new FfprobeParseError(
      "VIDEO_STREAM_UNAVAILABLE",
      "El archivo no contiene un stream de video reconocible.",
    );
  }

  const frameRate =
    parseFrameRate(primaryVideo.avg_frame_rate) ??
    parseFrameRate(primaryVideo.r_frame_rate);

  if (!frameRate) {
    throw new FfprobeParseError(
      "FRAME_RATE_UNAVAILABLE",
      "FFprobe no informó una tasa de cuadros válida.",
    );
  }

  return Object.freeze({
    kind: "video",
    durationUs: parseDurationUs(format, primaryVideo),
    width: requirePositiveInteger(
      primaryVideo.width,
      "VIDEO_WIDTH_UNAVAILABLE",
      "FFprobe no informó el ancho del video.",
    ),
    height: requirePositiveInteger(
      primaryVideo.height,
      "VIDEO_HEIGHT_UNAVAILABLE",
      "FFprobe no informó el alto del video.",
    ),
    frameRate,
    videoCodec: requireString(
      primaryVideo.codec_name,
      "VIDEO_CODEC_UNAVAILABLE",
      "FFprobe no informó el códec de video.",
    ),
    bitRate: parseOptionalBitRate(primaryVideo.bit_rate, format?.bit_rate),
    audio: primaryAudio ? parseAudioStream(primaryAudio) : undefined,
  });
}

export {
  FfprobeParseError,
  parseFfprobeMetadata,
  parseFrameRate,
  type UnknownRecord,
};
