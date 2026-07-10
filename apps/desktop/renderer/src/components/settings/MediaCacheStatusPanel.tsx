/* =========================================================
Nombre completo: MediaCacheStatusPanel.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/settings/MediaCacheStatusPanel.tsx

Función o funciones:
- Mostrar tamaño, archivos y derivados de la caché multimedia.
- Permitir actualizar el diagnóstico y limpiar archivos regenerables.
- Informar conflictos con trabajos activos sin exponer rutas operables.
========================================================= */

import { useMediaCache } from "../../app/use-media-cache";
import { AppIcon } from "../ui/AppIcon";

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** index;

  return `${new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: amount >= 100 ? 0 : 1,
  }).format(amount)} ${units[index]}`;
}

function MediaCacheStatusPanel(): React.JSX.Element {
  const cache = useMediaCache(true);
  const status = cache.status;
  const health =
    (status?.temporaryFileCount ?? 0) === 0 &&
    (status?.orphanFileCount ?? 0) === 0;

  const clearCache = async (): Promise<void> => {
    const confirmed = window.confirm(
      "Se eliminarán proxies, miniaturas y formas de onda. Los originales y proyectos no se modificarán. ¿Continuar?",
    );

    if (confirmed) {
      await cache.clear();
    }
  };

  return (
    <section className="content-section media-cache-section">
      <div className="content-section__heading">
        <div>
          <span className="section-label">CACHÉ MULTIMEDIA</span>
          <h2>Proxies y previsualizaciones</h2>
        </div>
        <span
          className={`connection-chip connection-chip--${cache.loading ? "checking" : cache.errorMessage ? "error" : "connected"}`}
          aria-live="polite"
        >
          <span className="connection-chip__dot" aria-hidden="true" />
          {cache.loading
            ? "Escaneando"
            : cache.errorMessage
              ? "Con error"
              : health
                ? "Ordenada"
                : "Reconciliada"}
        </span>
      </div>

      <div className="media-cache-overview">
        <span className="media-cache-overview__icon">
          <AppIcon name="library" size={25} />
        </span>
        <div>
          <strong>{formatBytes(status?.totalBytes ?? 0)} utilizados</strong>
          <p>
            La caché contiene archivos regenerables. Limpiarla no elimina medios
            originales, proyectos, clips ni metadatos de FFprobe.
          </p>
        </div>
      </div>

      {cache.message || cache.errorMessage ? (
        <div
          className={`media-cache-message ${cache.errorMessage ? "media-cache-message--error" : ""}`}
          role={cache.errorMessage ? "alert" : "status"}
        >
          <strong>{cache.errorMessage ? "No se pudo completar" : "Operación completada"}</strong>
          <span>{cache.errorMessage || cache.message}</span>
        </div>
      ) : null}

      <div className="media-cache-metrics">
        <article>
          <small>Archivos</small>
          <strong>{status?.fileCount ?? 0}</strong>
        </article>
        <article>
          <small>Derivados registrados</small>
          <strong>{status?.derivativeCount ?? 0}</strong>
        </article>
        <article>
          <small>Temporales</small>
          <strong>{status?.temporaryFileCount ?? 0}</strong>
        </article>
        <article>
          <small>Huérfanos</small>
          <strong>{status?.orphanFileCount ?? 0}</strong>
        </article>
      </div>

      <div className="media-cache-path" title={status?.rootPath}>
        <span>Ubicación administrada</span>
        <code>{status?.rootPath ?? "Consultando…"}</code>
      </div>

      <div className="media-cache-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={cache.loading || cache.clearing}
          onClick={() => void cache.refresh()}
        >
          {cache.loading ? "Escaneando…" : "Actualizar diagnóstico"}
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={cache.loading || cache.clearing || (status?.fileCount ?? 0) === 0}
          onClick={() => void clearCache()}
        >
          {cache.clearing ? "Limpiando…" : "Limpiar caché"}
        </button>
      </div>
    </section>
  );
}

export { MediaCacheStatusPanel, formatBytes };
