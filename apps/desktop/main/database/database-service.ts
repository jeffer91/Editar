/* =========================================================
Nombre completo: database-service.ts
Ruta o ubicación: /apps/desktop/main/database/database-service.ts

Función o funciones:
- Administrar el ciclo de vida completo de SQLite.
- Exponer proyectos, medios, trabajos, integridad y respaldos.
- Resolver rutas locales sin acoplarlas a la interfaz.
========================================================= */

import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  DatabaseBackupInfo,
  DatabaseStatus,
} from "../../shared/database-contracts.js";
import type { JobQueueRepository } from "../../shared/persistence/job-queue-repository.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import { LATEST_DATABASE_VERSION } from "./migrations.js";
import { DatabaseBackupService } from "./database-backup-service.js";
import { SqliteDatabase } from "./sqlite-database.js";
import { SqliteJobQueueRepository } from "./sqlite-job-queue-repository.js";
import { SqliteMediaAssetRepository } from "./sqlite-media-asset-repository.js";
import { SqliteProjectRepository } from "./sqlite-project-repository.js";

interface DatabasePaths {
  readonly dataDirectory: string;
  readonly databasePath: string;
  readonly backupsDirectory: string;
}

interface DatabaseServiceOptions {
  readonly paths: DatabasePaths;
  readonly automaticBackups?: boolean;
  readonly maxBackups?: number;
  readonly automaticBackupIntervalMs?: number;
}

interface CountRow {
  readonly count: number | bigint;
}

function createDatabasePaths(userDataPath: string): DatabasePaths {
  const dataDirectory = join(userDataPath, "data");

  return Object.freeze({
    dataDirectory,
    databasePath: join(dataDirectory, "editar.sqlite3"),
    backupsDirectory: join(userDataPath, "backups"),
  });
}

function numberFromSqlite(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

class DatabaseService {
  private databaseInstance: SqliteDatabase | null = null;
  private projectRepositoryInstance: SqliteProjectRepository | null = null;
  private mediaRepositoryInstance: SqliteMediaAssetRepository | null = null;
  private jobRepositoryInstance: SqliteJobQueueRepository | null = null;
  private backupServiceInstance: DatabaseBackupService | null = null;

  constructor(private readonly options: DatabaseServiceOptions) {}

  get database(): SqliteDatabase {
    if (!this.databaseInstance) {
      throw new Error("La base de datos todavía no fue inicializada.");
    }

    return this.databaseInstance;
  }

  get projects(): ProjectRepository {
    if (!this.projectRepositoryInstance) {
      throw new Error("El repositorio de proyectos todavía no fue inicializado.");
    }

    return this.projectRepositoryInstance;
  }

  get media(): MediaAssetRepository {
    if (!this.mediaRepositoryInstance) {
      throw new Error("El repositorio de medios todavía no fue inicializado.");
    }

    return this.mediaRepositoryInstance;
  }

  get jobs(): JobQueueRepository {
    if (!this.jobRepositoryInstance) {
      throw new Error("El repositorio de trabajos todavía no fue inicializado.");
    }

    return this.jobRepositoryInstance;
  }

  async initialize(): Promise<void> {
    if (this.databaseInstance) {
      return;
    }

    await Promise.all([
      mkdir(this.options.paths.dataDirectory, { recursive: true }),
      mkdir(this.options.paths.backupsDirectory, { recursive: true }),
    ]);

    const database = new SqliteDatabase({
      path: this.options.paths.databasePath,
      timeoutMs: 5_000,
    });
    const projectRepository = new SqliteProjectRepository(database);
    const mediaRepository = new SqliteMediaAssetRepository(database);
    const jobRepository = new SqliteJobQueueRepository(database);
    const backupService = new DatabaseBackupService(database, {
      backupsDirectory: this.options.paths.backupsDirectory,
      maxBackups: this.options.maxBackups ?? 10,
      automaticIntervalMs: this.options.automaticBackupIntervalMs,
    });

    this.databaseInstance = database;
    this.projectRepositoryInstance = projectRepository;
    this.mediaRepositoryInstance = mediaRepository;
    this.jobRepositoryInstance = jobRepository;
    this.backupServiceInstance = backupService;

    if (this.options.automaticBackups !== false && this.getProjectCount() > 0) {
      try {
        await backupService.createAutomaticIfDue();
      } catch (error) {
        console.error("No fue posible crear el respaldo automático.", error);
      }
    }
  }

  async getStatus(fullIntegrityCheck = false): Promise<DatabaseStatus> {
    const database = this.database;
    const integrity = database.checkIntegrity(fullIntegrityCheck);
    const latestBackup = this.backupService.getLatest();
    let fileSizeBytes = 0;

    if (database.path !== ":memory:") {
      try {
        fileSizeBytes = (await stat(database.path)).size;
      } catch {
        fileSizeBytes = 0;
      }
    }

    return Object.freeze({
      isOpen: database.isOpen,
      databasePath: database.path,
      schemaVersion: database.getSchemaVersion(),
      latestSchemaVersion: LATEST_DATABASE_VERSION,
      journalMode: database.getJournalMode(),
      integrity: integrity.ok ? "ok" : "error",
      integrityMessage: integrity.message,
      fileSizeBytes,
      projectCount: this.getProjectCount(),
      snapshotCount: this.getTableCount("project_snapshots"),
      backupCount: this.backupService.count(),
      lastBackupAt: latestBackup?.createdAt ?? null,
    });
  }

  async createBackup(automatic = false): Promise<DatabaseBackupInfo> {
    return this.backupService.create(automatic);
  }

  close(): void {
    this.databaseInstance?.close();
    this.databaseInstance = null;
    this.projectRepositoryInstance = null;
    this.mediaRepositoryInstance = null;
    this.jobRepositoryInstance = null;
    this.backupServiceInstance = null;
  }

  private get backupService(): DatabaseBackupService {
    if (!this.backupServiceInstance) {
      throw new Error("El servicio de respaldos todavía no fue inicializado.");
    }

    return this.backupServiceInstance;
  }

  private getProjectCount(): number {
    return this.getTableCount("projects");
  }

  private getTableCount(
    table: "projects" | "project_snapshots",
  ): number {
    const row = this.database
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get() as CountRow | undefined;

    return row ? numberFromSqlite(row.count) : 0;
  }
}

export {
  DatabaseService,
  createDatabasePaths,
  type DatabasePaths,
  type DatabaseServiceOptions,
};
