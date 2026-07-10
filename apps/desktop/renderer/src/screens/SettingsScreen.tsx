/* =========================================================
Nombre completo: SettingsScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/SettingsScreen.tsx

Función o funciones:
- Mostrar información del entorno y conectividad interna.
- Mostrar SQLite, respaldos y motores multimedia.
- Permitir ejecutar diagnósticos completos desde una sola pantalla.
========================================================= */

import type { RuntimeInfo } from "../../../shared/ipc-contracts";
import { useDatabaseStatus } from "../app/use-database-status";
import type { ConnectionState } from "../app/use-system-status";
import { MediaEngineStatusPanel } from "../components/settings/MediaEngineStatusPanel";
import { AppIcon } from "../components/ui/AppIcon";

interface SettingsScreenProps {
  readonly runtime: RuntimeInfo | null;
  readonly connectionState: ConnectionState;
  readonly latencyMs: number | null;
  readonly errorMessage: string;
  readonly onCheckConnection: () => Promise<void>;
}

interface SystemRow {
  readonly label: string;
  readonly value: string;
}

function formatByteSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** unitIndex;

  return `${new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: amount >= 100 ? 0 : 1,
  }).format(amount)} ${units[unitIndex]}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Todavía no existe";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SettingsScreen({
  runtime,
  connectionState,
  latencyMs,
  errorMessage,
  onCheckConnection,
}: SettingsScreenProps): React.JSX.Element {
  const database = useDatabaseStatus();
  const systemRows: readonly SystemRow[] = [
    { label: "Aplicación", value: runtime?.appName ?? "Consultando..." },
    { label: "Versión", value: runtime?.appVersion ?? "Consultando..." },
    { label: "Sistema", value: runtime?.platform ?? "Consultando..." },
    {
      label: "Modo",
      value: runtime
        ? runtime.isPackaged
          ? "Producción"
          : "Desarrollo"
        : "Consultando...",
    },
    { label: "Electron", value: runtime?.versions.electron ?? "Consultando..." },
    { label: "Chrome", value: runtime?.versions.chrome ?? "Consultando..." },
    { label: "Node interno", value: runtime?.versions.node ?? "Consultando..." },
    {
      label: "Latencia IPC",
      value: latencyMs === null ? "Consultando..." : `${latencyMs} ms`,
    },
  ];
  const databaseRows: readonly SystemRow[] = [
    {
      label: "Archivo local",
      value: database.status?.databasePath ?? "Consultando...",
    },
    {
      label: "Versión del esquema",
      value: database.status
        ? `${database.status.schemaVersion} de ${database.status.latestSchemaVersion}`
        : "Consultando...",
    },
    {
      label: "Modo de diario",
      value: database.status?.journalMode.toUpperCase() ?? "Consultando...",
    },
    {
      label: "Tamaño",
      value: database.status
        ? formatByteSize(database.status.fileSizeBytes)
        : "Consultando...",
    },
    {
      label: "Proyectos",
      value: String(database.status?.projectCount ?? 0),
    },
    {
      label: "Snapshots",
      value: String(database.status?.snapshotCount ?? 0),
    },
    {
      label: "Respaldos",
      value: String(database.status?.backupCount ?? 0),
    },
    {
      label: "Último respaldo",
      value: formatDateTime(database.status?.lastBackupAt ?? null),
    },
  ];

  const connectionLabel =
    connectionState === "connected"
      ? "Conexión interna correcta"
      : connectionState === "error"
        ? "La conexión necesita revisión"
        : "Verificando conexión interna";
  const databaseVisualState =
    database.operationState === "error" || database.status?.integrity === "error"
      ? "error"
      : database.operationState === "ready"
        ? "connected"
        : "checking";
  const databaseStatusLabel =
    databaseVisualState === "connected"
      ? "SQLite íntegro"
      : databaseVisualState === "error"
        ? "SQLite con error"
        : database.operationState === "backing-up"
          ? "Creando respaldo"
          : "Verificando SQLite";

  return (
    <div className="screen-stack">
      <section className="screen-banner screen-banner--settings">
        <div>
          <span className="section-label">CONFIGURACIÓN Y SISTEMA</span>
          <h2>Control central de la aplicación</h2>
          <p>
            Comprueba la comunicación segura, SQLite, respaldos, FFmpeg y
            FFprobe sin exponer acceso directo al sistema operativo desde React.
          </p>
        </div>
        <span className="screen-banner__icon" aria-hidden="true">
          <AppIcon name="settings" size={34} />
        </span>
      </section>

      <div className="settings-grid">
        <section className="content-section">
          <div className="content-section__heading">
            <div>
              <span className="section-label">DIAGNÓSTICO</span>
              <h2>Estado del entorno</h2>
            </div>
            <span
              className={`connection-chip connection-chip--${connectionState}`}
            >
              <span className="connection-chip__dot" aria-hidden="true" />
              {connectionState === "connected"
                ? "Conectado"
                : connectionState === "error"
                  ? "Con error"
                  : "Verificando"}
            </span>
          </div>

          <div className="system-status-card">
            <span className="system-status-card__icon">
              <AppIcon
                name={connectionState === "error" ? "settings" : "shield"}
                size={26}
              />
            </span>
            <div>
              <strong>{connectionLabel}</strong>
              <p>
                {errorMessage ||
                  "El renderer, el preload y el proceso principal responden mediante canales autorizados."}
              </p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void onCheckConnection()}
              disabled={connectionState === "checking"}
            >
              {connectionState === "checking"
                ? "Verificando..."
                : "Probar conexión"}
            </button>
          </div>

          <div
            className="system-table"
            role="table"
            aria-label="Información del sistema"
          >
            {systemRows.map((row) => (
              <div className="system-table__row" role="row" key={row.label}>
                <span role="cell">{row.label}</span>
                <strong role="cell" title={row.value}>
                  {row.value}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <aside className="content-section settings-storage">
          <div className="content-section__heading">
            <div>
              <span className="section-label">ALMACENAMIENTO LOCAL</span>
              <h2>SQLite y respaldos</h2>
            </div>
            <span
              className={`connection-chip connection-chip--${databaseVisualState}`}
              aria-live="polite"
            >
              <span className="connection-chip__dot" aria-hidden="true" />
              {databaseStatusLabel}
            </span>
          </div>

          <div className="database-summary-card">
            <span className="database-summary-card__icon">
              <AppIcon
                name={databaseVisualState === "error" ? "settings" : "shield"}
                size={25}
              />
            </span>
            <div>
              <strong>
                {database.status?.integrity === "ok"
                  ? "Base local preparada"
                  : "Comprobando almacenamiento"}
              </strong>
              <p>
                {database.errorMessage ||
                  database.status?.integrityMessage ||
                  "SQLite se está inicializando."}
              </p>
            </div>
          </div>

          {database.lastCreatedBackup ? (
            <div className="backup-success" role="status">
              <AppIcon name="check" size={18} />
              <span>
                <strong>Respaldo creado</strong>
                <small>{database.lastCreatedBackup.fileName}</small>
              </span>
            </div>
          ) : null}

          <div
            className="system-table database-table"
            role="table"
            aria-label="Información de SQLite"
          >
            {databaseRows.map((row) => (
              <div className="system-table__row" role="row" key={row.label}>
                <span role="cell">{row.label}</span>
                <strong role="cell" title={row.value}>
                  {row.value}
                </strong>
              </div>
            ))}
          </div>

          <div className="database-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void database.refresh(true)}
              disabled={
                database.operationState === "checking" ||
                database.operationState === "backing-up"
              }
            >
              Comprobar integridad
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => void database.createBackup()}
              disabled={
                database.operationState === "checking" ||
                database.operationState === "backing-up"
              }
            >
              {database.operationState === "backing-up"
                ? "Respaldando..."
                : "Crear respaldo"}
            </button>
          </div>
        </aside>

        <MediaEngineStatusPanel />
      </div>
    </div>
  );
}

export { SettingsScreen, type SettingsScreenProps };
