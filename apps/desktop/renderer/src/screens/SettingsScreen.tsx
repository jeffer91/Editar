/* =========================================================
Nombre completo: SettingsScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/SettingsScreen.tsx

Función o funciones:
- Mostrar información del entorno y conectividad interna.
- Centralizar la futura configuración general de la aplicación.
- Permitir repetir la prueba IPC desde una pantalla dedicada.
========================================================= */

import type { RuntimeInfo } from "../../../shared/ipc-contracts";
import type { ConnectionState } from "../app/use-system-status";
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

function SettingsScreen({
  runtime,
  connectionState,
  latencyMs,
  errorMessage,
  onCheckConnection,
}: SettingsScreenProps): React.JSX.Element {
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

  const connectionLabel =
    connectionState === "connected"
      ? "Conexión interna correcta"
      : connectionState === "error"
        ? "La conexión necesita revisión"
        : "Verificando conexión interna";

  return (
    <div className="screen-stack">
      <section className="screen-banner screen-banner--settings">
        <div>
          <span className="section-label">CONFIGURACIÓN Y SISTEMA</span>
          <h2>Control central de la aplicación</h2>
          <p>
            Esta pantalla concentrará preferencias, rendimiento, almacenamiento,
            motores multimedia y diagnóstico. Por ahora verifica la comunicación
            segura construida en el Bloque 2.
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
              {connectionState === "checking" ? "Verificando..." : "Probar conexión"}
            </button>
          </div>

          <div className="system-table" role="table" aria-label="Información del sistema">
            {systemRows.map((row) => (
              <div className="system-table__row" role="row" key={row.label}>
                <span role="cell">{row.label}</span>
                <strong role="cell">{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <aside className="content-section settings-roadmap">
          <div className="content-section__heading">
            <div>
              <span className="section-label">PRÓXIMAS OPCIONES</span>
              <h2>Ajustes futuros</h2>
            </div>
          </div>

          <ul className="settings-list">
            <li>
              <AppIcon name="video" size={18} />
              <span>
                <strong>Video y rendimiento</strong>
                <small>Proxy, resolución y aceleración.</small>
              </span>
            </li>
            <li>
              <AppIcon name="audio" size={18} />
              <span>
                <strong>Audio</strong>
                <small>Dispositivos, volumen y normalización.</small>
              </span>
            </li>
            <li>
              <AppIcon name="projects" size={18} />
              <span>
                <strong>Almacenamiento</strong>
                <small>Proyectos, caché y temporales.</small>
              </span>
            </li>
            <li>
              <AppIcon name="settings" size={18} />
              <span>
                <strong>Motores</strong>
                <small>FFmpeg, FFprobe y modelos locales.</small>
              </span>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

export { SettingsScreen, type SettingsScreenProps };
