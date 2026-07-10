/* =========================================================
Nombre completo: database-contracts.ts
Ruta o ubicación: /apps/desktop/shared/database-contracts.ts

Función o funciones:
- Definir información pública del almacenamiento local.
- Compartir estados de integridad y respaldos con la interfaz.
- Evitar exponer objetos internos de SQLite al renderer.
========================================================= */

type DatabaseIntegrity = "ok" | "error" | "unknown";

interface DatabaseStatus {
  readonly isOpen: boolean;
  readonly databasePath: string;
  readonly schemaVersion: number;
  readonly latestSchemaVersion: number;
  readonly journalMode: string;
  readonly integrity: DatabaseIntegrity;
  readonly integrityMessage: string;
  readonly fileSizeBytes: number;
  readonly projectCount: number;
  readonly snapshotCount: number;
  readonly backupCount: number;
  readonly lastBackupAt: string | null;
}

interface DatabaseBackupInfo {
  readonly id: string;
  readonly path: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly automatic: boolean;
}

interface DatabaseBridge {
  getStatus(): Promise<import("./ipc-contracts.js").IpcResult<DatabaseStatus>>;
  checkIntegrity(): Promise<import("./ipc-contracts.js").IpcResult<DatabaseStatus>>;
  createBackup(): Promise<import("./ipc-contracts.js").IpcResult<DatabaseBackupInfo>>;
}

export {
  type DatabaseBackupInfo,
  type DatabaseBridge,
  type DatabaseIntegrity,
  type DatabaseStatus,
};
