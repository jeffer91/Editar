/* =========================================================
Nombre completo: audio-analysis-job-handler.ts
Ruta o ubicación: /apps/desktop/main/jobs/audio-analysis-job-handler.ts

Función o funciones:
- Validar y persistir resultados de detección de silencios.
- Conservar el análisis anterior durante fallos y reintentos.
- Mantener la cola desacoplada de la entidad MediaAsset.
========================================================= */

import {
  createAudioAnalysis,
  parseEntityId,
  setMediaAudioAnalysis,
  type EntityId,
  type JobErrorInfo,
  type JobRecord,
  type JsonValue,
} from "../../shared/domain/index.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import type { JobResultHandler } from "./job-result-handler.js";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mediaIdFromAudioJob(job: JobRecord): EntityId<"media"> {
  const value = job.payload.mediaId;

  if (typeof value !== "string") {
    throw new Error("El trabajo acústico no contiene un identificador de medio válido.");
  }

  return parseEntityId(value, "media");
}

class AudioAnalysisJobHandler implements JobResultHandler {
  constructor(private readonly media: MediaAssetRepository) {}

  async complete(
    job: JobRecord,
    result: Readonly<Record<string, JsonValue>> | undefined,
  ): Promise<void> {
    if (job.kind !== "detect-silence") {
      return;
    }

    const asset = await this.media.findById(mediaIdFromAudioJob(job));

    if (!asset) {
      throw new Error("El recurso analizado ya no existe en la base local.");
    }

    const raw = result?.audioAnalysis;

    if (!isRecord(raw) || !Array.isArray(raw.segments)) {
      throw new Error("FFmpeg terminó sin devolver un análisis acústico válido.");
    }

    const analysis = createAudioAnalysis({
      analyzedAt:
        typeof raw.analyzedAt === "string" ? raw.analyzedAt : new Date().toISOString(),
      sourceKey:
        typeof raw.sourceKey === "string"
          ? raw.sourceKey
          : String(job.payload.sourceKey ?? ""),
      durationUs: Number(raw.durationUs),
      thresholdDb: Number(raw.thresholdDb),
      minSilenceUs: Number(raw.minSilenceUs),
      segments: raw.segments.map((segment) => {
        if (!isRecord(segment)) {
          throw new Error("El análisis contiene un segmento de silencio inválido.");
        }

        return {
          startUs: Number(segment.startUs),
          endUs: Number(segment.endUs),
        };
      }),
    });

    await this.media.update(setMediaAudioAnalysis(asset, analysis));
  }

  async fail(_job: JobRecord, _error: JobErrorInfo): Promise<void> {
    // Un fallo no elimina el último análisis acústico válido.
  }

  async prepareRetry(_job: JobRecord): Promise<void> {
    // El reintento conserva el resultado anterior hasta completar uno nuevo.
  }
}

export {
  AudioAnalysisJobHandler,
  mediaIdFromAudioJob,
};
