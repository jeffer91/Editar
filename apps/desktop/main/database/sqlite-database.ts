/* =========================================================
Nombre completo: sqlite-database.ts
Ruta o ubicación: /apps/desktop/main/database/sqlite-database.ts

Función o funciones:
- Abrir y configurar la conexión SQLite.
- Ejecutar migraciones versionadas y transacciones seguras.
- Comprobar integridad, versión y modo de diario.
========================================================= */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import {
  DATABASE_MIGRATIONS,
  LATEST_DATABASE_VERSION,
  type DatabaseMigration,
} from "./migrations.js";

interface AppliedMigrationRow {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly applied_at: string;
}

interface PragmaValueRow {
  readonly [key: string]: string | number | bigint | null;
}

interface IntegrityResult {
  readonly ok: boolean;
  readonly message: string;
}

interface SqliteDatabaseOptions {
  readonly path: string;
  readonly timeoutMs?: number;
}

class SqliteDatabase {
  readonly path: string;
  readonly connection: DatabaseSync;

  private closed = false;

  constructor(options: SqliteDatabaseOptions) {
    this.path = options.path;

    if (this.path !== ":memory:") {
      mkdirSync(dirname(this.path), { recursive: true });
    }

    this.connection = new DatabaseSync(this.path, {
      timeout: options.timeoutMs ?? 5_000,
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
    });

    this.configure();
    this.runMigrations();
  }

  get isOpen(): boolean {
    return !this.closed && this.connection.isOpen;
  }

  prepare(sql: string): StatementSync {
    this.assertOpen();
    return this.connection.prepare(sql);
  }

  exec(sql: string): void {
    this.assertOpen();
    this.connection.exec(sql);
  }

  transaction<T>(operation: () => T): T {
    this.assertOpen();

    if (this.connection.isTransaction) {
      return operation();
    }

    this.connection.exec("BEGIN IMMEDIATE");

    try {
      const result = operation();
      this.connection.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.connection.exec("ROLLBACK");
      } catch (rollbackError) {
        console.error("No fue posible revertir la transacción SQLite.", rollbackError);
      }

      throw error;
    }
  }

  getSchemaVersion(): number {
    this.assertOpen();
    const row = this.connection
      .prepare("PRAGMA user_version")
      .get() as PragmaValueRow | undefined;
    const value = row ? Object.values(row)[0] : 0;

    return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  }

  getJournalMode(): string {
    this.assertOpen();
    const row = this.connection
      .prepare("PRAGMA journal_mode")
      .get() as PragmaValueRow | undefined;
    const value = row ? Object.values(row)[0] : "unknown";

    return String(value ?? "unknown").toLowerCase();
  }

  checkIntegrity(full = false): IntegrityResult {
    this.assertOpen();
    const pragma = full ? "integrity_check" : "quick_check";
    const rows = this.connection
      .prepare(`PRAGMA ${pragma}`)
      .all() as readonly PragmaValueRow[];
    const messages = rows.map((row) => String(Object.values(row)[0] ?? "unknown"));
    const ok = messages.length === 1 && messages[0]?.toLowerCase() === "ok";

    return Object.freeze({
      ok,
      message: messages.join("; ") || "No se recibió respuesta de SQLite.",
    });
  }

  checkpoint(mode: "PASSIVE" | "FULL" | "RESTART" = "PASSIVE"): void {
    this.assertOpen();
    this.connection.exec(`PRAGMA wal_checkpoint(${mode})`);
  }

  close(): void {
    if (this.closed) {
      return;
    }

    if (this.connection.isTransaction) {
      this.connection.exec("ROLLBACK");
    }

    this.connection.close();
    this.closed = true;
  }

  private assertOpen(): void {
    if (!this.isOpen) {
      throw new Error("La conexión SQLite está cerrada.");
    }
  }

  private configure(): void {
    this.connection.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
      PRAGMA trusted_schema = OFF;
    `);

    if (this.path !== ":memory:") {
      this.connection.exec("PRAGMA journal_mode = WAL");
    }
  }

  private ensureMigrationTable(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
  }

  private getAppliedMigrations(): readonly AppliedMigrationRow[] {
    return this.connection
      .prepare(`
        SELECT version, name, checksum, applied_at
        FROM schema_migrations
        ORDER BY version ASC
      `)
      .all() as unknown as readonly AppliedMigrationRow[];
  }

  private verifyAppliedMigration(
    applied: AppliedMigrationRow,
    expected: DatabaseMigration | undefined,
  ): void {
    if (!expected) {
      throw new Error(
        `La base usa una migración futura no compatible: ${applied.version}.`,
      );
    }

    if (applied.name !== expected.name || applied.checksum !== expected.checksum) {
      throw new Error(
        `La migración ${applied.version} no coincide con la versión registrada.`,
      );
    }
  }

  private applyMigration(migration: DatabaseMigration): void {
    this.transaction(() => {
      this.connection.exec(migration.sql);
      this.connection
        .prepare(`
          INSERT INTO schema_migrations(version, name, checksum, applied_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(
          migration.version,
          migration.name,
          migration.checksum,
          new Date().toISOString(),
        );
      this.connection.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }

  private runMigrations(): void {
    this.ensureMigrationTable();

    const applied = this.getAppliedMigrations();
    const appliedVersions = new Set<number>();

    for (const item of applied) {
      const expected = DATABASE_MIGRATIONS.find(
        (migration) => migration.version === item.version,
      );
      this.verifyAppliedMigration(item, expected);
      appliedVersions.add(item.version);
    }

    for (const migration of DATABASE_MIGRATIONS) {
      if (!appliedVersions.has(migration.version)) {
        this.applyMigration(migration);
      }
    }

    const currentVersion = this.getSchemaVersion();

    if (currentVersion !== LATEST_DATABASE_VERSION) {
      throw new Error(
        `La base quedó en la versión ${currentVersion}; se esperaba ${LATEST_DATABASE_VERSION}.`,
      );
    }
  }
}

export {
  SqliteDatabase,
  type IntegrityResult,
  type SqliteDatabaseOptions,
};
