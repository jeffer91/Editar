/* =========================================================
Nombre completo: media-asset-repository.ts
Ruta o ubicación: /apps/desktop/shared/persistence/media-asset-repository.ts

Función o funciones:
- Definir acceso especializado a recursos multimedia.
- Permitir actualizar metadatos y derivados sin guardar el proyecto completo.
- Facilitar reconciliación y limpieza segura de la caché.
========================================================= */

import type { EntityId, MediaAsset } from "../domain/index.js";

interface MediaAssetRepository {
  findById(id: EntityId<"media">): Promise<MediaAsset | null>;
  listAll(): Promise<readonly MediaAsset[]>;
  update(asset: MediaAsset): Promise<void>;
}

export { type MediaAssetRepository };
