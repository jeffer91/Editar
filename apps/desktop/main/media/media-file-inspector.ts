/* =========================================================
Nombre completo: media-file-inspector.ts
Ruta o ubicación: /apps/desktop/main/media/media-file-inspector.ts

Función o funciones:
- Validar archivos seleccionados antes de registrarlos.
- Identificar clase multimedia mediante extensión y firma binaria.
- Calcular hash SHA-256 sin cargar archivos completos en memoria.
========================================================= */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, realpath, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { MediaKind } from "../../shared/domain/index.js";

interface SupportedMediaFormat {
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly signature: "isobmff" | "ebml" | "riff-avi" | "riff-wave" | "riff-webp" | "png" | "jpeg" | "gif" | "bmp" | "mp3" | "flac" | "ogg" | "aac";
}

interface InspectedMediaFile {
  readonly fileName: string;
  readonly sourcePath: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly kind: MediaKind;
  readonly sizeBytes: number;
  readonly sourceModifiedAt: string;
  readonly contentHash: string;
}

class MediaFileInspectionError extends Error {
  constructor(
    readonly code:
      | "UNSUPPORTED_EXTENSION"
      | "INVALID_SIGNATURE"
      | "NOT_A_FILE"
      | "EMPTY_FILE"
      | "FILE_UNAVAILABLE"
      | "READ_ERROR",
    message: string,
    readonly sourcePath: string,
  ) {
    super(message);
    this.name = "MediaFileInspectionError";
  }
}

const SUPPORTED_MEDIA_FORMATS: Readonly<Record<string, SupportedMediaFormat>> =
  Object.freeze({
    mp4: { kind: "video", mimeType: "video/mp4", signature: "isobmff" },
    m4v: { kind: "video", mimeType: "video/x-m4v", signature: "isobmff" },
    mov: { kind: "video", mimeType: "video/quicktime", signature: "isobmff" },
    mkv: { kind: "video", mimeType: "video/x-matroska", signature: "ebml" },
    webm: { kind: "video", mimeType: "video/webm", signature: "ebml" },
    avi: { kind: "video", mimeType: "video/x-msvideo", signature: "riff-avi" },
    mp3: { kind: "audio", mimeType: "audio/mpeg", signature: "mp3" },
    wav: { kind: "audio", mimeType: "audio/wav", signature: "riff-wave" },
    m4a: { kind: "audio", mimeType: "audio/mp4", signature: "isobmff" },
    aac: { kind: "audio", mimeType: "audio/aac", signature: "aac" },
    flac: { kind: "audio", mimeType: "audio/flac", signature: "flac" },
    ogg: { kind: "audio", mimeType: "audio/ogg", signature: "ogg" },
    opus: { kind: "audio", mimeType: "audio/opus", signature: "ogg" },
    png: { kind: "image", mimeType: "image/png", signature: "png" },
    jpg: { kind: "image", mimeType: "image/jpeg", signature: "jpeg" },
    jpeg: { kind: "image", mimeType: "image/jpeg", signature: "jpeg" },
    webp: { kind: "image", mimeType: "image/webp", signature: "riff-webp" },
    gif: { kind: "image", mimeType: "image/gif", signature: "gif" },
    bmp: { kind: "image", mimeType: "image/bmp", signature: "bmp" },
  });

const SUPPORTED_MEDIA_EXTENSIONS = Object.freeze(
  Object.keys(SUPPORTED_MEDIA_FORMATS).sort(),
);

function startsWithBytes(buffer: Buffer, values: readonly number[]): boolean {
  return values.every((value, index) => buffer[index] === value);
}

function ascii(buffer: Buffer, start: number, end: number): string {
  return buffer.subarray(start, end).toString("ascii");
}

function hasValidSignature(
  header: Buffer,
  signature: SupportedMediaFormat["signature"],
): boolean {
  switch (signature) {
    case "isobmff":
      return header.length >= 12 && ascii(header, 4, 8) === "ftyp";
    case "ebml":
      return startsWithBytes(header, [0x1a, 0x45, 0xdf, 0xa3]);
    case "riff-avi":
      return ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 12) === "AVI ";
    case "riff-wave":
      return ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 12) === "WAVE";
    case "riff-webp":
      return ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 12) === "WEBP";
    case "png":
      return startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      return startsWithBytes(header, [0xff, 0xd8, 0xff]);
    case "gif":
      return ascii(header, 0, 6) === "GIF87a" || ascii(header, 0, 6) === "GIF89a";
    case "bmp":
      return ascii(header, 0, 2) === "BM";
    case "mp3":
      return (
        ascii(header, 0, 3) === "ID3" ||
        (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
      );
    case "flac":
      return ascii(header, 0, 4) === "fLaC";
    case "ogg":
      return ascii(header, 0, 4) === "OggS";
    case "aac":
      return header[0] === 0xff && (header[1] & 0xf6) === 0xf0;
  }
}

async function readHeader(path: string): Promise<Buffer> {
  const handle = await open(path, "r");

  try {
    const buffer = Buffer.alloc(64);
    const result = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

async function calculateSha256(path: string): Promise<string> {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}

async function inspectMediaFile(inputPath: string): Promise<InspectedMediaFile> {
  let resolvedPath: string;

  try {
    resolvedPath = await realpath(inputPath);
  } catch (error) {
    throw new MediaFileInspectionError(
      "FILE_UNAVAILABLE",
      "El archivo ya no está disponible en la ubicación seleccionada.",
      inputPath,
    );
  }

  const extension = extname(resolvedPath).slice(1).toLowerCase();
  const format = SUPPORTED_MEDIA_FORMATS[extension];

  if (!format) {
    throw new MediaFileInspectionError(
      "UNSUPPORTED_EXTENSION",
      `La extensión .${extension || "desconocida"} no está permitida.`,
      resolvedPath,
    );
  }

  try {
    const fileStats = await stat(resolvedPath);

    if (!fileStats.isFile()) {
      throw new MediaFileInspectionError(
        "NOT_A_FILE",
        "La selección no corresponde a un archivo regular.",
        resolvedPath,
      );
    }

    if (fileStats.size <= 0) {
      throw new MediaFileInspectionError(
        "EMPTY_FILE",
        "El archivo está vacío y no puede importarse.",
        resolvedPath,
      );
    }

    if (!Number.isSafeInteger(fileStats.size)) {
      throw new MediaFileInspectionError(
        "READ_ERROR",
        "El tamaño del archivo supera el rango seguro de la aplicación.",
        resolvedPath,
      );
    }

    const header = await readHeader(resolvedPath);

    if (!hasValidSignature(header, format.signature)) {
      throw new MediaFileInspectionError(
        "INVALID_SIGNATURE",
        "El contenido del archivo no coincide con su extensión.",
        resolvedPath,
      );
    }

    return Object.freeze({
      fileName: basename(resolvedPath),
      sourcePath: resolvedPath,
      extension,
      mimeType: format.mimeType,
      kind: format.kind,
      sizeBytes: fileStats.size,
      sourceModifiedAt: fileStats.mtime.toISOString(),
      contentHash: await calculateSha256(resolvedPath),
    });
  } catch (error) {
    if (error instanceof MediaFileInspectionError) {
      throw error;
    }

    throw new MediaFileInspectionError(
      "READ_ERROR",
      "No fue posible leer o verificar el archivo seleccionado.",
      resolvedPath,
    );
  }
}

export {
  SUPPORTED_MEDIA_EXTENSIONS,
  SUPPORTED_MEDIA_FORMATS,
  MediaFileInspectionError,
  calculateSha256,
  hasValidSignature,
  inspectMediaFile,
  type InspectedMediaFile,
  type SupportedMediaFormat,
};
