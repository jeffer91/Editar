/* =========================================================
Nombre completo: media.ts
Ruta o ubicación: /apps/desktop/shared/domain/media.ts

Función o funciones:
- Definir videos, audios e imágenes importadas.
- Validar metadatos técnicos obtenidos por FFprobe.
- Mantener separados archivo original, proxy y datos derivados.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  createEntityId,
  normalizeName,
  toIsoDateTime,
  toMicroseconds,
  type EntityId,
  type IsoDateTime,
  type Microseconds,
} from "./primitives.js";

type MediaKind = "video" | "audio" | "image";
type MediaAvailability = "online" | "missing" | "offline";

interface RationalFrameRate {
  readonly numerator: number;
  readonly denominator: number;
}

interface AudioStreamInfo {
  readonly codec: string;
  readonly channels: number;
  readonly sampleRate: number;
  readonly bitRate?: number;
}

interface VideoMediaMetadata {
  readonly kind: "video";
  readonly durationUs: Microseconds;
  readonly width: number;
  readonly height: number;
  readonly frameRate: RationalFrameRate;
  readonly videoCodec: string;
  readonly bitRate?: number;
  readonly audio?: AudioStreamInfo;
}

interface AudioMediaMetadata {
  readonly kind: "audio";
  readonly durationUs: Microseconds;
  readonly audio: AudioStreamInfo;
}

interface ImageMediaMetadata {
  readonly kind: "image";
  readonly width: number;
  readonly height: number;
  readonly imageCodec: string;
}

type MediaMetadata =
  | VideoMediaMetadata
  | AudioMediaMetadata
  | ImageMediaMetadata;

interface MediaDerivative {
  readonly id: EntityId<"derivative">;
  readonly type: "proxy" | "thumbnail" | "waveform" | "audio-extract";
  readonly path: string;
  readonly cacheKey: string;
  readonly createdAt: IsoDateTime;
}

interface MediaAsset {
  readonly id: EntityId<"media">;
  readonly projectId: EntityId<"project">;
  readonly kind: MediaKind;
  readonly fileName: string;
  readonly sourcePath: string;
  readonly sizeBytes: number;
  readonly contentHash?: string;
  readonly availability: MediaAvailability;
  readonly metadata: MediaMetadata;
  readonly derivatives: readonly MediaDerivative[];
  readonly importedAt: IsoDateTime;
}

interface CreateMediaAssetInput {
  readonly id?: EntityId<"media">;
  readonly projectId: EntityId<"project">;
  readonly fileName: string;
  readonly sourcePath: string;
  readonly sizeBytes: number;
  readonly contentHash?: string;
  readonly availability?: MediaAvailability;
  readonly metadata: MediaMetadata;
  readonly derivatives?: readonly MediaDerivative[];
  readonly importedAt?: Date | string;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/i;

function validatePositiveInteger(
  value: number,
  field: string,
  max = Number.MAX_SAFE_INTEGER,
): number {
  assertDomain(
    Number.isSafeInteger(value) && value > 0 && value <= max,
    "OUT_OF_RANGE",
    field,
    "El valor debe ser un entero positivo dentro del rango permitido.",
    { value, max },
  );

  return value;
}

function validateCodec(value: string, field: string): string {
  return normalizeName(value, field, 80).toLowerCase();
}

function validateFrameRate(value: RationalFrameRate): RationalFrameRate {
  validatePositiveInteger(value.numerator, "metadata.frameRate.numerator", 1_000_000);
  validatePositiveInteger(value.denominator, "metadata.frameRate.denominator", 1_000_000);

  const fps = value.numerator / value.denominator;

  assertDomain(
    fps >= 0.1 && fps <= 1_000,
    "OUT_OF_RANGE",
    "metadata.frameRate",
    "La tasa de cuadros calculada está fuera del rango permitido.",
    { fps },
  );

  return Object.freeze({ ...value });
}

function validateAudioStream(value: AudioStreamInfo): AudioStreamInfo {
  validatePositiveInteger(value.channels, "metadata.audio.channels", 64);
  validatePositiveInteger(value.sampleRate, "metadata.audio.sampleRate", 768_000);

  if (value.bitRate !== undefined) {
    validatePositiveInteger(value.bitRate, "metadata.audio.bitRate");
  }

  return Object.freeze({
    ...value,
    codec: validateCodec(value.codec, "metadata.audio.codec"),
  });
}

function validateMetadata(value: MediaMetadata): MediaMetadata {
  switch (value.kind) {
    case "video":
      return Object.freeze({
        ...value,
        durationUs: toMicroseconds(value.durationUs, "metadata.durationUs"),
        width: validatePositiveInteger(value.width, "metadata.width", 65_536),
        height: validatePositiveInteger(value.height, "metadata.height", 65_536),
        frameRate: validateFrameRate(value.frameRate),
        videoCodec: validateCodec(value.videoCodec, "metadata.videoCodec"),
        audio: value.audio ? validateAudioStream(value.audio) : undefined,
      });
    case "audio":
      return Object.freeze({
        ...value,
        durationUs: toMicroseconds(value.durationUs, "metadata.durationUs"),
        audio: validateAudioStream(value.audio),
      });
    case "image":
      return Object.freeze({
        ...value,
        width: validatePositiveInteger(value.width, "metadata.width", 65_536),
        height: validatePositiveInteger(value.height, "metadata.height", 65_536),
        imageCodec: validateCodec(value.imageCodec, "metadata.imageCodec"),
      });
  }
}

function validateDerivative(value: MediaDerivative): MediaDerivative {
  assertDomain(
    value.path.trim().length > 0,
    "REQUIRED",
    "derivative.path",
    "La ruta del archivo derivado es obligatoria.",
  );
  assertDomain(
    value.cacheKey.trim().length >= 8,
    "INVALID_FORMAT",
    "derivative.cacheKey",
    "La clave de caché debe contener al menos 8 caracteres.",
  );

  return Object.freeze({
    ...value,
    path: value.path.trim(),
    cacheKey: value.cacheKey.trim(),
    createdAt: toIsoDateTime(value.createdAt, "derivative.createdAt"),
  });
}

function createMediaAsset(input: CreateMediaAssetInput): MediaAsset {
  assertDomain(
    input.sourcePath.trim().length > 0,
    "REQUIRED",
    "sourcePath",
    "La ruta del archivo original es obligatoria.",
  );
  validatePositiveInteger(input.sizeBytes, "sizeBytes");

  if (input.contentHash !== undefined) {
    assertDomain(
      HASH_PATTERN.test(input.contentHash),
      "INVALID_FORMAT",
      "contentHash",
      "El hash debe ser un SHA-256 hexadecimal de 64 caracteres.",
    );
  }

  const metadata = validateMetadata(input.metadata);

  assertDomain(
    metadata.kind === input.metadata.kind,
    "INVALID_RELATION",
    "metadata.kind",
    "El tipo de metadatos no coincide con el recurso.",
  );

  return Object.freeze({
    id: input.id ?? createEntityId("media"),
    projectId: input.projectId,
    kind: metadata.kind,
    fileName: normalizeName(input.fileName, "fileName", 255),
    sourcePath: input.sourcePath.trim(),
    sizeBytes: input.sizeBytes,
    contentHash: input.contentHash?.toLowerCase(),
    availability: input.availability ?? "online",
    metadata,
    derivatives: Object.freeze(
      (input.derivatives ?? []).map(validateDerivative),
    ),
    importedAt: toIsoDateTime(input.importedAt ?? new Date(), "importedAt"),
  });
}

function getMediaDuration(asset: MediaAsset): Microseconds | null {
  return asset.metadata.kind === "image" ? null : asset.metadata.durationUs;
}

export {
  createMediaAsset,
  getMediaDuration,
  validateAudioStream,
  validateFrameRate,
  validateMetadata,
  type AudioMediaMetadata,
  type AudioStreamInfo,
  type CreateMediaAssetInput,
  type ImageMediaMetadata,
  type MediaAsset,
  type MediaAvailability,
  type MediaDerivative,
  type MediaKind,
  type MediaMetadata,
  type RationalFrameRate,
  type VideoMediaMetadata,
};
