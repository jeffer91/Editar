/* =========================================================
Nombre completo: media-derivative-job-handler.ts
Ruta o ubicación: /apps/desktop/main/jobs/media-derivative-job-handler.ts

Función o funciones:
- Validar y persistir derivados producidos por FFmpeg.
- Reemplazar por tipo sin perder el derivado anterior antes del éxito.
- Limpiar archivos temporales y salidas huérfanas en fallos o reintentos.
========================================================= */

import {
  parseEntityId,
  upsertMediaDerivative,
  type EntityId,
  type JobErrorInfo,
  type JobKind,
  type JobRecord,
  type JsonValue,
  type MediaDerivative,
} from "../../shared/domain/index.js";
import type { GeneratedDerivativeType } from "../../shared/media-cache-contracts.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import { MediaCachePaths } from "../media/media-cache-paths.js";
import type { JobResultHandler } from "./job-result-handler.js";

const DERIVATIVE_JOB_KINDS: readonly JobKind[] = Object.freeze([
  "generate-proxy",
  "generate-waveform",
  "generate-thumbnails",
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  message: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }

  return value.trim();
}

function mediaIdFromDerivativeJob(job: JobRecord): EntityId<"media"> {
  return parseEntityId(
    requiredString(
      job.payload.mediaId,
      "El trabajo no contiene un identificador de medio válido.",
    ),
    "media",
  );
}

function derivativeFromResult(
  job: JobRecord,
  result: Readonly<Record<string, JsonValue>> | undefined,
  paths: MediaCachePaths,
): MediaDerivative {
  const raw = result?.derivative;

  if (!isRecord(raw)) {
    throw new Error("FFmpeg terminó sin devolver un derivado válido.");
  }

  const id = parseEntityId(
    requiredString(raw.id, "El derivado no contiene un identificador válido."),
    "derivative",
  );
  const type = requiredString(
    raw.type,
    "El derivado no contiene un tipo válido.",
  ) as GeneratedDerivativeType;

  if (!["proxy", "thumbnail", "waveform"].includes(type)) {
    throw new Error("El tipo del derivado no está permitido.");
  }

  const path = paths.assertManagedPath(
    requiredString(raw.path, "El derivado no contiene una ruta válida."),
  );
  const expectedPath = paths.assertManagedPath(
    requiredString(job.payload.outputPath, "El trabajo no contiene su ruta de salida."),
  );

  if (path !== expectedPath) {
    throw new Error("La ruta devuelta por FFmpeg no coincide con el plan de caché.");
  }

  return Object.freeze({
    id,
    type,
    path,
    cacheKey: requiredString(
      raw.cacheKey,
      "El derivado no contiene una clave de caché válida.",
    ),
    createdAt: requiredString(
      raw.createdAt,
      "El derivado no contiene una fecha válida.",
    ) as MediaDerivative["createdAt"],
  });
}

class MediaDerivativeJobHandler implements JobResultHandler {
  constructor(
    private readonly media: MediaAssetRepository,
    private readonly paths: MediaCachePaths,
  ) {}

  async complete(
    job: JobRecord,
    result: Readonly<Record<string, JsonValue>> | undefined,
  ): Promise<void> {
    if (!DERIVATIVE_JOB_KINDS.includes(job.kind)) {
      return;
    }

    const mediaId = mediaIdFromDerivativeJob(job);
    const asset = await this.media.findById(mediaId);

    if (!asset) {
      throw new Error("El recurso del derivado ya no existe en la base local.");
    }

    const derivative = derivativeFromResult(job, result, this.paths);

    if (!(await this.paths.exists(derivative.path))) {
      throw new Error("El archivo derivado no existe o quedó vacío.");
    }

    const previous = asset.derivatives.find(
      (current) => current.type === derivative.type,
    );
    await this.media.update(upsertMediaDerivative(asset, derivative));

    if (previous && previous.path !== derivative.path && this.paths.isManagedPath(previous.path)) {
      await this.paths.removeFile(previous.path).catch(() => undefined);
    }
  }

  async fail(job: JobRecord, _error: JobErrorInfo): Promise<void> {
    if (DERIVATIVE_JOB_KINDS.includes(job.kind)) {
      await this.cleanupJobArtifacts(job);
    }
  }

  async prepareRetry(job: JobRecord): Promise<void> {
    if (DERIVATIVE_JOB_KINDS.includes(job.kind)) {
      await this.cleanupJobArtifacts(job);
    }
  }

  private async cleanupJobArtifacts(job: JobRecord): Promise<void> {
    const temporaryPath = job.payload.temporaryPath;

    if (typeof temporaryPath === "string" && this.paths.isManagedPath(temporaryPath)) {
      await this.paths.removeFile(temporaryPath).catch(() => undefined);
    }

    const outputPath = job.payload.outputPath;

    if (typeof outputPath !== "string" || !this.paths.isManagedPath(outputPath)) {
      return;
    }

    const mediaIdRaw = job.payload.mediaId;
    const asset =
      typeof mediaIdRaw === "string"
        ? await this.media.findById(parseEntityId(mediaIdRaw, "media"))
        : null;
    const outputIsRegistered = asset?.derivatives.some(
      (derivative) => derivative.path === outputPath,
    );

    if (!outputIsRegistered) {
      await this.paths.removeFile(outputPath).catch(() => undefined);
    }
  }
}

export {
  DERIVATIVE_JOB_KINDS,
  MediaDerivativeJobHandler,
  derivativeFromResult,
  mediaIdFromDerivativeJob,
};
