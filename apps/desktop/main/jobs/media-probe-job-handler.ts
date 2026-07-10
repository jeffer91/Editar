/* =========================================================
Nombre completo: media-probe-job-handler.ts
Ruta o ubicación: /apps/desktop/main/jobs/media-probe-job-handler.ts

Función o funciones:
- Aplicar metadatos técnicos producidos por FFprobe.
- Registrar fallos definitivos en el recurso multimedia.
- Restablecer el estado pendiente antes de un reintento.
========================================================= */

import {
  parseEntityId,
  updateMediaInspection,
  type EntityId,
  type JobErrorInfo,
  type JobRecord,
  type JsonValue,
  type MediaMetadata,
} from "../../shared/domain/index.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import type { JobResultHandler } from "./job-result-handler.js";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mediaIdFromJob(job: JobRecord): EntityId<"media"> {
  const value = job.payload.mediaId;

  if (typeof value !== "string") {
    throw new Error("El trabajo de FFprobe no contiene un identificador de medio válido.");
  }

  return parseEntityId(value, "media");
}

function metadataFromResult(
  result: Readonly<Record<string, JsonValue>> | undefined,
): MediaMetadata {
  const metadata = result?.metadata;

  if (!isRecord(metadata) || typeof metadata.kind !== "string") {
    throw new Error("FFprobe terminó sin devolver metadatos técnicos válidos.");
  }

  return metadata as unknown as MediaMetadata;
}

class MediaProbeJobHandler implements JobResultHandler {
  constructor(private readonly media: MediaAssetRepository) {}

  async complete(
    job: JobRecord,
    result: Readonly<Record<string, JsonValue>> | undefined,
  ): Promise<void> {
    if (job.kind !== "probe-media") {
      return;
    }

    const mediaId = mediaIdFromJob(job);
    const asset = await this.media.findById(mediaId);

    if (!asset) {
      throw new Error("El recurso analizado ya no existe en la base local.");
    }

    const inspectedAtRaw = result?.inspectedAt;
    const inspectedAt =
      typeof inspectedAtRaw === "string" ? inspectedAtRaw : new Date().toISOString();
    const updated = updateMediaInspection(asset, {
      inspection: {
        status: "ready",
        inspectedAt,
      },
      metadata: metadataFromResult(result),
      availability: "online",
    });

    await this.media.update(updated);
  }

  async fail(job: JobRecord, error: JobErrorInfo): Promise<void> {
    if (job.kind !== "probe-media") {
      return;
    }

    const mediaId = mediaIdFromJob(job);
    const asset = await this.media.findById(mediaId);

    if (!asset) {
      return;
    }

    const unavailableCodes = new Set([
      "SOURCE_FILE_UNAVAILABLE",
      "FFPROBE_SOURCE_NOT_FOUND",
    ]);
    const updated = updateMediaInspection(asset, {
      inspection: {
        status: "failed",
        error: error.message,
        inspectedAt: new Date().toISOString(),
      },
      availability: unavailableCodes.has(error.code) ? "missing" : asset.availability,
    });

    await this.media.update(updated);
  }

  async prepareRetry(job: JobRecord): Promise<void> {
    if (job.kind !== "probe-media") {
      return;
    }

    const mediaId = mediaIdFromJob(job);
    const asset = await this.media.findById(mediaId);

    if (!asset) {
      throw new Error("El recurso que se intentó volver a analizar ya no existe.");
    }

    await this.media.update(
      updateMediaInspection(asset, {
        inspection: { status: "pending" },
        availability: "online",
      }),
    );
  }
}

export { MediaProbeJobHandler, mediaIdFromJob, metadataFromResult };
