/* =========================================================
Nombre completo: media-analysis-service.ts
Ruta o ubicación: /apps/desktop/main/media/media-analysis-service.ts

Función o funciones:
- Crear trabajos persistentes de análisis con FFprobe.
- Evitar análisis duplicados para el mismo recurso.
- Exponer el estado real de FFmpeg y FFprobe.
========================================================= */

import {
  createJob,
  updateMediaInspection,
  type EntityId,
  type JobRecord,
} from "../../shared/domain/index.js";
import type {
  MediaAnalysisRequestResult,
  MediaEngineStatus,
} from "../../shared/media-engine-contracts.js";
import type { JobQueueRepository } from "../../shared/persistence/job-queue-repository.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
import {
  FfmpegBinaryService,
  MediaToolUnavailableError,
} from "./ffmpeg-binary-service.js";

interface QueueWakeUp {
  wake(): void;
}

interface MediaAnalysisServiceOptions {
  readonly projects: ProjectRepository;
  readonly media: MediaAssetRepository;
  readonly jobs: JobQueueRepository;
  readonly engines: FfmpegBinaryService;
  readonly queue: QueueWakeUp;
}

class MediaAnalysisConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaAnalysisConflictError";
  }
}

function isActiveProbeForMedia(
  job: JobRecord,
  mediaId: EntityId<"media">,
): boolean {
  return (
    job.kind === "probe-media" &&
    ["pending", "preparing", "running", "paused"].includes(job.status) &&
    job.payload.mediaId === mediaId
  );
}

class MediaAnalysisService {
  constructor(private readonly options: MediaAnalysisServiceOptions) {}

  getEngineStatus(force = false): Promise<MediaEngineStatus> {
    return this.options.engines.getStatus(force);
  }

  async enqueue(
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
  ): Promise<MediaAnalysisRequestResult> {
    const project = await this.options.projects.findById(projectId);

    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    if (project.project.status === "archived") {
      throw new MediaAnalysisConflictError(
        "Restaura el proyecto antes de analizar sus archivos.",
      );
    }

    const asset = await this.options.media.findById(mediaId);

    if (!asset || asset.projectId !== projectId) {
      throw new MediaAnalysisConflictError(
        "El recurso multimedia no pertenece al proyecto seleccionado.",
      );
    }

    if (asset.availability !== "online") {
      throw new MediaAnalysisConflictError(
        "El archivo original no está disponible en su ruta registrada.",
      );
    }

    const items = await this.options.jobs.list(projectId);
    const existing = items.find((item) => isActiveProbeForMedia(item.job, mediaId));

    if (existing) {
      return Object.freeze({
        queued: false,
        jobId: existing.job.id,
        message: "El recurso ya tiene un análisis pendiente o en ejecución.",
      });
    }

    let ffprobe;

    try {
      ffprobe = await this.options.engines.getCommand("ffprobe");
    } catch (error) {
      if (error instanceof MediaToolUnavailableError) {
        throw new MediaAnalysisConflictError(error.message);
      }

      throw error;
    }

    const pendingAsset = updateMediaInspection(asset, {
      inspection: { status: "pending" },
      availability: "online",
    });
    await this.options.media.update(pendingAsset);

    const job = createJob({
      projectId,
      kind: "probe-media",
      priority: 85,
      maxAttempts: 2,
      payload: {
        mediaId,
        sourcePath: asset.sourcePath,
        expectedKind: asset.kind,
        ffprobeCommand: ffprobe.command,
        ffprobeArgumentsPrefix: [...ffprobe.argumentsPrefix],
        ffprobeVersion: ffprobe.version,
      },
    });

    await this.options.jobs.insert(job);
    this.options.queue.wake();

    return Object.freeze({
      queued: true,
      jobId: job.id,
      message: "El análisis técnico fue agregado a la cola.",
    });
  }
}

export {
  MediaAnalysisConflictError,
  MediaAnalysisService,
  isActiveProbeForMedia,
  type MediaAnalysisServiceOptions,
  type QueueWakeUp,
};
