/* =========================================================
Nombre completo: EditorScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/EditorScreen.tsx

Función o funciones:
- Integrar medios, línea de tiempo funcional e inspector de clips.
- Añadir, mover, recortar, dividir y eliminar clips persistentes.
- Crear, editar y previsualizar títulos y subtítulos animados.
========================================================= */

import { useEffect } from "react";
import type {
  EntityId,
  JobKind,
  ProjectDocument,
  SilenceReductionMode,
  TextTemplateId,
} from "../../../shared/domain";
import { useAudioProcessing } from "../app/use-audio-processing";
import { useMediaAnalysis } from "../app/use-media-analysis";
import { useMediaCache } from "../app/use-media-cache";
import { useMediaImport } from "../app/use-media-import";
import { useTimelineEditor } from "../app/use-timeline-editor";
import { ProjectMediaPanel } from "../components/media/ProjectMediaPanel";
import {
  ClipInspector,
  type ClipTimingInput,
} from "../components/timeline/ClipInspector";
import { TimelineEditor } from "../components/timeline/TimelineEditor";
import { AppIcon } from "../components/ui/AppIcon";

interface EditorScreenProps {
  readonly project: ProjectDocument | null;
  readonly onChooseProject: () => void;
  readonly onProjectChange: (project: ProjectDocument) => void;
}

const ACTIVE_MEDIA_JOB_KINDS: readonly JobKind[] = Object.freeze([
  "generate-proxy",
  "generate-waveform",
  "generate-thumbnails",
  "detect-silence",
  "reduce-silence",
]);

const TEXT_DEFAULT_CONTENT: Readonly<Record<TextTemplateId, string>> =
  Object.freeze({
    title: "Título principal",
    subtitle: "Escribe aquí el subtítulo",
    "lower-third": "Nombre\nCargo o descripción",
    caption: "Texto destacado",
  });

function hexToRgba(hex: string, opacity: number): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function EditorScreen({
  project,
  onChooseProject,
  onProjectChange,
}: EditorScreenProps): React.JSX.Element {
  const mediaImport = useMediaImport();
  const mediaAnalysis = useMediaAnalysis();
  const mediaCache = useMediaCache(false);
  const audioProcessing = useAudioProcessing();
  const timeline = useTimelineEditor();
  const pendingMediaCount =
    project?.media.filter((asset) => asset.inspection.status === "pending")
      .length ?? 0;

  useEffect(() => {
    if (!project) return undefined;
    let cancelled = false;

    const refreshWhenNeeded = async (): Promise<void> => {
      const queueResult = await window.editar.jobs.getSnapshot();
      const hasActiveMediaJobs =
        queueResult.ok &&
        queueResult.data.items.some(
          (item) =>
            item.job.projectId === project.project.id &&
            ACTIVE_MEDIA_JOB_KINDS.includes(item.job.kind) &&
            ["pending", "preparing", "running", "paused"].includes(
              item.job.status,
            ),
        );

      if (pendingMediaCount === 0 && !hasActiveMediaJobs) return;
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
          <button
            className="primary-button"
            type="button"
            onClick={onChooseProject}
          >
            Elegir proyecto
            <AppIcon name="arrow" size={18} />
          </button>
        </section>
      </div>
    );
  }

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
  const selectedClip = project.clips.find(
    (clip) => clip.id === timeline.selectedClipId,
  );
  const selectedTextLayerId =
    selectedClip?.source.type === "text"
      ? selectedClip.source.textLayerId
      : null;
  const selectedTextLayer = selectedTextLayerId
    ? project.textLayers.find((layer) => layer.id === selectedTextLayerId)
    : undefined;

  const applyDocument = (document: ProjectDocument | null): void => {
    if (document) onProjectChange(document);
  };

  const refreshProject = async (): Promise<void> => {
    const refreshed = await window.editar.projects.open({
      projectId: project.project.id,
    });
    if (refreshed.ok) onProjectChange(refreshed.data);
  };

  const importMedia = async (): Promise<void> => {
    const updatedProject = await mediaImport.chooseAndImport(project.project.id);
    if (updatedProject) onProjectChange(updatedProject);
  };

  const analyzeMedia = async (mediaId: EntityId<"media">): Promise<void> => {
    const accepted = await mediaAnalysis.analyze(project.project.id, mediaId);
    if (accepted) await refreshProject();
  };

  const optimizeMedia = async (mediaId: EntityId<"media">): Promise<void> => {
    const result = await mediaCache.generate(project.project.id, mediaId);
    if (result) await refreshProject();
  };

  const analyzeAudio = async (mediaId: EntityId<"media">): Promise<void> => {
    const result = await audioProcessing.analyze(project.project.id, mediaId);
    if (result) await refreshProject();
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
    if (result) await refreshProject();
  };

  const saveClipTiming = async (
    clipId: EntityId<"clip">,
    input: ClipTimingInput,
  ): Promise<void> => {
    const moved = await timeline.move(
      project.project.id,
      clipId,
      input.trackId,
      input.timelineStartMs,
    );
    if (!moved) return;

    onProjectChange(moved);
    const trimmed = await timeline.trim(
      project.project.id,
      clipId,
      input.timelineStartMs,
      input.durationMs,
      input.sourceStartMs,
    );
    applyDocument(trimmed);
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
            · {project.clips.length} clips · {project.textLayers.length} textos
          </small>
        </div>
        <span
          className={`project-status project-status--${project.project.status}`}
        >
          {project.project.status === "draft"
            ? "Borrador"
            : project.project.status === "active"
              ? "Activo"
              : "Archivado"}
        </span>
      </section>

      {timeline.message || timeline.errorMessage ? (
        <div
          className={`media-import-message ${timeline.errorMessage ? "media-import-message--error" : ""}`}
          role={timeline.errorMessage ? "alert" : "status"}
        >
          <button
            type="button"
            aria-label="Cerrar mensaje"
            onClick={timeline.clearMessages}
          >
            ×
          </button>
          <strong>
            {timeline.errorMessage
              ? "La edición no pudo guardarse"
              : "Edición guardada"}
          </strong>
          <small>{timeline.errorMessage || timeline.message}</small>
        </div>
      ) : null}

      <section className="editor-workbench" aria-label="Editor funcional">
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
          analysisErrorMessage={
            mediaAnalysis.errorMessage || mediaAnalysis.engine.errorMessage
          }
          cacheMessage={mediaCache.message}
          cacheErrorMessage={mediaCache.errorMessage}
          audioMessage={audioProcessing.message}
          audioErrorMessage={audioProcessing.errorMessage}
          onImport={() => void importMedia()}
          onAnalyze={(mediaId) => void analyzeMedia(mediaId)}
          onOptimize={(mediaId) => void optimizeMedia(mediaId)}
          onAnalyzeAudio={(mediaId) => void analyzeAudio(mediaId)}
          onReduceSilence={(mediaId, mode) =>
            void reduceSilence(mediaId, mode)
          }
          onClearResult={mediaImport.clearResult}
          onClearAnalysisMessages={mediaAnalysis.clearMessages}
          onClearCacheMessages={mediaCache.clearMessages}
          onClearAudioMessages={audioProcessing.clearMessages}
        />

        <div className="editor-center">
          <div className="editor-monitor">
            <div
              className="editor-monitor__canvas"
              style={{
                position: "relative",
                backgroundColor: project.project.canvas.backgroundColor,
              }}
            >
              {selectedTextLayer ? (
                <div
                  className={`editor-monitor__text-preview ${
                    selectedTextLayer.entranceAnimation
                      ? `editor-monitor__text-preview--${selectedTextLayer.entranceAnimation.presetId}`
                      : ""
                  }`}
                  style={{
                    color: selectedTextLayer.style.color,
                    backgroundColor: hexToRgba(
                      selectedTextLayer.style.backgroundColor,
                      selectedTextLayer.style.backgroundOpacity,
                    ),
                    fontFamily: selectedTextLayer.style.fontFamily,
                    fontSize: `${Math.max(
                      14,
                      selectedTextLayer.style.fontSizePx / 2.5,
                    )}px`,
                    fontWeight: selectedTextLayer.style.fontWeight,
                    fontStyle: selectedTextLayer.style.fontStyle,
                    lineHeight: selectedTextLayer.style.lineHeight,
                    letterSpacing: `${selectedTextLayer.style.letterSpacingPx}px`,
                    textAlign: selectedTextLayer.style.alignment,
                  }}
                >
                  {selectedTextLayer.content}
                </div>
              ) : (
                <>
                  <span className="editor-monitor__play">▶</span>
                  <small>
                    Selecciona un texto para previsualizar su animación
                  </small>
                </>
              )}
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

          <TimelineEditor
            project={project}
            selectedClipId={timeline.selectedClipId}
            busy={timeline.operation !== null}
            onSelectClip={timeline.selectClip}
            onAddMedia={(mediaId) =>
              void timeline
                .addMedia(project.project.id, mediaId)
                .then(applyDocument)
            }
            onAddText={(templateId) =>
              void timeline
                .addText(
                  project.project.id,
                  templateId,
                  TEXT_DEFAULT_CONTENT[templateId],
                )
                .then((document) => {
                  applyDocument(document);
                  if (document) {
                    const newest = document.clips.at(-1);
                    if (newest?.kind === "text") {
                      timeline.selectClip(newest.id);
                    }
                  }
                })
            }
            onUpdateTrack={(trackId, state) =>
              void timeline
                .setTrackState(project.project.id, trackId, state)
                .then(applyDocument)
            }
          />
        </div>

        <ClipInspector
          project={project}
          selectedClipId={timeline.selectedClipId}
          busy={timeline.operation !== null}
          onSaveTiming={(clipId, input) =>
            void saveClipTiming(clipId, input)
          }
          onSplit={(clipId, splitAtMs) =>
            void timeline
              .split(project.project.id, clipId, splitAtMs)
              .then(applyDocument)
          }
          onDelete={(clipId) =>
            void timeline
              .remove(project.project.id, clipId)
              .then(applyDocument)
          }
          onUpdateText={(clipId, input) =>
            void timeline
              .updateText(project.project.id, clipId, input)
              .then(applyDocument)
          }
        />
      </section>

      <section className="content-section content-section--compact">
        <div className="content-section__heading">
          <div>
            <span className="section-label">ESTADO DEL PROYECTO</span>
            <h2>Edición no destructiva</h2>
          </div>
          <p>
            {project.media.length} recursos · {audioAnalysisCount} audios
            analizados · {reducedCount} versiones reducidas · {derivativeCount}{" "}
            derivados
          </p>
        </div>
      </section>
    </div>
  );
}

export { ACTIVE_MEDIA_JOB_KINDS, EditorScreen, type EditorScreenProps };
