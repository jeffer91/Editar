/* =========================================================
Nombre completo: MediaEngineStatusPanel.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/settings/MediaEngineStatusPanel.tsx

Función o funciones:
- Mostrar disponibilidad, versión y origen de FFmpeg y FFprobe.
- Permitir ejecutar una nueva comprobación desde Ajustes.
- Presentar errores sin exponer operaciones del sistema al renderer.
========================================================= */

import type {
  MediaToolSource,
  MediaToolStatus,
} from "../../../../shared/media-engine-contracts";
import { useMediaEngineStatus } from "../../app/use-media-engine-status";
import { AppIcon } from "../ui/AppIcon";

const sourceLabels: Readonly<Record<MediaToolSource, string>> = Object.freeze({
  environment: "Variable de entorno",
  packaged: "Recursos empaquetados",
  application: "Carpeta de la aplicación",
  workspace: "Recursos del proyecto",
  path: "PATH del sistema",
  unavailable: "No encontrado",
});

function ToolCard({ tool }: { readonly tool: MediaToolStatus }): React.JSX.Element {
  return (
    <article className="media-engine-card">
      <div className="media-engine-card__heading">
        <strong>{tool.name === "ffmpeg" ? "FFmpeg" : "FFprobe"}</strong>
        <span
          className={`media-engine-badge media-engine-badge--${tool.available ? "ready" : "missing"}`}
        >
          {tool.available ? "Disponible" : "No disponible"}
        </span>
      </div>

      <div className="media-engine-card__rows">
        <div className="media-engine-card__row">
          <span>Origen</span>
          <strong>{sourceLabels[tool.source]}</strong>
        </div>
        <div className="media-engine-card__row">
          <span>Versión</span>
          <strong>{tool.version ?? "No identificada"}</strong>
        </div>
        <div className="media-engine-card__row">
          <span>Comando</span>
          <code title={tool.command ?? undefined}>{tool.command ?? "No resuelto"}</code>
        </div>
        <div className="media-engine-card__row">
          <span>Comprobado</span>
          <strong>
            {new Intl.DateTimeFormat("es-EC", {
              dateStyle: "short",
              timeStyle: "medium",
            }).format(new Date(tool.checkedAt))}
          </strong>
        </div>
      </div>

      {tool.error ? <div className="media-engine-card__error">{tool.error}</div> : null}
    </article>
  );
}

function MediaEngineStatusPanel(): React.JSX.Element {
  const engine = useMediaEngineStatus();
  const statusLabel = engine.loading
    ? "Comprobando motores"
    : engine.status?.ready
      ? "Motores multimedia preparados"
      : "Configuración incompleta";
  const description = engine.errorMessage
    ? engine.errorMessage
    : engine.status?.ready
      ? "FFmpeg y FFprobe respondieron correctamente y están disponibles para los trabajos multimedia."
      : "FFprobe es necesario para analizar medios. FFmpeg se utilizará en los siguientes bloques para proxies, audio y render.";

  return (
    <section className="content-section media-engine-section">
      <div className="content-section__heading">
        <div>
          <span className="section-label">MOTORES MULTIMEDIA</span>
          <h2>FFmpeg y FFprobe</h2>
        </div>
        <span
          className={`connection-chip connection-chip--${engine.status?.ready ? "connected" : engine.loading ? "checking" : "error"}`}
          aria-live="polite"
        >
          <span className="connection-chip__dot" aria-hidden="true" />
          {engine.status?.ready ? "Preparados" : engine.loading ? "Comprobando" : "Incompletos"}
        </span>
      </div>

      <div className="media-engine-overview">
        <div className="media-engine-overview__identity">
          <span className="media-engine-overview__icon">
            <AppIcon name={engine.status?.ready ? "check" : "video"} size={24} />
          </span>
          <div>
            <strong>{statusLabel}</strong>
            <small>{description}</small>
          </div>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={engine.loading}
          onClick={() => void engine.refresh()}
        >
          {engine.loading ? "Comprobando…" : "Comprobar motores"}
        </button>
      </div>

      {engine.status ? (
        <div className="media-engine-grid">
          <ToolCard tool={engine.status.ffmpeg} />
          <ToolCard tool={engine.status.ffprobe} />
        </div>
      ) : null}
    </section>
  );
}

export { MediaEngineStatusPanel, ToolCard };
