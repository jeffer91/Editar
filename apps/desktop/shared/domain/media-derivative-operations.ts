/* =========================================================
Nombre completo: media-derivative-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/media-derivative-operations.ts

Función o funciones:
- Agregar o reemplazar proxies, miniaturas y formas de onda.
- Eliminar derivados sin modificar el archivo original.
- Reutilizar la validación central de MediaAsset.
========================================================= */

import {
  createMediaAsset,
  type MediaAsset,
  type MediaDerivative,
} from "./media.js";

function rebuildWithDerivatives(
  asset: MediaAsset,
  derivatives: readonly MediaDerivative[],
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
    derivatives,
    importedAt: asset.importedAt,
  });
}

function upsertMediaDerivative(
  asset: MediaAsset,
  derivative: MediaDerivative,
): MediaAsset {
  const remaining = asset.derivatives.filter(
    (current) => current.type !== derivative.type,
  );

  return rebuildWithDerivatives(asset, [...remaining, derivative]);
}

function removeMediaDerivative(
  asset: MediaAsset,
  derivativeId: MediaDerivative["id"],
): MediaAsset {
  return rebuildWithDerivatives(
    asset,
    asset.derivatives.filter((derivative) => derivative.id !== derivativeId),
  );
}

function clearMediaDerivatives(asset: MediaAsset): MediaAsset {
  return asset.derivatives.length === 0
    ? asset
    : rebuildWithDerivatives(asset, []);
}

function retainMediaDerivatives(
  asset: MediaAsset,
  predicate: (derivative: MediaDerivative) => boolean,
): MediaAsset {
  const retained = asset.derivatives.filter(predicate);

  return retained.length === asset.derivatives.length
    ? asset
    : rebuildWithDerivatives(asset, retained);
}

export {
  clearMediaDerivatives,
  rebuildWithDerivatives,
  removeMediaDerivative,
  retainMediaDerivatives,
  upsertMediaDerivative,
};
