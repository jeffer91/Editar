/* =========================================================
Nombre completo: App.tsx
Ruta o ubicación: /apps/desktop/renderer/src/App.tsx

Función o funciones:
- Mostrar el estado del Bloque 2.
- Consultar información mediante IPC tipado y validado.
- Probar la conexión entre renderer, preload y proceso principal.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import type { RuntimeInfo } from "../../shared/ipc-contracts";

interface StatusItem {
  readonly label: string;
  readonly value: string;
}

type ConnectionState = "checking" | "connected" | "error";

const foundations = [
  "Canales IPC declarados y tipados",
  "Solicitudes identificadas y validadas",
  "Remitentes y navegación controlados",
  "Contratos listos para nuevos módulos",
] as const;

function App(): React.JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const checkConnection = useCallback(async (): Promise<void> => {
    setConnectionState("checking");
    setErrorMessage("");

    const startedAt = performance.now();

    try {
      const [runtimeResult, pingResult] = await Promise.all([
        window.editar.system.getRuntimeInfo(),
        window.editar.system.ping(),
      ]);

      if (!runtimeResult.ok) {
        throw new Error(runtimeResult.error.message);
      }

      if (!pingResult.ok) {
        throw new Error(pingResult.error.message);
      }

      setRuntime(runtimeResult.data);
      setLatencyMs(Math.max(0, Math.round(performance.now() - startedAt)));
      setConnectionState("connected");
    } catch (error) {
      setRuntime(null);
      setLatencyMs(null);
      setConnectionState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible verificar la comunicación interna.",
      );
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const statusItems: readonly StatusItem[] = [
    { label: "Aplicación", value: runtime?.appName ?? "Consultando..." },
    { label: "Versión", value: runtime?.appVersion ?? "Consultando..." },
    { label: "Sistema", value: runtime?.platform ?? "Consultando..." },
    { label: "Electron", value: runtime?.versions.electron ?? "Consultando..." },
    {
      label: "Modo",
      value: runtime ? (runtime.isPackaged ? "Producción" : "Desarrollo") : "Consultando...",
    },
    {
      label: "Latencia IPC",
      value: latencyMs === null ? "Consultando..." : `${latencyMs} ms`,
    },
  ];

  const healthLabel =
    connectionState === "connected"
      ? "IPC conectado"
      : connectionState === "error"
        ? "IPC con error"
        : "Verificando IPC";

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            E
          </div>
          <div>
            <strong>Editar</strong>
            <span>Video inteligente</span>
          </div>
        </div>

        <nav className="navigation">
          <button className="navigation-item navigation-item--active" type="button">
            Inicio
          </button>
          <button className="navigation-item" type="button" disabled>
            Proyectos
          </button>
          <button className="navigation-item" type="button" disabled>
            Editor
          </button>
          <button className="navigation-item" type="button" disabled>
            Ajustes
          </button>
        </nav>

        <div className="sidebar-note">
          <span className="status-dot" aria-hidden="true" />
          Bloque 2 en ejecución
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SEGURIDAD Y COMUNICACIÓN</p>
            <h1>Editor modular de video</h1>
          </div>
          <span className="version-chip">v0.1.0</span>
        </header>

        <section className="hero-card">
          <div className="hero-copy">
            <span className="hero-badge">Bloque 2</span>
            <h2>La comunicación interna ahora está controlada</h2>
            <p>
              React solo puede usar funciones declaradas por el preload. Cada
              solicitud pasa por canales permitidos, validación de contenido y
              comprobación del origen antes de llegar a Electron.
            </p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="timeline-line timeline-line--one" />
            <div className="timeline-line timeline-line--two" />
            <div className="timeline-line timeline-line--three" />
            <div className="play-symbol">✓</div>
          </div>
        </section>

        <section className="section" aria-labelledby="runtime-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PRUEBA DE EXTREMO A EXTREMO</p>
              <h2 id="runtime-title">Comunicación Electron</h2>
            </div>
            <div className="ipc-actions">
              <span
                className={`health-pill health-pill--${connectionState}`}
                aria-live="polite"
              >
                {healthLabel}
              </span>
              <button
                className="ipc-button"
                type="button"
                onClick={() => void checkConnection()}
                disabled={connectionState === "checking"}
              >
                {connectionState === "checking" ? "Verificando..." : "Probar IPC"}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <p className="ipc-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="status-grid status-grid--six">
            {statusItems.map((item) => (
              <article className="status-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="foundation-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FUNDAMENTOS DE SEGURIDAD</p>
              <h2 id="foundation-title">Preparada para nuevos canales</h2>
            </div>
          </div>

          <div className="foundation-grid">
            {foundations.map((foundation, index) => (
              <article className="foundation-card" key={foundation}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{foundation}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export { App };
