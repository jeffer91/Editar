/* =========================================================
Nombre completo: sqlite-media-asset-repository.ts
Ruta o ubicación: /apps/desktop/main/database/sqlite-media-asset-repository.ts

Función o funciones:
- Leer, listar y actualizar recursos multimedia.
- Persistir metadatos y derivados sin reescribir el proyecto.
- Facilitar reconciliación y limpieza de caché.
========================================================= */

import type {
  EntityId,
  MediaAsset,
} from "../../shared/domain/index.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import { SqliteDatabase } from "./sqlite-database.js";

interface MediaRow {
  readonly data_json: string;
}

function parseMediaAsset(value: string): MediaAsset {
  try {
    const asset = JSON.parse(value) as MediaAsset;

    return Object.freeze({
      ...asset,
      inspection: Object.freeze({ ...asset.inspection }),
      metadata: asset.metadata ? Object.freeze({ ...asset.metadata }) : undefined,
      derivatives: Object.freeze(
        (asset.derivatives ?? []).map((derivative) => Object.freeze({ ...derivative })),
      ),
    });
  } catch (error) {
    throw new Error("No fue posible interpretar el recurso multimedia almacenado.", {
      cause: error,
    });
  }
}

class SqliteMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async findById(id: EntityId<"media">): Promise<MediaAsset | null> {
    const row = this.database
      .prepare("SELECT data_json FROM media_assets WHERE id = ?")
      .get(id) as MediaRow | undefined;

    return row ? parseMediaAsset(row.data_json) : null;
  }

  async listAll(): Promise<readonly MediaAsset[]> {
    const rows = this.database
      .prepare("SELECT data_json FROM media_assets ORDER BY imported_at ASC, id ASC")
      .all() as MediaRow[];

    return Object.freeze(rows.map((row) => parseMediaAsset(row.data_json)));
  }

  async update(asset: MediaAsset): Promise<void> {
    const result = this.database
      .prepare(`
        UPDATE media_assets
        SET
          kind = ?,
          file_name = ?,
          source_path = ?,
          availability = ?,
          data_json = ?
        WHERE id = ? AND project_id = ?
      `)
      .run(
        asset.kind,
        asset.fileName,
        asset.sourcePath,
        asset.availability,
        JSON.stringify(asset),
        asset.id,
        asset.projectId,
      );
    const changes =
      typeof result.changes === "bigint" ? Number(result.changes) : result.changes;

    if (changes === 0) {
      throw new Error("El recurso multimedia que se intentó actualizar no existe.");
    }
  }
}

export { SqliteMediaAssetRepository, parseMediaAsset };
