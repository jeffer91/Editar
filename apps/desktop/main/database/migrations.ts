/* =========================================================
Nombre completo: migrations.ts
Ruta o ubicación: /apps/desktop/main/database/migrations.ts

Función o funciones:
- Definir las migraciones versionadas de SQLite.
- Crear tablas, restricciones e índices del dominio.
- Calcular una huella para impedir cambios silenciosos.
========================================================= */

import { createHash } from "node:crypto";

interface DatabaseMigration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

const migrationDefinitions: readonly MigrationDefinition[] = [
  {
    version: 1,
    name: "modelo_inicial",
    sql: `
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
        schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
        main_sequence_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE sequences (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        duration_us INTEGER NOT NULL CHECK (duration_us >= 0),
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE tracks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        order_index INTEGER NOT NULL CHECK (order_index >= 0),
        data_json TEXT NOT NULL CHECK (json_valid(data_json)),
        UNIQUE(sequence_id, order_index)
      ) STRICT;

      CREATE TABLE media_assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('video', 'audio', 'image')),
        file_name TEXT NOT NULL,
        source_path TEXT NOT NULL,
        availability TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE text_layers (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE clips (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        timeline_start_us INTEGER NOT NULL CHECK (timeline_start_us >= 0),
        duration_us INTEGER NOT NULL CHECK (duration_us > 0),
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE effects (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        owner_type TEXT NOT NULL CHECK (owner_type IN ('clip', 'track', 'sequence')),
        owner_id TEXT NOT NULL,
        effect_type TEXT NOT NULL,
        order_index INTEGER NOT NULL CHECK (order_index >= 0),
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE transitions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        from_clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
        to_clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
        transition_type TEXT NOT NULL,
        duration_us INTEGER NOT NULL CHECK (duration_us > 0),
        data_json TEXT NOT NULL CHECK (json_valid(data_json)),
        CHECK (from_clip_id <> to_clip_id)
      ) STRICT;

      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL CHECK (priority BETWEEN 0 AND 100),
        progress REAL NOT NULL CHECK (progress BETWEEN 0 AND 100),
        created_at TEXT NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE job_dependencies (
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        dependency_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY (job_id, dependency_id),
        CHECK (job_id <> dependency_id)
      ) STRICT;

      CREATE TABLE project_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
      CREATE INDEX idx_sequences_project_id ON sequences(project_id);
      CREATE INDEX idx_tracks_sequence_id ON tracks(sequence_id, order_index);
      CREATE INDEX idx_media_project_kind ON media_assets(project_id, kind);
      CREATE INDEX idx_clips_track_time ON clips(track_id, timeline_start_us);
      CREATE INDEX idx_effects_owner ON effects(owner_type, owner_id, order_index);
      CREATE INDEX idx_transitions_project ON transitions(project_id);
      CREATE INDEX idx_jobs_project_status ON jobs(project_id, status, priority DESC);
      CREATE INDEX idx_snapshots_project_created ON project_snapshots(project_id, created_at DESC);
    `,
  },
  {
    version: 2,
    name: "respaldos_y_metadatos",
    sql: `
      CREATE TABLE database_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE backup_history (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
        checksum TEXT NOT NULL,
        schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
        created_at TEXT NOT NULL,
        automatic INTEGER NOT NULL CHECK (automatic IN (0, 1))
      ) STRICT;

      CREATE INDEX idx_backup_created_at ON backup_history(created_at DESC);
    `,
  },
  {
    version: 3,
    name: "cola_trabajos_persistente",
    sql: `
      ALTER TABLE jobs ADD COLUMN updated_at TEXT;
      ALTER TABLE jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0);
      ALTER TABLE jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 100);

      UPDATE jobs
      SET
        updated_at = COALESCE(json_extract(data_json, '$.updatedAt'), created_at),
        attempt = COALESCE(json_extract(data_json, '$.attempt'), 0),
        max_attempts = COALESCE(json_extract(data_json, '$.maxAttempts'), 3);

      CREATE INDEX idx_jobs_scheduler
      ON jobs(status, priority DESC, created_at ASC);

      CREATE INDEX idx_jobs_updated_at
      ON jobs(updated_at DESC);
    `,
  },
];

function calculateMigrationChecksum(definition: MigrationDefinition): string {
  return createHash("sha256")
    .update(`${definition.version}:${definition.name}:${definition.sql}`)
    .digest("hex");
}

const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = Object.freeze(
  migrationDefinitions.map((definition) =>
    Object.freeze({
      ...definition,
      checksum: calculateMigrationChecksum(definition),
    }),
  ),
);

const LATEST_DATABASE_VERSION =
  DATABASE_MIGRATIONS.at(-1)?.version ?? 0;

export {
  DATABASE_MIGRATIONS,
  LATEST_DATABASE_VERSION,
  calculateMigrationChecksum,
  type DatabaseMigration,
};
