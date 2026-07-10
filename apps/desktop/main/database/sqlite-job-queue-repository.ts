/* =========================================================
Nombre completo: sqlite-job-queue-repository.ts
Ruta o ubicación: /apps/desktop/main/database/sqlite-job-queue-repository.ts

Función o funciones:
- Persistir trabajos sin reescribir el proyecto completo.
- Consultar la cola global y sus estados de forma eficiente.
- Mantener dependencias e información JSON sincronizadas.
========================================================= */

import type {
  EntityId,
  JobRecord,
  JobStatus,
} from "../../shared/domain/index.js";
import type {
  JobQueueListItem,
  JobQueueRepository,
} from "../../shared/persistence/job-queue-repository.js";
import { SqliteDatabase } from "./sqlite-database.js";

interface JobRow {
  readonly data_json: string;
}

interface JobListRow extends JobRow {
  readonly project_name: string;
}

function parseJob(value: string): JobRecord {
  const parsed = JSON.parse(value) as JobRecord;

  return Object.freeze({
    ...parsed,
    dependencyIds: Object.freeze([...(parsed.dependencyIds ?? [])]),
    payload: Object.freeze({ ...(parsed.payload ?? {}) }),
    result: parsed.result ? Object.freeze({ ...parsed.result }) : undefined,
    error: parsed.error ? Object.freeze({ ...parsed.error }) : undefined,
    updatedAt: parsed.updatedAt ?? parsed.createdAt,
  });
}

function serializeJob(job: JobRecord): string {
  return JSON.stringify(job);
}

function numberFromSqlite(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

class SqliteJobQueueRepository implements JobQueueRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async insert(job: JobRecord): Promise<void> {
    this.database.transaction(() => {
      this.database
        .prepare(`
          INSERT INTO jobs(
            id, project_id, kind, status, priority, progress,
            created_at, updated_at, attempt, max_attempts, data_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          job.id,
          job.projectId,
          job.kind,
          job.status,
          job.priority,
          job.progress,
          job.createdAt,
          job.updatedAt,
          job.attempt,
          job.maxAttempts,
          serializeJob(job),
        );

      const dependencyStatement = this.database.prepare(`
        INSERT INTO job_dependencies(job_id, dependency_id, project_id)
        VALUES (?, ?, ?)
      `);

      for (const dependencyId of job.dependencyIds) {
        dependencyStatement.run(job.id, dependencyId, job.projectId);
      }
    });
  }

  async update(job: JobRecord): Promise<void> {
    const result = this.database
      .prepare(`
        UPDATE jobs
        SET
          status = ?,
          priority = ?,
          progress = ?,
          updated_at = ?,
          attempt = ?,
          max_attempts = ?,
          data_json = ?
        WHERE id = ?
      `)
      .run(
        job.status,
        job.priority,
        job.progress,
        job.updatedAt,
        job.attempt,
        job.maxAttempts,
        serializeJob(job),
        job.id,
      );

    if (numberFromSqlite(result.changes) === 0) {
      throw new Error("El trabajo que se intentó actualizar no existe.");
    }
  }

  async findById(id: EntityId<"job">): Promise<JobRecord | null> {
    const row = this.database
      .prepare("SELECT data_json FROM jobs WHERE id = ?")
      .get(id) as JobRow | undefined;

    return row ? parseJob(row.data_json) : null;
  }

  async list(
    projectId?: EntityId<"project">,
  ): Promise<readonly JobQueueListItem[]> {
    const rows = (projectId
      ? this.database
          .prepare(`
            SELECT j.data_json, p.name AS project_name
            FROM jobs j
            INNER JOIN projects p ON p.id = j.project_id
            WHERE j.project_id = ?
            ORDER BY
              CASE j.status
                WHEN 'running' THEN 0
                WHEN 'preparing' THEN 1
                WHEN 'pending' THEN 2
                WHEN 'paused' THEN 3
                WHEN 'failed' THEN 4
                ELSE 5
              END,
              j.priority DESC,
              j.updated_at DESC,
              j.created_at DESC
          `)
          .all(projectId)
      : this.database
          .prepare(`
            SELECT j.data_json, p.name AS project_name
            FROM jobs j
            INNER JOIN projects p ON p.id = j.project_id
            ORDER BY
              CASE j.status
                WHEN 'running' THEN 0
                WHEN 'preparing' THEN 1
                WHEN 'pending' THEN 2
                WHEN 'paused' THEN 3
                WHEN 'failed' THEN 4
                ELSE 5
              END,
              j.priority DESC,
              j.updated_at DESC,
              j.created_at DESC
          `)
          .all()) as unknown as readonly JobListRow[];

    return Object.freeze(
      rows.map((row) =>
        Object.freeze({
          job: parseJob(row.data_json),
          projectName: row.project_name,
        }),
      ),
    );
  }

  async listByStatuses(
    statuses: readonly JobStatus[],
  ): Promise<readonly JobRecord[]> {
    if (statuses.length === 0) {
      return Object.freeze([]);
    }

    const placeholders = statuses.map(() => "?").join(", ");
    const rows = this.database
      .prepare(`
        SELECT data_json
        FROM jobs
        WHERE status IN (${placeholders})
        ORDER BY priority DESC, created_at ASC
      `)
      .all(...statuses) as unknown as readonly JobRow[];

    return Object.freeze(rows.map((row) => parseJob(row.data_json)));
  }
}

export {
  SqliteJobQueueRepository,
  parseJob,
  serializeJob,
};
