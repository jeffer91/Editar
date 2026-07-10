/* =========================================================
Nombre completo: database-backup-service.ts
Ruta o ubicación: /apps/desktop/main/database/database-backup-service.ts

Función o funciones:
- Crear respaldos consistentes mediante la API oficial de SQLite.
- Registrar tamaño, checksum, versión y origen del respaldo.
- Aplicar retención y respaldos automáticos diarios.
========================================================= */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { backup } from "node:sqlite";
import type { DatabaseBackupInfo } from "../../shared/database-contracts.js";
import { createEntityId } from "../../shared/domain/index.js";
import { SqliteDatabase } from "./sqlite-database.js";

interface BackupHistoryRow {
  readonly id: string;
  readonly path: string;
  readonly file_name: string;
  readonly size_bytes: number | bigint;
  readonly checksum: string;
  readonly schema_version: number | bigint;
  readonly created_at: string;
  readonly automatic: number | bigint;
}

interface DatabaseBackupServiceOptions {
  readonly backupsDirectory: string;
  readonly maxBackups?: number;
  readonly automaticIntervalMs?: number;
}

function numberFromSqlite(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

async function calculateFileChecksum(path: string): Promise<string> {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}

function createBackupFileName(now: Date): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .replace(/\.\d{3}Z$/, "Z");
  const suffix = Math.random().toString(36).slice(2, 8);

  return `editar-${timestamp}-${suffix}.sqlite3`;
}

class DatabaseBackupService {
  private readonly maxBackups: number;
  private readonly automaticIntervalMs: number;

  constructor(
    private readonly database: SqliteDatabase,
    private readonly options: DatabaseBackupServiceOptions,
  ) {
    this.maxBackups = options.maxBackups ?? 10;
    this.automaticIntervalMs =
      options.automaticIntervalMs ?? 24 * 60 * 60 * 1_000;

    if (
      !Number.isSafeInteger(this.maxBackups) ||
      this.maxBackups < 1 ||
      this.maxBackups > 1_000
    ) {
      throw new Error("La retención de respaldos debe estar entre 1 y 1000.");
    }
  }

  async create(automatic = false): Promise<DatabaseBackupInfo> {
    await mkdir(this.options.backupsDirectory, { recursive: true });

    const now = new Date();
    const fileName = createBackupFileName(now);
    const path = join(this.options.backupsDirectory, fileName);

    this.database.checkpoint("PASSIVE");
    await backup(this.database.connection, path, { rate: 64 });

    const fileStats = await stat(path);
    const checksum = await calculateFileChecksum(path);
    const info: DatabaseBackupInfo = Object.freeze({
      id: createEntityId("backup"),
      path,
      fileName,
      sizeBytes: fileStats.size,
      checksum,
      schemaVersion: this.database.getSchemaVersion(),
      createdAt: now.toISOString(),
      automatic,
    });

    this.database
      .prepare(`
        INSERT INTO backup_history(
          id, path, file_name, size_bytes, checksum,
          schema_version, created_at, automatic
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        info.id,
        info.path,
        info.fileName,
        info.sizeBytes,
        info.checksum,
        info.schemaVersion,
        info.createdAt,
        info.automatic ? 1 : 0,
      );

    await this.prune();
    return info;
  }

  async createAutomaticIfDue(): Promise<DatabaseBackupInfo | null> {
    const latest = this.getLatest();

    if (latest) {
      const elapsed = Date.now() - new Date(latest.createdAt).getTime();

      if (Number.isFinite(elapsed) && elapsed < this.automaticIntervalMs) {
        return null;
      }
    }

    return this.create(true);
  }

  getLatest(): DatabaseBackupInfo | null {
    const row = this.database
      .prepare(`
        SELECT
          id, path, file_name, size_bytes, checksum,
          schema_version, created_at, automatic
        FROM backup_history
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
      `)
      .get() as BackupHistoryRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  count(): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM backup_history")
      .get() as { readonly count: number | bigint } | undefined;

    return row ? numberFromSqlite(row.count) : 0;
  }

  private mapRow(row: BackupHistoryRow): DatabaseBackupInfo {
    return Object.freeze({
      id: row.id,
      path: row.path,
      fileName: row.file_name,
      sizeBytes: numberFromSqlite(row.size_bytes),
      checksum: row.checksum,
      schemaVersion: numberFromSqlite(row.schema_version),
      createdAt: row.created_at,
      automatic: numberFromSqlite(row.automatic) === 1,
    });
  }

  private async prune(): Promise<void> {
    const rows = this.database
      .prepare(`
        SELECT
          id, path, file_name, size_bytes, checksum,
          schema_version, created_at, automatic
        FROM backup_history
        ORDER BY created_at DESC, rowid DESC
        LIMIT -1 OFFSET ?
      `)
      .all(this.maxBackups) as unknown as readonly BackupHistoryRow[];

    for (const row of rows) {
      try {
        await unlink(row.path);
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "";

        if (code !== "ENOENT") {
          console.error(`No fue posible eliminar el respaldo ${basename(row.path)}.`, error);
          continue;
        }
      }

      this.database
        .prepare("DELETE FROM backup_history WHERE id = ?")
        .run(row.id);
    }
  }
}

export {
  DatabaseBackupService,
  calculateFileChecksum,
  createBackupFileName,
  type DatabaseBackupServiceOptions,
};
