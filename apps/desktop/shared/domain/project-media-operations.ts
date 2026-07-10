/* =========================================================
Nombre completo: project-media-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/project-media-operations.ts

Función o funciones:
- Incorporar recursos multimedia a un documento de proyecto.
- Rechazar identificadores, rutas o hashes duplicados.
- Actualizar la fecha del proyecto y validar todas las relaciones.
========================================================= */

import { assertDomain } from "./domain-error.js";
import type { MediaAsset } from "./media.js";
import { toIsoDateTime } from "./primitives.js";
import {
  validateProjectDocument,
  type ProjectDocument,
} from "./project-document.js";

interface AddMediaAssetsInput {
  readonly assets: readonly MediaAsset[];
  readonly now?: Date | string;
}

function addMediaAssetsToProject(
  document: ProjectDocument,
  input: AddMediaAssetsInput,
): ProjectDocument {
  const existingIds = new Set(document.media.map((asset) => asset.id));
  const existingPaths = new Set(
    document.media.map((asset) => asset.sourcePath.toLocaleLowerCase()),
  );
  const existingHashes = new Set(
    document.media
      .map((asset) => asset.contentHash)
      .filter((hash): hash is string => Boolean(hash)),
  );
  const newIds = new Set<string>();
  const newPaths = new Set<string>();
  const newHashes = new Set<string>();

  for (const asset of input.assets) {
    assertDomain(
      asset.projectId === document.project.id,
      "INVALID_RELATION",
      `media.${asset.id}.projectId`,
      "El recurso multimedia pertenece a otro proyecto.",
    );
    assertDomain(
      !existingIds.has(asset.id) && !newIds.has(asset.id),
      "DUPLICATE_VALUE",
      `media.${asset.id}.id`,
      "El identificador del recurso multimedia ya existe.",
    );

    const normalizedPath = asset.sourcePath.toLocaleLowerCase();
    assertDomain(
      !existingPaths.has(normalizedPath) && !newPaths.has(normalizedPath),
      "DUPLICATE_VALUE",
      `media.${asset.id}.sourcePath`,
      "El archivo ya está registrado en este proyecto.",
    );

    if (asset.contentHash) {
      assertDomain(
        !existingHashes.has(asset.contentHash) &&
          !newHashes.has(asset.contentHash),
        "DUPLICATE_VALUE",
        `media.${asset.id}.contentHash`,
        "El contenido del archivo ya está registrado en este proyecto.",
      );
      newHashes.add(asset.contentHash);
    }

    newIds.add(asset.id);
    newPaths.add(normalizedPath);
  }

  const updated: ProjectDocument = Object.freeze({
    ...document,
    project: Object.freeze({
      ...document.project,
      updatedAt: toIsoDateTime(input.now ?? new Date(), "updatedAt"),
    }),
    media: Object.freeze([...document.media, ...input.assets]),
  });

  return validateProjectDocument(updated);
}

export {
  addMediaAssetsToProject,
  type AddMediaAssetsInput,
};
