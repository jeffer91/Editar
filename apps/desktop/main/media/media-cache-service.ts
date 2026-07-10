/* =========================================================
Nombre completo: media-cache-service.ts
Ruta o ubicación: /apps/desktop/main/media/media-cache-service.ts

Función o funciones:
- Diagnosticar tamaño, archivos y derivados de la caché.
- Reconciliar SQLite con archivos existentes y eliminar huérfanos.
- Limpiar la caché sin interferir con trabajos multimedia activos.
========================================================= */

import {
  clearMediaDerivatives,
  retainMediaDerivatives,
  type JobKind,
  type JobStatus,
  type MediaAsset,
} from "../../shared/domain/index.js";
import type {
  MediaCacheClearResult,
  MediaCacheStatus,
} from "../../shared/media-cache-contracts.js";
import type { JobQueueRepository } from "../../shared/persistence/job-queue-repository.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import { MediaCachePaths } from "./media-cache-paths.js";

const CACHE_JOB_KINDS: readonly JobKind[] = Object.freeze([
  "generate-proxy",
  "generate-waveform",
  "generate-thumbnails",
]);
const BLOCKING_STATUSES: readonly JobStatus[] = Object.freeze([
  "pending",
  "preparing",
  "running",
  "paused",
]);

class MediaCacheConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaCacheConflictError";
  }
}

interface MediaCacheServiceOptions {
  readonly paths: MediaCachePaths;
  readonly media: MediaAssetRepository;
  readonly jobs: JobQueueRepository;
}

class MediaCacheService {
  constructor(private readonly options: MediaCacheServiceOptions) {}

  async getStatus(): Promise<MediaCacheStatus> {
    const [scan, assets] = await Promise.all([
      this.options.paths.scan(),
      this.options.media.listAll(),
    ]);
    const referencedPaths = this.referencedPaths(assets);
    const orphanFileCount = scan.files.filter(
      (file) => !file.temporary && !referencedPaths.has(file.path),
    ).length;

    return Object.freeze({
      rootPath: this.options.paths.rootPath,
      totalBytes: scan.totalBytes,
      fileCount: scan.files.length,
      derivativeCount: assets.reduce(
        (total, asset) => total + asset.derivatives.length,
        0,
      ),
      temporaryFileCount: scan.temporaryFileCount,
      orphanFileCount,
      lastScannedAt: new Date().toISOString(),
    });
  }

  async reconcile(): Promise<MediaCacheStatus> {
    await this.options.paths.ensureRoot();
    await this.options.paths.removeTemporaryFiles();
    const assets = await this.options.media.listAll();
    const referencedPaths = new Set<string>();

    for (const asset of assets) {
      const retained = [] as MediaAsset["derivatives"][number][];

      for (const derivative of asset.derivatives) {
        if (
          this.options.paths.isManagedPath(derivative.path) &&
          (await this.options.paths.exists(derivative.path))
        ) {
          retained.push(derivative);
          referencedPaths.add(this.options.paths.assertManagedPath(derivative.path));
        }
      }

      const updated = retainMediaDerivatives(asset, (derivative) =>
        retained.some((candidate) => candidate.id === derivative.id),
      );

      if (updated !== asset) {
        await this.options.media.update(updated);
      }
    }

    const scan = await this.options.paths.scan();
    const orphans = scan.files.filter(
      (file) => !file.temporary && !referencedPaths.has(file.path),
    );

    await Promise.allSettled(
      orphans.map((file) => this.options.paths.removeFile(file.path)),
    );

    return this.getStatus();
  }

  async clear(): Promise<MediaCacheClearResult> {
    const activeJobs = await this.options.jobs.listByStatuses(BLOCKING_STATUSES);
    const cacheJobs = activeJobs.filter((job) => CACHE_JOB_KINDS.includes(job.kind));

    if (cacheJobs.length > 0) {
      throw new MediaCacheConflictError(
        "Cancela o finaliza los trabajos de proxy, miniatura y forma de onda antes de limpiar la caché.",
      );
    }

    const [before, assets] = await Promise.all([
      this.options.paths.scan(),
      this.options.media.listAll(),
    ]);
    const removedDerivatives = assets.reduce(
      (total, asset) => total + asset.derivatives.length,
      0,
    );

    await this.options.paths.clear();

    for (const asset of assets) {
      if (asset.derivatives.length > 0) {
        await this.options.media.update(clearMediaDerivatives(asset));
      }
    }

    return Object.freeze({
      removedBytes: before.totalBytes,
      removedFiles: before.files.length,
      removedDerivatives,
      completedAt: new Date().toISOString(),
      status: await this.getStatus(),
    });
  }

  private referencedPaths(assets: readonly MediaAsset[]): ReadonlySet<string> {
    const paths = new Set<string>();

    for (const asset of assets) {
      for (const derivative of asset.derivatives) {
        if (this.options.paths.isManagedPath(derivative.path)) {
          paths.add(this.options.paths.assertManagedPath(derivative.path));
        }
      }
    }

    return paths;
  }
}

export {
  BLOCKING_STATUSES,
  CACHE_JOB_KINDS,
  MediaCacheConflictError,
  MediaCacheService,
  type MediaCacheServiceOptions,
};
