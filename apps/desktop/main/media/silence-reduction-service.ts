/* =========================================================
Nombre completo: silence-reduction-service.ts
Ruta o ubicación: /apps/desktop/main/media/silence-reduction-service.ts

Función o funciones:
- Calcular planes de corte o reducción a partir del análisis acústico.
- Reutilizar resultados equivalentes y evitar trabajos duplicados.
- Crear trabajos FFmpeg con filtros y rutas internas seguras.
========================================================= */

import { createHash } from "node:crypto";
import {
  DEFAULT_SILENCE_REDUCTION_SETTINGS,
  createEntityId,
  createJob,
  createSilenceReductionPlan,
  type EntityId,
  type JobRecord,
  type MediaAsset,
  type SilenceReductionSettings,
} from "../../shared/domain/index.js";
import type {
  SilenceReductionRequestResult,
} from "../../shared/audio-processing-contracts.js";
import type { JobQueueRepository } from "../../shared/persistence/job-queue-repository.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
import {
  MediaToolUnavailableError,
  type MediaEngineProvider,
} from "./ffmpeg-binary-service.js";
import { MediaCachePaths } from "./media-cache-paths.js";

interface QueueWakeUp {
  wake(): void;
}

interface SilenceReductionServiceOptions {
  readonly projects: ProjectRepository;
  readonly media: MediaAssetRepository;
  readonly jobs: JobQueueRepository;
  readonly engines: MediaEngineProvider;
  readonly queue: QueueWakeUp;
  readonly paths: MediaCachePaths;
}

class SilenceReductionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SilenceReductionConflictError";
  }
}

function silenceReductionCacheKey(
  asset: MediaAsset,
  settings: SilenceReductionSettings,
  ffmpegVersion: string,
): string {
  const analysis = asset.audioAnalysis;

  if (!analysis) {
    throw new SilenceReductionConflictError(
      "El recurso todavía no tiene un análisis acústico.",
    );
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        version: "editar-silence-reduction-v1",
        source: asset.contentHash ?? asset.sourcePath,
        analysisSourceKey: analysis.sourceKey,
        mode: settings.mode,
        targetSilenceUs: settings.targetSilenceUs,
        edgePaddingUs: settings.edgePaddingUs,
        ffmpegVersion,
      }),
    )
    .digest("hex");
}

function isActiveSilenceReductionJob(
  job: JobRecord,
  mediaId: EntityId<"media">,
  cacheKey: string,
): boolean {
  return (
    job.kind === "reduce-silence" &&
    ["pending", "preparing", "running", "paused"].includes(job.status) &&
    job.payload.mediaId === mediaId &&
    job.payload.cacheKey === cacheKey
  );
}

class SilenceReductionService {
  constructor(private readonly options: SilenceReductionServiceOptions) {}

  async enqueue(
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
    settings: SilenceReductionSettings = DEFAULT_SILENCE_REDUCTION_SETTINGS,
  ): Promise<SilenceReductionRequestResult> {
    const project = await this.options.projects.findById(projectId);

    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    if (project.project.status === "archived") {
      throw new SilenceReductionConflictError(
        "Restaura el proyecto antes de reducir silencios.",
      );
    }

    const asset = await this.options.media.findById(mediaId);

    if (!asset || asset.projectId !== projectId) {
      throw new SilenceReductionConflictError(
        "El recurso multimedia no pertenece al proyecto seleccionado.",
      );
    }

    if (asset.availability !== "online") {
      throw new SilenceReductionConflictError(
        "El archivo original no está disponible en su ruta registrada.",
      );
    }

    if (!asset.audioAnalysis) {
      throw new SilenceReductionConflictError(
        "Analiza primero el audio para detectar sus silencios.",
      );
    }

    const plan = createSilenceReductionPlan({
      analysis: asset.audioAnalysis,
      settings,
    });

    if (plan.removedDurationUs <= 0) {
      return Object.freeze({
        queued: false,
        reused: true,
        jobId: null,
        removedDurationMs: 0,
        outputDurationMs: Math.round(plan.outputDurationUs / 1_000),
        cutCount: 0,
        message: "Los silencios detectados ya cumplen la configuración seleccionada.",
      });
    }

    let ffmpeg;

    try {
      ffmpeg = await this.options.engines.getCommand("ffmpeg");
    } catch (error) {
      if (error instanceof MediaToolUnavailableError) {
        throw new SilenceReductionConflictError(error.message);
      }

      throw error;
    }

    const cacheKey = silenceReductionCacheKey(asset, plan.settings, ffmpeg.version);
    const existingDerivative = asset.derivatives.find(
      (derivative) =>
        derivative.type === "silence-reduced" && derivative.cacheKey === cacheKey,
    );

    if (
      existingDerivative &&
      asset.silenceReduction?.analysisSourceKey === asset.audioAnalysis.sourceKey &&
      (await this.options.paths.exists(existingDerivative.path))
    ) {
      return Object.freeze({
        queued: false,
        reused: true,
        jobId: null,
        removedDurationMs: Math.round(plan.removedDurationUs / 1_000),
        outputDurationMs: Math.round(plan.outputDurationUs / 1_000),
        cutCount: Math.max(0, plan.keepRanges.length - 1),
        message: "La versión con silencios reducidos ya está disponible.",
      });
    }

    const items = await this.options.jobs.list(projectId);
    const existingJob = items.find((item) =>
      isActiveSilenceReductionJob(item.job, mediaId, cacheKey),
    );

    if (existingJob) {
      return Object.freeze({
        queued: false,
        reused: false,
        jobId: existingJob.job.id,
        removedDurationMs: Math.round(plan.removedDurationUs / 1_000),
        outputDurationMs: Math.round(plan.outputDurationUs / 1_000),
        cutCount: Math.max(0, plan.keepRanges.length - 1),
        message: "La reducción de silencios ya está pendiente o en ejecución.",
      });
    }

    const jobId = createEntityId("job");
    const derivativeId = createEntityId("derivative");
    const outputExtension = asset.kind === "audio" ? "m4a" : "mp4";
    const outputPath = this.options.paths.resolveDerivativePath(
      projectId,
      mediaId,
      "silence-reduced",
      cacheKey,
      outputExtension,
    );
    const temporaryPath = this.options.paths.resolveTemporaryPath(outputPath, jobId);
    const filterScriptPath = this.options.paths.resolveAuxiliaryPath(
      outputPath,
      jobId,
      "txt",
    );
    await this.options.paths.prepareOutput(outputPath);

    const job = createJob({
      id: jobId,
      projectId,
      kind: "reduce-silence",
      priority: 58,
      maxAttempts: 2,
      payload: {
        mediaId,
        derivativeId,
        derivativeType: "silence-reduced",
        sourcePath: asset.sourcePath,
        expectedKind: asset.kind,
        outputPath,
        temporaryPath,
        filterScriptPath,
        cacheKey,
        ffmpegCommand: ffmpeg.command,
        ffmpegArgumentsPrefix: [...ffmpeg.argumentsPrefix],
        ffmpegVersion: ffmpeg.version,
        plan: JSON.parse(JSON.stringify(plan)),
      },
    });

    await this.options.jobs.insert(job);
    this.options.queue.wake();

    return Object.freeze({
      queued: true,
      reused: false,
      jobId,
      removedDurationMs: Math.round(plan.removedDurationUs / 1_000),
      outputDurationMs: Math.round(plan.outputDurationUs / 1_000),
      cutCount: Math.max(0, plan.keepRanges.length - 1),
      message: "La reducción automática de silencios fue agregada a la cola.",
    });
  }
}

export {
  SilenceReductionConflictError,
  SilenceReductionService,
  isActiveSilenceReductionJob,
  silenceReductionCacheKey,
  type SilenceReductionServiceOptions,
};
