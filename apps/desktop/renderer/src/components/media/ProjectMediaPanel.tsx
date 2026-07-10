/* =========================================================
Nombre completo: ProjectMediaPanel.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/media/ProjectMediaPanel.tsx

Función o funciones:
- Mostrar los recursos registrados en el proyecto activo.
- Filtrar videos, audios e imágenes.
- Iniciar importaciones y presentar su resumen.
========================================================= */

import { useMemo, useState } from "react";
import type {
  MediaAsset,
  MediaKind,
  ProjectDocument,
} from "../../../../shared/domain";
import type { MediaImportResult } from "../../../../shared/media-import-contracts";
import { AppIcon } from "../ui/AppIcon";

type MediaFilter = "all" | MediaKind;

interface ProjectMediaPanelProps {
  readonly project: ProjectDocument;
  readonly importing: boolean;
  readonly errorMessage: string;
  readonly lastResult: MediaImportResult | null;
  readonly onImport: () => void;
  readonly onClearResult: () => void;
}

const filterLabels: Readonly<Record<MediaFilter, string>> = Object.freeze({
  all: "Todos",
  video: "Video",
  audio: "Audio",
  image: "Imagen",
});

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"] as const;
  let amount = value / 1024;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount.toFixed(amount >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function iconForKind(kind: MediaKind): "video" | "audio" | "library" {
  return kind === "video" ? "video" : kind === "audio" ? "audio" : "library";
}

function MediaAssetItem({ asset }: { readonly asset: MediaAsset }): React.JSX.Element {
  return (
    <article className="media-asset-item" title={asset.sourcePath}>
      <span className={`media-asset-item__icon media-asset-item__icon--${asset.kind}`}>
        <AppIcon name={iconForKind(asset.kind)} size={18} />
      </span>
      <span className="media-asset-item__content">
        <strong>{asset.fileName}</strong>
        <small>
          {asset.extension.toUpperCase()} · {formatBytes(asset.sizeBytes)}
        </small>
      </span>
      <span
        className={`media-inspection media-inspection--${asset.inspection.status}`}
        title={
          asset.inspection.status === "pending"
            ? "FFprobe completará los datos técnicos en el Bloque 9"
            : asset.inspection.error
        }
      >
        {asset.inspection.status === "pending"
          ? "Pendiente"
          : asset.inspection.status === "ready"
            ? "Analizado"
            : "Error"}
      </span>
    </article>
  );
}

function ProjectMediaPanel({
  project,
  importing,
  errorMessage,
  lastResult,
  onImport,
  onClearResult,
}: ProjectMediaPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const counts = useMemo(
    () => ({
      all: project.media.length,
      video: project.media.filter((asset) => asset.kind === "video").length,
      audio: project.media.filter((asset) => asset.kind === "audio").length,
      image: project.media.filter((asset) => asset.kind === "image").length,
    }),
    [project.media],
  );
  const visibleMedia = useMemo(
    () =>
      filter === "all"
        ? project.media
        : project.media.filter((asset) => asset.kind === filter),
    [filter, project.media],
  );

  return (
    <aside className="editor-panel editor-panel--media">
      <div className="editor-panel__heading">
        <div>
          <span className="section-label">RECURSOS</span>
          <h2>Medios</h2>
        </div>
        <span className="panel-count">{project.media.length}</span>
      </div>

      <button
        className="media-import-button"
        type="button"
        onClick={onImport}
        disabled={importing || project.project.status === "archived"}
      >
        <span aria-hidden="true">＋</span>
        {importing ? "Verificando archivos…" : "Importar medios"}
      </button>

      <div className="media-filter-tabs" role="tablist" aria-label="Filtrar medios">
        {(["all", "video", "audio", "image"] as const).map((value) => (
          <button
            className={`media-filter-tab ${filter === value ? "media-filter-tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={filter === value}
            key={value}
            onClick={() => setFilter(value)}
          >
            {filterLabels[value]}
            <span>{counts[value]}</span>
          </button>
        ))}
      </div>

      {errorMessage ? (
        <div className="media-import-message media-import-message--error" role="alert">
          <strong>La importación no pudo completarse</strong>
          <small>{errorMessage}</small>
        </div>
      ) : null}

      {lastResult && !lastResult.summary.canceled ? (
        <div className="media-import-message" role="status">
          <button type="button" aria-label="Cerrar resumen" onClick={onClearResult}>
            ×
          </button>
          <strong>
            {lastResult.summary.importedCount} importados ·{" "}
            {lastResult.summary.duplicateCount} duplicados
          </strong>
          <small>
            {lastResult.summary.rejectedCount > 0
              ? `${lastResult.summary.rejectedCount} archivos fueron rechazados.`
              : "Todos los archivos seleccionados fueron procesados."}
          </small>
        </div>
      ) : null}

      <div className="media-assets-list">
        {visibleMedia.length > 0 ? (
          visibleMedia.map((asset) => <MediaAssetItem asset={asset} key={asset.id} />)
        ) : (
          <div className="media-empty-state">
            <AppIcon name={filter === "audio" ? "audio" : filter === "video" ? "video" : "library"} size={24} />
            <strong>
              {project.media.length === 0
                ? "No hay medios importados"
                : `No hay recursos de ${filterLabels[filter].toLowerCase()}`}
            </strong>
            <small>
              Los videos originales no se copian ni se modifican durante el registro.
            </small>
          </div>
        )}
      </div>
    </aside>
  );
}

export { ProjectMediaPanel, type ProjectMediaPanelProps };
