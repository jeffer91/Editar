/* =========================================================
Nombre completo: media-asset-repository.ts
Ruta o ubicación: /apps/desktop/shared/persistence/media-asset-repository.ts

Función o funciones:
- Definir acceso especializado a recursos multimedia.
- Permitir actualizar metadatos técnicos sin guardar el proyecto completo.
- Mantener el análisis desacoplado de SQLite.
========================================================= */

import type { EntityId, MediaAsset } from "../domain/index.js";

interface MediaAssetRepository {
  findById(id: EntityId<"media">): Promise<MediaAsset | null>;
  update(asset: MediaAsset): Promise<void>;
}

export { type MediaAssetRepository };
