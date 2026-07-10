/* =========================================================
Nombre completo: media-audio-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/media-audio-operations.ts

Función o funciones:
- Guardar o limpiar análisis acústicos de un recurso.
- Guardar planes de reducción sin modificar metadatos técnicos.
- Reconstruir MediaAsset mediante validación central.
========================================================= */

import type {
  AudioAnalysis,
  SilenceReductionPlan,
} from "./audio-analysis.js";
import {
  createMediaAsset,
  type MediaAsset,
} from "./media.js";

function rebuildMediaAudioState(
  asset: MediaAsset,
  audioAnalysis: AudioAnalysis | undefined,
  silenceReduction: SilenceReductionPlan | undefined,
): MediaAsset {
  return createMediaAsset({
    id: asset.id,
    projectId: asset.projectId,
    kind: asset.kind,
    fileName: asset.fileName,
    sourcePath: asset.sourcePath,
    extension: asset.extension,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    sourceModifiedAt: asset.sourceModifiedAt,
    contentHash: asset.contentHash,
    availability: asset.availability,
    inspection: asset.inspection,
    metadata: asset.metadata,
    audioAnalysis,
    silenceReduction,
    derivatives: asset.derivatives,
    importedAt: asset.importedAt,
  });
}

function setMediaAudioAnalysis(
  asset: MediaAsset,
  analysis: AudioAnalysis,
): MediaAsset {
  return rebuildMediaAudioState(asset, analysis, undefined);
}

function clearMediaAudioAnalysis(asset: MediaAsset): MediaAsset {
  return rebuildMediaAudioState(asset, undefined, undefined);
}

function setMediaSilenceReduction(
  asset: MediaAsset,
  plan: SilenceReductionPlan,
): MediaAsset {
  return rebuildMediaAudioState(asset, asset.audioAnalysis, plan);
}

function clearMediaSilenceReduction(asset: MediaAsset): MediaAsset {
  return asset.silenceReduction
    ? rebuildMediaAudioState(asset, asset.audioAnalysis, undefined)
    : asset;
}

export {
  clearMediaAudioAnalysis,
  clearMediaSilenceReduction,
  rebuildMediaAudioState,
  setMediaAudioAnalysis,
  setMediaSilenceReduction,
};
