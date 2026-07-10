/* =========================================================
Nombre completo: sqlite-project-repository.ts
Ruta o ubicación: /apps/desktop/main/database/sqlite-project-repository.ts

Función o funciones:
- Guardar proyectos completos dentro de una transacción.
- Reconstruir documentos del dominio desde tablas normalizadas.
- Listar, eliminar y conservar snapshots de recuperación.
========================================================= */

import {
  normalizeName,
  validateProjectDocument,
  type Clip,
  type EffectInstance,
  type EntityId,
  type JobRecord,
  type MediaAsset,
  type Project,
  type ProjectDocument,
  type Sequence,
  type TextLayer,
  type Track,
  type TransitionInstance,
} from "../../shared/domain/index.js";
import type {
  ProjectListItem,
  ProjectRepository,
  SaveProjectOptions,
} from "../../shared/persistence/project-repository.js";
import { SqliteDatabase } from "./sqlite-database.js";

interface JsonRow {
  readonly data_json: string;
}

interface ProjectListRow {
  readonly id: string;
  readonly name: string;
  readonly status: ProjectListItem["status"];
  readonly schema_version: number;
  readonly updated_at: string;
  readonly media_count: number;
  readonly clip_count: number;
  readonly duration_us: number;
}

interface CountRow {
  readonly count: number;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: string, entity: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`No fue posible interpretar ${entity} almacenado.`, {
      cause: error,
    });
  }
}

function numberFromSqlite(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async save(
    document: ProjectDocument,
    options: SaveProjectOptions = {},
  ): Promise<void> {
    validateProjectDocument(document);

    const snapshotReason = normalizeName(
      options.snapshotReason ?? "guardado",
      "snapshotReason",
      160,
    );
    const keepSnapshots = options.keepSnapshots ?? 20;

    if (
      !Number.isSafeInteger(keepSnapshots) ||
      keepSnapshots < 1 ||
      keepSnapshots > 1_000
    ) {
      throw new Error("La cantidad de snapshots debe estar entre 1 y 1000.");
    }

    this.database.transaction(() => {
      this.upsertProject(document.project);
      this.clearProjectEntities(document.project.id);
      this.insertSequences(document);
      this.insertTracks(document);
      this.insertMedia(document);
      this.insertTextLayers(document);
      this.insertClips(document);
      this.insertEffects(document);
      this.insertTransitions(document);
      this.insertJobs(document);
      this.insertJobDependencies(document);
      this.insertSnapshot(document, snapshotReason);
      this.pruneSnapshots(document.project.id, keepSnapshots);
    });
  }

  async findById(
    id: EntityId<"project">,
  ): Promise<ProjectDocument | null> {
    const projectRow = this.database
      .prepare("SELECT data_json FROM projects WHERE id = ?")
      .get(id) as JsonRow | undefined;

    if (!projectRow) {
      return null;
    }

    const document: ProjectDocument = Object.freeze({
      project: parseJson<Project>(projectRow.data_json, "el proyecto"),
      sequences: this.readJsonRows<Sequence>(
        "SELECT data_json FROM sequences WHERE project_id = ? ORDER BY rowid",
        id,
        "las secuencias",
      ),
      tracks: this.readJsonRows<Track>(
        "SELECT data_json FROM tracks WHERE project_id = ? ORDER BY order_index, rowid",
        id,
        "las pistas",
      ),
      clips: this.readJsonRows<Clip>(
        "SELECT data_json FROM clips WHERE project_id = ? ORDER BY timeline_start_us, rowid",
        id,
        "los clips",
      ),
      media: this.readJsonRows<MediaAsset>(
        "SELECT data_json FROM media_assets WHERE project_id = ? ORDER BY imported_at, rowid",
        id,
        "los recursos multimedia",
      ),
      textLayers: this.readJsonRows<TextLayer>(
        "SELECT data_json FROM text_layers WHERE project_id = ? ORDER BY rowid",
        id,
        "las capas de texto",
      ),
      effects: this.readJsonRows<EffectInstance>(
        "SELECT data_json FROM effects WHERE project_id = ? ORDER BY order_index, rowid",
        id,
        "los efectos",
      ),
      transitions: this.readJsonRows<TransitionInstance>(
        "SELECT data_json FROM transitions WHERE project_id = ? ORDER BY rowid",
        id,
        "las transiciones",
      ),
      jobs: this.readJsonRows<JobRecord>(
        "SELECT data_json FROM jobs WHERE project_id = ? ORDER BY created_at, rowid",
        id,
        "los trabajos",
      ),
    });

    return validateProjectDocument(document);
  }

  async list(): Promise<readonly ProjectListItem[]> {
    const rows = this.database
      .prepare(`
        SELECT
          p.id,
          p.name,
          p.status,
          p.schema_version,
          p.updated_at,
          (SELECT COUNT(*) FROM media_assets m WHERE m.project_id = p.id) AS media_count,
          (SELECT COUNT(*) FROM clips c WHERE c.project_id = p.id) AS clip_count,
          COALESCE(
            (SELECT MAX(s.duration_us) FROM sequences s WHERE s.project_id = p.id),
            0
          ) AS duration_us
        FROM projects p
        ORDER BY p.updated_at DESC, p.name COLLATE NOCASE ASC
      `)
      .all() as unknown as readonly ProjectListRow[];

    return Object.freeze(
      rows.map((row) =>
        Object.freeze({
          id: row.id as EntityId<"project">,
          name: row.name,
          status: row.status,
          schemaVersion: numberFromSqlite(row.schema_version),
          updatedAt: row.updated_at,
          mediaCount: numberFromSqlite(row.media_count),
          clipCount: numberFromSqlite(row.clip_count),
          durationUs: numberFromSqlite(row.duration_us),
        }),
      ),
    );
  }

  async delete(id: EntityId<"project">): Promise<boolean> {
    const result = this.database
      .prepare("DELETE FROM projects WHERE id = ?")
      .run(id);

    return numberFromSqlite(result.changes) > 0;
  }

  async countSnapshots(id: EntityId<"project">): Promise<number> {
    const row = this.database
      .prepare(
        "SELECT COUNT(*) AS count FROM project_snapshots WHERE project_id = ?",
      )
      .get(id) as CountRow | undefined;

    return row ? numberFromSqlite(row.count) : 0;
  }

  private readJsonRows<T>(
    sql: string,
    projectId: EntityId<"project">,
    entityName: string,
  ): readonly T[] {
    const rows = this.database.prepare(sql).all(projectId) as unknown as readonly JsonRow[];

    return Object.freeze(
      rows.map((row) => parseJson<T>(row.data_json, entityName)),
    );
  }

  private upsertProject(project: Project): void {
    this.database
      .prepare(`
        INSERT INTO projects(
          id, name, status, schema_version, main_sequence_id,
          created_at, updated_at, data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          status = excluded.status,
          schema_version = excluded.schema_version,
          main_sequence_id = excluded.main_sequence_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          data_json = excluded.data_json
      `)
      .run(
        project.id,
        project.name,
        project.status,
        project.schemaVersion,
        project.mainSequenceId,
        project.createdAt,
        project.updatedAt,
        serialize(project),
      );
  }

  private clearProjectEntities(projectId: EntityId<"project">): void {
    const tables = [
      "transitions",
      "effects",
      "job_dependencies",
      "jobs",
      "clips",
      "tracks",
      "sequences",
      "media_assets",
      "text_layers",
    ] as const;

    for (const table of tables) {
      this.database
        .prepare(`DELETE FROM ${table} WHERE project_id = ?`)
        .run(projectId);
    }
  }

  private insertSequences(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO sequences(id, project_id, name, duration_us, data_json)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const sequence of document.sequences) {
      statement.run(
        sequence.id,
        document.project.id,
        sequence.name,
        sequence.durationUs,
        serialize(sequence),
      );
    }
  }

  private insertTracks(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO tracks(
        id, project_id, sequence_id, kind, order_index, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const track of document.tracks) {
      statement.run(
        track.id,
        document.project.id,
        track.sequenceId,
        track.kind,
        track.order,
        serialize(track),
      );
    }
  }

  private insertMedia(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO media_assets(
        id, project_id, kind, file_name, source_path,
        availability, imported_at, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const media of document.media) {
      statement.run(
        media.id,
        document.project.id,
        media.kind,
        media.fileName,
        media.sourcePath,
        media.availability,
        media.importedAt,
        serialize(media),
      );
    }
  }

  private insertTextLayers(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO text_layers(id, project_id, name, data_json)
      VALUES (?, ?, ?, ?)
    `);

    for (const textLayer of document.textLayers) {
      statement.run(
        textLayer.id,
        document.project.id,
        textLayer.name,
        serialize(textLayer),
      );
    }
  }

  private insertClips(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO clips(
        id, project_id, track_id, kind,
        timeline_start_us, duration_us, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const clip of document.clips) {
      statement.run(
        clip.id,
        document.project.id,
        clip.trackId,
        clip.kind,
        clip.timelineStartUs,
        clip.durationUs,
        serialize(clip),
      );
    }
  }

  private insertEffects(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO effects(
        id, project_id, owner_type, owner_id,
        effect_type, order_index, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const effect of document.effects) {
      statement.run(
        effect.id,
        document.project.id,
        effect.ownerType,
        effect.ownerId,
        effect.effectType,
        effect.order,
        serialize(effect),
      );
    }
  }

  private insertTransitions(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO transitions(
        id, project_id, from_clip_id, to_clip_id,
        transition_type, duration_us, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const transition of document.transitions) {
      statement.run(
        transition.id,
        document.project.id,
        transition.fromClipId,
        transition.toClipId,
        transition.transitionType,
        transition.durationUs,
        serialize(transition),
      );
    }
  }

  private insertJobs(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO jobs(
        id, project_id, kind, status, priority,
        progress, created_at, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const job of document.jobs) {
      statement.run(
        job.id,
        document.project.id,
        job.kind,
        job.status,
        job.priority,
        job.progress,
        job.createdAt,
        serialize(job),
      );
    }
  }

  private insertJobDependencies(document: ProjectDocument): void {
    const statement = this.database.prepare(`
      INSERT INTO job_dependencies(job_id, dependency_id, project_id)
      VALUES (?, ?, ?)
    `);

    for (const job of document.jobs) {
      for (const dependencyId of job.dependencyIds) {
        statement.run(job.id, dependencyId, document.project.id);
      }
    }
  }

  private insertSnapshot(
    document: ProjectDocument,
    reason: string,
  ): void {
    this.database
      .prepare(`
        INSERT INTO project_snapshots(
          project_id, schema_version, reason, created_at, data_json
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        document.project.id,
        document.project.schemaVersion,
        reason,
        new Date().toISOString(),
        serialize(document),
      );
  }

  private pruneSnapshots(
    projectId: EntityId<"project">,
    keepSnapshots: number,
  ): void {
    this.database
      .prepare(`
        DELETE FROM project_snapshots
        WHERE project_id = ?
          AND id NOT IN (
            SELECT id
            FROM project_snapshots
            WHERE project_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
          )
      `)
      .run(projectId, projectId, keepSnapshots);
  }
}

export { SqliteProjectRepository };
