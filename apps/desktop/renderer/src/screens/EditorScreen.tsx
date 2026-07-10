/* =========================================================
Nombre completo: EditorScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/EditorScreen.tsx

Función o funciones:
- Mostrar la estructura visual del editor.
- Importar, analizar, optimizar y reducir silencios en medios.
- Refrescar resultados persistidos mientras existen trabajos activos.
========================================================= */

import { useEffect } from "react";
import type {
  EntityId,
  JobKind,
  ProjectDocument,
  SilenceReductionMode,
  TrackKind,
} from "../../../shared/domain";
import { useAudioProcessing } from "../app/use-audio-processing";
import { useMediaAnalysis } from "../app/use-media-analysis";
import { useMediaCache } from "../app/use-media-cache";
import { useMediaImport } from "../app/use-media-import";
import { ProjectMediaPanel } from "../components/media/ProjectMediaPanel";
import { AppIcon } from "../components/ui/AppIcon";

interface EditorScreenProps {
  readonly project: ProjectDocument | null;
  readonly onChooseProject: () => void;
  readonly onProjectChange: (project: ProjectDocument) => void;
}

const trackLabels: Readonly<Record<TrackKind, string>> = Object.freeze({
  video: "V",
  audio: "A",
  text: "T",
  overlay: "O",
  adjustment: "FX",
});

const ACTIVE_MEDIA_JOB_KINDS: readonly JobKind[] = Object.freeze([
  "generate-proxy",
  "generate-waveform",
  "generate-thumbnails",
  "detect-silence",
  "reduce-silence",
]);

function EditorScreen({
  project,
  onChooseProject,
  onProjectChange,
}: EditorScreenProps): React.JSX.Element {
  const mediaImport = useMediaImport();
  const mediaAnalysis = useMediaAnalysis();
  const mediaCache = useMediaCache(false);
  const audioProcessing = useAudioProcessing();
  const pendingMediaCount =
    project?.media.filter((asset) => asset.inspection.status === "pending").length ?? 0;

  useEffect(() => {
    if (!project) {
      return undefined;
    }

    let cancelled = false;

    const refreshWhenNeeded = async (): Promise<void> => {
      const queueResult = await window.editar.jobs.getSnapshot();
      const hasActiveMediaJobs =
        queueResult.ok &&
        queueResult.data.items.some(
          (item) =>
            item.job.projectId === project.project.id &&
            ACTIVE_MEDIA_JOB_KINDS.includes(item.job.kind) &&
            ["pending", "preparing", "running", "paused"].includes(item.job.status),
        );

      if (pendingMediaCount === 0 && !hasActiveMediaJobs) {
        return;
      }

      const projectResult = await window.editar.projects.open({
        projectId: project.project.id,
      });

      if (!cancelled && projectResult.ok) {
        onProjectChange(projectResult.data);
      }
    };
    const timer = window.setInterval(() => void refreshWhenNeeded(), 900);
    void refreshWhenNeeded();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onProjectChange, pendingMediaCount, project?.project.id]);

  if (!project) {
    return (
      <div className="screen-stack screen-stack--editor">
        <section className="editor-empty-project">
          <span className="editor-empty-project__icon">
            <AppIcon name="editor" size={34} />
          </span>
          <span className="section-label">EDITOR</span>
          <h2>No hay un proyecto abierto</h2>
          <p>
            Selecciona un proyecto guardado o crea uno nuevo para cargar su
            secuencia, pistas y recursos en el editor.
          </p>
          <button className="primary-button" type="button" onClick={onChooseProject}>
            Elegir proyecto
            <AppIcon name="arrow" size={18} />
          </button>
        </section>
      </div>
    );
  }

  const mainSequence =
    project.sequences.find(
      (sequence) => sequence.id === project.project.mainSequenceId,
    ) ?? project.sequences[0];
  const orderedTracks = [...project.tracks].sort(
    (left, right) => left.order - right.order,
  );
  const derivativeCount = project.media.reduce(
    (total, asset) => total + asset.derivatives.length,
    0,
  );
  const audioAnalysisCount = project.media.filter(
    (asset) => asset.audioAnalysis,
  ).length;
  const reducedCount = project.media.filter(
    (asset) => asset.silenceReduction,
  ).length;

  const refreshProject = async (): Promise<void> => {
    const refreshed = await window.editar.projects.open({
      projectId: project.project.id,
    });

    if (refreshed.ok) {
      onProjectChange(refreshed.data);
    }
  };

  const importMedia = async (): Promise<void> => {
    const updatedProject = await mediaImport.chooseAndImport(project.project.id);

    if (updatedProject) {
      onProjectChange(updatedProject);
    }
  };

  const analyzeMedia = async (mediaId: EntityId<"media">): Promise<void> => {
    const accepted = await mediaAnalysis.analyze(project.project.id, mediaId);

    if (accepted) {
      await refreshProject();
    }
  };

  const optimizeMedia = async (mediaId: EntityId<"media">): Promise<void> => {
    const result = await mediaCache.generate(project.project.id, mediaId);

    if (result) {
      await refreshProject();
    }
  };

  const analyzeAudio = async (mediaId: EntityId<"media">): Promise<void> => {
    const result = await audioProcessing.analyze(project.project.id, mediaId);

    if (result) {
      await refreshProject();
    }
  };

  const reduceSilence = async (
    mediaId: EntityId<"media">,
    mode: SilenceReductionMode,
  ): Promise<void> => {
    const result = await audioProcessing.reduce(
      project.project.id,
      mediaId,
      mode,
    );

    if (result) {
      await refreshProject();
    }
  };

  return (
    <div className="screen-stack screen-stack--editor">
      <section className="editor-notice">
        <span className="editor-notice__icon">
          <AppIcon name="editor" />
        </span>
        <div>
          <strong>{project.project.name}</strong>
          <small>
            {project.project.canvas.width} × {project.project.canvas.height} ·{" "}
            {project.project.canvas.aspectRatio} · {project.project.canvas.fps} FPS
          </small>
        </div>
        <span className={`project-status project-status--${project.project.status}`}>
          {project.project.status === "draft"
            ? "Borrador"
            : project.project.status === "active"
              ? "Activo"
              : "Archivado"}
        </span>
      </section>

      <section className="editor-workbench" aria-label="Estructura del editor">
        <ProjectMediaPanel
          project={project}
          importing={mediaImport.importing}
          errorMessage={mediaImport.errorMessage}
          lastResult={mediaImport.lastResult}
          engineStatus={mediaAnalysis.engine.status}
          analyzingMediaId={mediaAnalysis.activeMediaId}
          optimizingMediaId={mediaCache.activeMediaId}
          audioActiveMediaId={audioProcessing.activeMediaId}
          audioOperation={audioProcessing.operation}
          analysisMessage={mediaAnalysis.message}
          analysisErrorMessage={mediaAnalysis.errorMessage || mediaAnalysis.engine.errorMessage}
          cacheMessage={mediaCache.message}
          cacheErrorMessage={mediaCache.errorMessage}
          audioMessage={audioProcessing.message}
          audioErrorMessage={audioProcessing.errorMessage}
          onImport={() => void importMedia()}
          onAnalyze={(mediaId) => void analyzeMedia(mediaId)}
          onOptimize={(mediaId) => void optimizeMedia(mediaId)}
          onAnalyzeAudio={(mediaId) => void analyzeAudio(mediaId)}
          onReduceSilence={(mediaId, mode) => void reduceSilence(mediaId, mode)}
          onClearResult={mediaImport.clearResult}
          onClearAnalysisMessages={mediaAnalysis.clearMessages}
          onClearCacheMessages={mediaCache.clearMessages}
          onClearAudioMessages={audioProcessing.clearMessages}
        />

        <div className="editor-center">
          <div className="editor-monitor">
            <div
              className="editor-monitor__canvas"
              style={{ backgroundColor: project.project.canvas.backgroundColor }}
            >
              <span className="editor-monitor__play">▶</span>
              <small>Monitor de vista previa</small>
            </div>
            <div className="editor-monitor__controls">
              <span>00:00:00:00</span>
              <div className="editor-monitor__transport">
                <span>◀</span>
                <span>▶</span>
                <span>▶▶</span>
              </div>
              <span>100%</span>
            </div>
          </div>

          <div className="editor-timeline">
            <div className="editor-timeline__toolbar">
              <div>
                <span className="section-label">LÍNEA DE TIEMPO</span>
                <strong>{mainSequence?.name ?? "Secuencia principal"}</strong>
              </div>
              <span className="status-tag">
                {project.clips.length} clips · {orderedTracks.length} pistas
              </span>
            </div>

            <div className="timeline-ruler">
              <span>00:00</span>
              <span>00:05</span>
              <span>00:10</span>
              <span>00:15</span>
              <span>00:20</span>
            </div>

            <div className="timeline-tracks">
              {orderedTracks.map((track, index) => {
                const clips = project.clips.filter(
                  (clip) => clip.trackId === track.id,
                );

                return (
                  <div className="timeline-track-row" key={track.id}>
                    <span
                      className="timeline-track-row__label"
                      title={track.name}
                    >
                      {trackLabels[track.kind]}
                      {index + 1}
                    </span>
                    <span className="timeline-track-row__lane">
                      {clips.length === 0 ? (
                        <i className="timeline-empty-label">Pista vacía</i>
                      ) : (
                        clips.map((clip) => (
                          <i
                            className={`timeline-placeholder timeline-placeholder--${
                              track.kind === "audio"
                                ? "audio"
                                : track.kind === "text"
                                  ? "text"
                                  : "video"
                            }`}
                            title={clip.name}
                            key={clip.id}
                          />
                        ))
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="editor-panel editor-panel--properties">
          <div className="editor-panel__heading">
            <div>
              <span className="section-label">PROYECTO</span>
              <h2>Propiedades</h2>
            </div>
          </div>

          <div className="property-group">
            <strong>Lienzo</strong>
            <div className="property-row">
              <span>Resolución</span>
              <small>
                {project.project.canvas.width} × {project.project.canvas.height}
              </small>
            </div>
            <div className="property-row">
              <span>Formato</span>
              <small>{project.project.canvas.aspectRatio}</small>
            </div>
            <div className="property-row">
              <span>Fotogramas</span>
              <small>{project.project.canvas.fps} FPS</small>
            </div>
          </div>

          <div className="property-group">
            <strong>Contenido</strong>
            <div className="property-row">
              <span>Recursos</span>
              <small>{project.media.length}</small>
            </div>
            <div className="property-row">
              <span>Analizados</span>
              <small>
                {project.media.filter((asset) => asset.inspection.status === "ready").length}
              </small>
            </div>
            <div className="property-row">
              <span>Audio analizado</span>
              <small>{audioAnalysisCount}</small>
            </div>
            <div className="property-row">
              <span>Sin silencios</span>
              <small>{reducedCount}</small>
            </div>
            <div className="property-row">
              <span>Derivados</span>
              <small>{derivativeCount}</small>
            </div>
            <div className="property-row">
              <span>Clips</span>
              <small>{project.clips.length}</small>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

export { ACTIVE_MEDIA_JOB_KINDS, EditorScreen, type EditorScreenProps };
