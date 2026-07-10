/* =========================================================
Nombre completo: ProjectMediaPanel.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/media/ProjectMediaPanel.tsx

Función o funciones:
- Mostrar recursos y metadatos técnicos reales.
- Informar disponibilidad de FFprobe y estado de análisis.
- Permitir volver a analizar recursos pendientes o fallidos.
========================================================= */

import { useMemo, useState } from "react";
import type {
  EntityId,
  MediaAsset,
  MediaKind,
  ProjectDocument,
} from "../../../../shared/domain";
import type { MediaEngineStatus } from "../../../../shared/media-engine-contracts";
import type { MediaImportResult } from "../../../../shared/media-import-contracts";
import { AppIcon } from "../ui/AppIcon";

type MediaFilter = "all" | MediaKind;

interface ProjectMediaPanelProps {
  readonly project: ProjectDocument;
  readonly importing: boolean;
  readonly errorMessage: string;
  readonly lastResult: MediaImportResult | null;
  readonly engineStatus: MediaEngineStatus | null;
  readonly analyzingMediaId: EntityId<"media"> | null;
  readonly analysisMessage: string;
  readonly analysisErrorMessage: string;
  readonly onImport: () => void;
  readonly onAnalyze: (mediaId: EntityId<"media">) => void;
  readonly onClearResult: () => void;
  readonly onClearAnalysisMessages: () => void;
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

function formatDuration(microseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(microseconds / 1_000_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatFrameRate(numerator: number, denominator: number): string {
  const value = numerator / denominator;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function metadataSummary(asset: MediaAsset): string {
  const metadata = asset.metadata;

  if (!metadata) {
    return `${asset.extension.toUpperCase()} · ${formatBytes(asset.sizeBytes)}`;
  }

  if (metadata.kind === "image") {
    return `${metadata.width} × ${metadata.height} · ${metadata.imageCodec.toUpperCase()}`;
  }

  if (metadata.kind === "audio") {
    return `${formatDuration(metadata.durationUs)} · ${metadata.audio.codec.toUpperCase()} · ${Math.round(metadata.audio.sampleRate / 1_000)} kHz · ${metadata.audio.channels} ch`;
  }

  const audio = metadata.audio
    ? ` · ${metadata.audio.codec.toUpperCase()} ${metadata.audio.channels} ch`
    : " · sin audio";

  return `${formatDuration(metadata.durationUs)} · ${metadata.width} × ${metadata.height} · ${formatFrameRate(metadata.frameRate.numerator, metadata.frameRate.denominator)} FPS · ${metadata.videoCodec.toUpperCase()}${audio}`;
}

function iconForKind(kind: MediaKind): "video" | "audio" | "library" {
  return kind === "video" ? "video" : kind === "audio" ? "audio" : "library";
}

function MediaAssetItem({
  asset,
  ffprobeAvailable,
  analyzing,
  projectArchived,
  onAnalyze,
}: {
  readonly asset: MediaAsset;
  readonly ffprobeAvailable: boolean;
  readonly analyzing: boolean;
  readonly projectArchived: boolean;
  readonly onAnalyze: (mediaId: EntityId<"media">) => void;
}): React.JSX.Element {
  const canAnalyze =
    ffprobeAvailable &&
    !projectArchived &&
    asset.availability === "online" &&
    asset.inspection.status !== "ready";
  const inspectionTitle =
    asset.inspection.status === "pending"
      ? ffprobeAvailable
        ? "El análisis está pendiente o en cola."
        : "FFprobe no está disponible en este equipo."
      : asset.inspection.error;

  return (
    <article className="media-asset-item media-asset-item--technical" title={asset.sourcePath}>
      <span className={`media-asset-item__icon media-asset-item__icon--${asset.kind}`}>
        <AppIcon name={iconForKind(asset.kind)} size={18} />
      </span>
      <span className="media-asset-item__content">
        <strong>{asset.fileName}</strong>
        <small>{metadataSummary(asset)}</small>
        {asset.inspection.status === "failed" && asset.inspection.error ? (
          <em>{asset.inspection.error}</em>
        ) : null}
      </span>
      <span className="media-asset-item__status-column">
        <span
          className={`media-inspection media-inspection--${asset.inspection.status}`}
          title={inspectionTitle}
        >
          {asset.inspection.status === "pending"
            ? "Pendiente"
            : asset.inspection.status === "ready"
              ? "Analizado"
              : "Error"}
        </span>
        {canAnalyze ? (
          <button
            className="media-analyze-button"
            type="button"
            disabled={analyzing}
            onClick={() => onAnalyze(asset.id)}
          >
            {analyzing ? "Encolando…" : "Analizar"}
          </button>
        ) : null}
      </span>
    </article>
  );
}

function ProjectMediaPanel({
  project,
  importing,
  errorMessage,
  lastResult,
  engineStatus,
  analyzingMediaId,
  analysisMessage,
  analysisErrorMessage,
  onImport,
  onAnalyze,
  onClearResult,
  onClearAnalysisMessages,
}: ProjectMediaPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const ffprobeAvailable = engineStatus?.ffprobe.available ?? false;
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
        <span
          className={`media-engine-mini media-engine-mini--${ffprobeAvailable ? "ready" : "missing"}`}
          title={engineStatus?.ffprobe.version ?? engineStatus?.ffprobe.error ?? "Comprobando FFprobe"}
        >
          FFprobe {ffprobeAvailable ? "listo" : "no disponible"}
        </span>
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

      {analysisMessage || analysisErrorMessage ? (
        <div
          className={`media-import-message ${analysisErrorMessage ? "media-import-message--error" : ""}`}
          role={analysisErrorMessage ? "alert" : "status"}
        >
          <button type="button" aria-label="Cerrar mensaje" onClick={onClearAnalysisMessages}>
            ×
          </button>
          <strong>{analysisErrorMessage ? "No se pudo analizar" : "Análisis solicitado"}</strong>
          <small>{analysisErrorMessage || analysisMessage}</small>
        </div>
      ) : null}

      {lastResult && !lastResult.summary.canceled ? (
        <div className="media-import-message" role="status">
          <button type="button" aria-label="Cerrar resumen" onClick={onClearResult}>
            ×
          </button>
          <strong>
            {lastResult.summary.importedCount} importados ·{" "}
            {lastResult.summary.analysisQueuedCount} análisis en cola
          </strong>
          <small>
            {lastResult.summary.analysisDeferredCount > 0
              ? `${lastResult.summary.analysisDeferredCount} análisis quedaron pendientes porque FFprobe no estaba disponible.`
              : lastResult.summary.rejectedCount > 0
                ? `${lastResult.summary.rejectedCount} archivos fueron rechazados.`
                : "Los archivos válidos fueron registrados y enviados a análisis."}
          </small>
        </div>
      ) : null}

      <div className="media-assets-list">
        {visibleMedia.length > 0 ? (
          visibleMedia.map((asset) => (
            <MediaAssetItem
              asset={asset}
              ffprobeAvailable={ffprobeAvailable}
              analyzing={analyzingMediaId === asset.id}
              projectArchived={project.project.status === "archived"}
              key={asset.id}
              onAnalyze={onAnalyze}
            />
          ))
        ) : (
          <div className="media-empty-state">
            <AppIcon name={filter === "audio" ? "audio" : filter === "video" ? "video" : "library"} size={24} />
            <strong>
              {project.media.length === 0
                ? "No hay medios importados"
                : `No hay recursos de ${filterLabels[filter].toLowerCase()}`}
            </strong>
            <small>
              Los originales no se copian ni se modifican durante el análisis.
            </small>
          </div>
        )}
      </div>
    </aside>
  );
}

export { ProjectMediaPanel, type ProjectMediaPanelProps };
