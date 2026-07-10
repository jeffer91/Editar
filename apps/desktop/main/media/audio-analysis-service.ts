/* =========================================================
Nombre completo: audio-analysis-service.ts
Ruta o ubicación: /apps/desktop/main/media/audio-analysis-service.ts

Función o funciones:
- Crear trabajos persistentes de detección de silencios.
- Reutilizar análisis equivalentes y evitar trabajos duplicados.
- Resolver FFmpeg y parámetros únicamente en el proceso principal.
========================================================= */

import { createHash } from "node:crypto";
import {
  DEFAULT_SILENCE_DETECTION_SETTINGS,
  createJob,
  validateSilenceDetectionSettings,
  type EntityId,
  type JobRecord,
  type MediaAsset,
  type SilenceDetectionSettings,
} from "../../shared/domain/index.js";
import type {
  AudioAnalysisRequestResult,
} from "../../shared/audio-processing-contracts.js";
import type { JobQueueRepository } from "../../shared/persistence/job-queue-repository.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
import {
  MediaToolUnavailableError,
  type MediaEngineProvider,
} from "./ffmpeg-binary-service.js";

interface QueueWakeUp {
  wake(): void;
}

interface AudioAnalysisServiceOptions {
  readonly projects: ProjectRepository;
  readonly media: MediaAssetRepository;
  readonly jobs: JobQueueRepository;
  readonly engines: MediaEngineProvider;
  readonly queue: QueueWakeUp;
}

interface AudioAnalysisScheduler {
  enqueueForAsset(
    asset: MediaAsset,
    settings?: SilenceDetectionSettings,
    dependencyIds?: readonly EntityId<"job">[],
  ): Promise<AudioAnalysisRequestResult>;
}

class AudioAnalysisConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioAnalysisConflictError";
  }
}

function hasAudioStream(asset: MediaAsset): boolean {
  return Boolean(
    asset.metadata &&
      (asset.metadata.kind === "audio" ||
        (asset.metadata.kind === "video" && asset.metadata.audio)),
  );
}

function audioAnalysisSourceKey(
  asset: MediaAsset,
  settings: SilenceDetectionSettings,
  ffmpegVersion: string,
): string {
  const sourceFingerprint =
    asset.contentHash ??
    `${asset.sourcePath}|${asset.sizeBytes}|${asset.sourceModifiedAt ?? "unknown"}`;

  return createHash("sha256")
    .update(
      JSON.stringify({
        version: "editar-silence-analysis-v1",
        sourceFingerprint,
        durationUs:
          asset.metadata && asset.metadata.kind !== "image"
            ? asset.metadata.durationUs
            : 0,
        thresholdDb: settings.thresholdDb,
        minSilenceUs: settings.minSilenceUs,
        ffmpegVersion,
      }),
    )
    .digest("hex");
}

function isActiveAudioAnalysisJob(
  job: JobRecord,
  mediaId: EntityId<"media">,
  sourceKey: string,
): boolean {
  return (
    job.kind === "detect-silence" &&
    ["pending", "preparing", "running", "paused"].includes(job.status) &&
    job.payload.mediaId === mediaId &&
    job.payload.sourceKey === sourceKey
  );
}

class AudioAnalysisService implements AudioAnalysisScheduler {
  constructor(private readonly options: AudioAnalysisServiceOptions) {}

  async enqueue(
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
    settings: SilenceDetectionSettings = DEFAULT_SILENCE_DETECTION_SETTINGS,
  ): Promise<AudioAnalysisRequestResult> {
    const asset = await this.options.media.findById(mediaId);

    if (!asset || asset.projectId !== projectId) {
      throw new AudioAnalysisConflictError(
        "El recurso multimedia no pertenece al proyecto seleccionado.",
      );
    }

    return this.enqueueForAsset(asset, settings);
  }

  async enqueueForAsset(
    asset: MediaAsset,
    settings: SilenceDetectionSettings = DEFAULT_SILENCE_DETECTION_SETTINGS,
    dependencyIds: readonly EntityId<"job">[] = [],
  ): Promise<AudioAnalysisRequestResult> {
    const project = await this.options.projects.findById(asset.projectId);

    if (!project) {
      throw new ProjectNotFoundError(asset.projectId);
    }

    if (project.project.status === "archived") {
      throw new AudioAnalysisConflictError(
        "Restaura el proyecto antes de analizar su audio.",
      );
    }

    if (asset.availability !== "online") {
      throw new AudioAnalysisConflictError(
        "El archivo original no está disponible en su ruta registrada.",
      );
    }

    if (asset.inspection.status !== "ready" || !asset.metadata) {
      throw new AudioAnalysisConflictError(
        "El recurso debe completar primero su análisis técnico.",
      );
    }

    if (!hasAudioStream(asset)) {
      throw new AudioAnalysisConflictError(
        "El recurso seleccionado no contiene un stream de audio.",
      );
    }

    const validatedSettings = validateSilenceDetectionSettings(settings);
    let ffmpeg;

    try {
      ffmpeg = await this.options.engines.getCommand("ffmpeg");
    } catch (error) {
      if (error instanceof MediaToolUnavailableError) {
        throw new AudioAnalysisConflictError(error.message);
      }

      throw error;
    }

    const sourceKey = audioAnalysisSourceKey(
      asset,
      validatedSettings,
      ffmpeg.version,
    );

    if (asset.audioAnalysis?.sourceKey === sourceKey) {
      return Object.freeze({
        queued: false,
        reused: true,
        jobId: null,
        message: "El análisis acústico actual ya utiliza estos parámetros.",
      });
    }

    const items = await this.options.jobs.list(asset.projectId);
    const existing = items.find((item) =>
      isActiveAudioAnalysisJob(item.job, asset.id, sourceKey),
    );

    if (existing) {
      return Object.freeze({
        queued: false,
        reused: false,
        jobId: existing.job.id,
        message: "El análisis acústico ya está pendiente o en ejecución.",
      });
    }

    const durationUs =
      asset.metadata.kind === "image" ? 0 : Number(asset.metadata.durationUs);
    const job = createJob({
      projectId: asset.projectId,
      kind: "detect-silence",
      priority: 68,
      dependencyIds,
      maxAttempts: 2,
      payload: {
        mediaId: asset.id,
        sourcePath: asset.sourcePath,
        sourceKey,
        durationUs,
        thresholdDb: validatedSettings.thresholdDb,
        minSilenceUs: Number(validatedSettings.minSilenceUs),
        ffmpegCommand: ffmpeg.command,
        ffmpegArgumentsPrefix: [...ffmpeg.argumentsPrefix],
        ffmpegVersion: ffmpeg.version,
      },
    });

    await this.options.jobs.insert(job);
    this.options.queue.wake();

    return Object.freeze({
      queued: true,
      reused: false,
      jobId: job.id,
      message: "La detección de silencios fue agregada a la cola.",
    });
  }
}

export {
  AudioAnalysisConflictError,
  AudioAnalysisService,
  audioAnalysisSourceKey,
  hasAudioStream,
  isActiveAudioAnalysisJob,
  type AudioAnalysisScheduler,
  type AudioAnalysisServiceOptions,
  type QueueWakeUp,
};
