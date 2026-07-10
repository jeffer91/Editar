/* =========================================================
Nombre completo: media.ts
Ruta o ubicación: /apps/desktop/shared/domain/media.ts

Función o funciones:
- Definir videos, audios e imágenes importadas.
- Separar el registro inicial del análisis técnico con FFprobe.
- Mantener archivo original, metadatos y derivados sin modificar la fuente.
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
type MediaInspectionStatus = "pending" | "ready" | "failed";

interface MediaInspection {
  readonly status: MediaInspectionStatus;
  readonly error?: string;
  readonly inspectedAt?: IsoDateTime;
}

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
  readonly extension: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sourceModifiedAt?: IsoDateTime;
  readonly contentHash?: string;
  readonly availability: MediaAvailability;
  readonly inspection: MediaInspection;
  readonly metadata?: MediaMetadata;
  readonly derivatives: readonly MediaDerivative[];
  readonly importedAt: IsoDateTime;
}

interface CreateMediaAssetInput {
  readonly id?: EntityId<"media">;
  readonly projectId: EntityId<"project">;
  readonly kind?: MediaKind;
  readonly fileName: string;
  readonly sourcePath: string;
  readonly extension?: string;
  readonly mimeType?: string;
  readonly sizeBytes: number;
  readonly sourceModifiedAt?: Date | string;
  readonly contentHash?: string;
  readonly availability?: MediaAvailability;
  readonly inspection?: MediaInspection;
  readonly metadata?: MediaMetadata;
  readonly derivatives?: readonly MediaDerivative[];
  readonly importedAt?: Date | string;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const EXTENSION_PATTERN = /^[a-z0-9]{1,12}$/i;
const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

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

function validateInspection(
  value: MediaInspection,
  metadata: MediaMetadata | undefined,
): MediaInspection {
  if (value.status === "ready") {
    assertDomain(
      metadata !== undefined,
      "REQUIRED",
      "metadata",
      "Un recurso analizado debe incluir metadatos técnicos.",
    );
  }

  if (value.status === "pending") {
    assertDomain(
      metadata === undefined,
      "INVALID_RELATION",
      "inspection.status",
      "Un recurso pendiente todavía no debe contener metadatos técnicos.",
    );
  }

  if (value.status === "failed") {
    assertDomain(
      typeof value.error === "string" && value.error.trim().length > 0,
      "REQUIRED",
      "inspection.error",
      "Un análisis fallido debe registrar una explicación.",
    );
  }

  return Object.freeze({
    status: value.status,
    error: value.error?.trim(),
    inspectedAt: value.inspectedAt
      ? toIsoDateTime(value.inspectedAt, "inspection.inspectedAt")
      : undefined,
  });
}

function defaultMimeType(kind: MediaKind): string {
  switch (kind) {
    case "video":
      return "video/unknown";
    case "audio":
      return "audio/unknown";
    case "image":
      return "image/unknown";
  }
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

  const metadata = input.metadata ? validateMetadata(input.metadata) : undefined;
  const kind = input.kind ?? metadata?.kind;

  assertDomain(
    kind !== undefined,
    "REQUIRED",
    "kind",
    "El tipo de recurso multimedia es obligatorio.",
  );

  if (metadata) {
    assertDomain(
      metadata.kind === kind,
      "INVALID_RELATION",
      "metadata.kind",
      "El tipo de metadatos no coincide con el recurso.",
    );
  }

  const inspection = validateInspection(
    input.inspection ?? {
      status: metadata ? "ready" : "pending",
      inspectedAt: metadata ? input.importedAt ?? new Date() : undefined,
    },
    metadata,
  );
  const extension = (input.extension ?? input.fileName.split(".").at(-1) ?? "bin")
    .replace(/^\./, "")
    .toLowerCase();
  const mimeType = (input.mimeType ?? defaultMimeType(kind)).toLowerCase();

  assertDomain(
    EXTENSION_PATTERN.test(extension),
    "INVALID_FORMAT",
    "extension",
    "La extensión del archivo no tiene un formato válido.",
  );
  assertDomain(
    MIME_PATTERN.test(mimeType),
    "INVALID_FORMAT",
    "mimeType",
    "El tipo MIME del archivo no tiene un formato válido.",
  );

  return Object.freeze({
    id: input.id ?? createEntityId("media"),
    projectId: input.projectId,
    kind,
    fileName: normalizeName(input.fileName, "fileName", 255),
    sourcePath: input.sourcePath.trim(),
    extension,
    mimeType,
    sizeBytes: input.sizeBytes,
    sourceModifiedAt: input.sourceModifiedAt
      ? toIsoDateTime(input.sourceModifiedAt, "sourceModifiedAt")
      : undefined,
    contentHash: input.contentHash?.toLowerCase(),
    availability: input.availability ?? "online",
    inspection,
    metadata,
    derivatives: Object.freeze(
      (input.derivatives ?? []).map(validateDerivative),
    ),
    importedAt: toIsoDateTime(input.importedAt ?? new Date(), "importedAt"),
  });
}

function getMediaDuration(asset: MediaAsset): Microseconds | null {
  if (!asset.metadata || asset.metadata.kind === "image") {
    return null;
  }

  return asset.metadata.durationUs;
}

export {
  createMediaAsset,
  getMediaDuration,
  validateAudioStream,
  validateFrameRate,
  validateInspection,
  validateMetadata,
  type AudioMediaMetadata,
  type AudioStreamInfo,
  type CreateMediaAssetInput,
  type ImageMediaMetadata,
  type MediaAsset,
  type MediaAvailability,
  type MediaDerivative,
  type MediaInspection,
  type MediaInspectionStatus,
  type MediaKind,
  type MediaMetadata,
  type RationalFrameRate,
  type VideoMediaMetadata,
};
