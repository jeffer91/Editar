/* =========================================================
Nombre completo: media-derivative-service.ts
Ruta o ubicación: /apps/desktop/main/media/media-derivative-service.ts

Función o funciones:
- Planificar proxies, miniaturas y formas de onda según el medio.
- Reutilizar archivos válidos y evitar trabajos duplicados.
- Crear trabajos FFmpeg con rutas y argumentos internos seguros.
========================================================= */

import { createHash } from "node:crypto";
import {
  createEntityId,
  createJob,
  type EntityId,
  type JobKind,
  type JobRecord,
  type JobStatus,
  type MediaAsset,
} from "../../shared/domain/index.js";
import type {
  GeneratedDerivativeType,
  MediaDerivativeRequestResult,
} from "../../shared/media-cache-contracts.js";
import type { JobQueueRepository } from "../../shared/persistence/job-queue-repository.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
import {
  MediaToolUnavailableError,
  type MediaEngineProvider,
} from "./ffmpeg-binary-service.js";
import { MediaCachePaths } from "./media-cache-paths.js";

const CACHE_GENERATOR_VERSION = "editar-cache-v1";
const ACTIVE_JOB_STATUSES: readonly JobStatus[] = Object.freeze([
  "pending",
  "preparing",
  "running",
  "paused",
]);

const JOB_KIND_BY_DERIVATIVE: Readonly<Record<GeneratedDerivativeType, JobKind>> =
  Object.freeze({
    proxy: "generate-proxy",
    thumbnail: "generate-thumbnails",
    waveform: "generate-waveform",
  });

const PRIORITY_BY_DERIVATIVE: Readonly<Record<GeneratedDerivativeType, number>> =
  Object.freeze({
    thumbnail: 80,
    waveform: 70,
    proxy: 60,
  });

interface QueueWakeUp {
  wake(): void;
}

interface MediaDerivativeServiceOptions {
  readonly projects: ProjectRepository;
  readonly media: MediaAssetRepository;
  readonly jobs: JobQueueRepository;
  readonly engines: MediaEngineProvider;
  readonly queue: QueueWakeUp;
  readonly paths: MediaCachePaths;
}

interface MediaDerivativeScheduler {
  enqueueForAsset(
    asset: MediaAsset,
    dependencyIds?: readonly EntityId<"job">[],
  ): Promise<MediaDerivativeRequestResult>;
}

class MediaDerivativeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaDerivativeConflictError";
  }
}

function plannedDerivativeTypes(asset: MediaAsset): readonly GeneratedDerivativeType[] {
  if (asset.inspection.status !== "ready" || !asset.metadata) {
    return Object.freeze([]);
  }

  if (asset.metadata.kind === "image") {
    return Object.freeze(["thumbnail"]);
  }

  if (asset.metadata.kind === "audio") {
    return Object.freeze(["waveform"]);
  }

  return Object.freeze(
    asset.metadata.audio
      ? ["proxy", "thumbnail", "waveform"]
      : ["proxy", "thumbnail"],
  );
}

function derivativeCacheKey(
  asset: MediaAsset,
  type: GeneratedDerivativeType,
  ffmpegVersion: string,
): string {
  const sourceFingerprint =
    asset.contentHash ??
    `${asset.sourcePath}|${asset.sizeBytes}|${asset.sourceModifiedAt ?? "unknown"}`;
  const payload = JSON.stringify({
    version: CACHE_GENERATOR_VERSION,
    type,
    sourceFingerprint,
    metadata: asset.metadata,
    ffmpegVersion,
  });

  return createHash("sha256").update(payload).digest("hex");
}

function isActiveDerivativeJob(
  job: JobRecord,
  mediaId: EntityId<"media">,
  type: GeneratedDerivativeType,
): boolean {
  return (
    job.kind === JOB_KIND_BY_DERIVATIVE[type] &&
    ACTIVE_JOB_STATUSES.includes(job.status) &&
    job.payload.mediaId === mediaId &&
    job.payload.derivativeType === type
  );
}

function thumbnailSeekUs(asset: MediaAsset): number {
  if (!asset.metadata || asset.metadata.kind === "image") {
    return 0;
  }

  const durationUs = Number(asset.metadata.durationUs);
  return Math.max(0, Math.min(Math.round(durationUs * 0.1), 5_000_000));
}

class MediaDerivativeService implements MediaDerivativeScheduler {
  constructor(private readonly options: MediaDerivativeServiceOptions) {}

  async enqueue(
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
  ): Promise<MediaDerivativeRequestResult> {
    const asset = await this.options.media.findById(mediaId);

    if (!asset || asset.projectId !== projectId) {
      throw new MediaDerivativeConflictError(
        "El recurso multimedia no pertenece al proyecto seleccionado.",
      );
    }

    return this.enqueueForAsset(asset);
  }

  async enqueueForAsset(
    asset: MediaAsset,
    dependencyIds: readonly EntityId<"job">[] = [],
  ): Promise<MediaDerivativeRequestResult> {
    const project = await this.options.projects.findById(asset.projectId);

    if (!project) {
      throw new ProjectNotFoundError(asset.projectId);
    }

    if (project.project.status === "archived") {
      throw new MediaDerivativeConflictError(
        "Restaura el proyecto antes de generar archivos optimizados.",
      );
    }

    if (asset.availability !== "online") {
      throw new MediaDerivativeConflictError(
        "El archivo original no está disponible en su ruta registrada.",
      );
    }

    const requestedTypes = plannedDerivativeTypes(asset);

    if (requestedTypes.length === 0) {
      throw new MediaDerivativeConflictError(
        "El recurso debe completar primero su análisis técnico.",
      );
    }

    let ffmpeg;

    try {
      ffmpeg = await this.options.engines.getCommand("ffmpeg");
    } catch (error) {
      if (error instanceof MediaToolUnavailableError) {
        throw new MediaDerivativeConflictError(error.message);
      }

      throw error;
    }

    const queueItems = await this.options.jobs.list(asset.projectId);
    const jobs = queueItems.map((item) => item.job);
    const newJobs: JobRecord[] = [];
    const existingJobIds: EntityId<"job">[] = [];
    let reusedCount = 0;
    let skippedCount = 0;

    for (const type of requestedTypes) {
      const cacheKey = derivativeCacheKey(asset, type, ffmpeg.version);
      const existing = asset.derivatives.find(
        (derivative) =>
          derivative.type === type && derivative.cacheKey === cacheKey,
      );

      if (existing && (await this.options.paths.exists(existing.path))) {
        reusedCount += 1;
        continue;
      }

      const active = jobs.find((job) => isActiveDerivativeJob(job, asset.id, type));

      if (active) {
        skippedCount += 1;
        existingJobIds.push(active.id);
        continue;
      }

      const jobId = createEntityId("job");
      const derivativeId = createEntityId("derivative");
      const outputPath = this.options.paths.resolveDerivativePath(
        asset.projectId,
        asset.id,
        type,
        cacheKey,
      );
      const temporaryPath = this.options.paths.resolveTemporaryPath(outputPath, jobId);
      await this.options.paths.prepareOutput(outputPath);

      const job = createJob({
        id: jobId,
        projectId: asset.projectId,
        kind: JOB_KIND_BY_DERIVATIVE[type],
        priority: PRIORITY_BY_DERIVATIVE[type],
        dependencyIds,
        maxAttempts: 2,
        payload: {
          mediaId: asset.id,
          derivativeId,
          derivativeType: type,
          sourcePath: asset.sourcePath,
          expectedKind: asset.kind,
          outputPath,
          temporaryPath,
          cacheKey,
          durationUs:
            asset.metadata.kind === "image"
              ? 0
              : Number(asset.metadata.durationUs),
          thumbnailSeekUs: thumbnailSeekUs(asset),
          ffmpegCommand: ffmpeg.command,
          ffmpegArgumentsPrefix: [...ffmpeg.argumentsPrefix],
          ffmpegVersion: ffmpeg.version,
          generatorVersion: CACHE_GENERATOR_VERSION,
        },
      });

      await this.options.jobs.insert(job);
      newJobs.push(job);
    }

    if (newJobs.length > 0) {
      this.options.queue.wake();
    }

    const queuedCount = newJobs.length;
    const message =
      queuedCount > 0
        ? `${queuedCount} archivo${queuedCount === 1 ? "" : "s"} optimizado${queuedCount === 1 ? "" : "s"} agregado${queuedCount === 1 ? "" : "s"} a la cola.`
        : reusedCount > 0 && skippedCount === 0
          ? "Los derivados disponibles ya coinciden con el medio original."
          : "Los derivados restantes ya tienen trabajos pendientes o en ejecución.";

    return Object.freeze({
      queuedCount,
      reusedCount,
      skippedCount,
      jobIds: Object.freeze([
        ...newJobs.map((job) => job.id),
        ...existingJobIds,
      ]),
      requestedTypes,
      message,
    });
  }
}

export {
  ACTIVE_JOB_STATUSES,
  CACHE_GENERATOR_VERSION,
  JOB_KIND_BY_DERIVATIVE,
  MediaDerivativeConflictError,
  MediaDerivativeService,
  derivativeCacheKey,
  isActiveDerivativeJob,
  plannedDerivativeTypes,
  thumbnailSeekUs,
  type MediaDerivativeScheduler,
  type MediaDerivativeServiceOptions,
};
