/* =========================================================
Nombre completo: media-cache-contracts.ts
Ruta o ubicación: /apps/desktop/shared/media-cache-contracts.ts

Función o funciones:
- Definir generación de proxies, miniaturas y formas de onda.
- Exponer diagnóstico y limpieza controlada de la caché.
- Compartir contratos seguros entre main, preload y renderer.
========================================================= */

import type {
  EntityId,
  MediaDerivative,
} from "./domain/index.js";
import type { IpcResult } from "./ipc-contracts.js";

type GeneratedDerivativeType = Extract<
  MediaDerivative["type"],
  "proxy" | "thumbnail" | "waveform"
>;

interface GenerateMediaDerivativesInput {
  readonly projectId: EntityId<"project">;
  readonly mediaId: EntityId<"media">;
}

interface MediaDerivativeRequestResult {
  readonly queuedCount: number;
  readonly reusedCount: number;
  readonly skippedCount: number;
  readonly jobIds: readonly EntityId<"job">[];
  readonly requestedTypes: readonly GeneratedDerivativeType[];
  readonly message: string;
}

interface MediaCacheStatus {
  readonly rootPath: string;
  readonly totalBytes: number;
  readonly fileCount: number;
  readonly derivativeCount: number;
  readonly temporaryFileCount: number;
  readonly orphanFileCount: number;
  readonly lastScannedAt: string;
}

interface MediaCacheClearResult {
  readonly removedBytes: number;
  readonly removedFiles: number;
  readonly removedDerivatives: number;
  readonly completedAt: string;
  readonly status: MediaCacheStatus;
}

interface MediaCacheBridge {
  generateDerivatives(
    input: GenerateMediaDerivativesInput,
  ): Promise<IpcResult<MediaDerivativeRequestResult>>;
  getCacheStatus(): Promise<IpcResult<MediaCacheStatus>>;
  clearCache(): Promise<IpcResult<MediaCacheClearResult>>;
}

function createDerivativeUrl(derivativeId: EntityId<"derivative">): string {
  return `editar-cache://derivative/${encodeURIComponent(derivativeId)}`;
}

export {
  createDerivativeUrl,
  type GeneratedDerivativeType,
  type GenerateMediaDerivativesInput,
  type MediaCacheBridge,
  type MediaCacheClearResult,
  type MediaCacheStatus,
  type MediaDerivativeRequestResult,
};
