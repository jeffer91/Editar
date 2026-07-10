/* =========================================================
Nombre completo: EditorScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/EditorScreen.tsx

Función o funciones:
- Mostrar la estructura visual del editor.
- Recibir y presentar el proyecto activo seleccionado.
- Guiar al usuario a Proyectos cuando no existe uno abierto.
========================================================= */

import type { ProjectDocument, TrackKind } from "../../../shared/domain";
import { AppIcon } from "../components/ui/AppIcon";

interface EditorScreenProps {
  readonly project: ProjectDocument | null;
  readonly onChooseProject: () => void;
}

const trackLabels: Readonly<Record<TrackKind, string>> = Object.freeze({
  video: "V",
  audio: "A",
  text: "T",
  overlay: "O",
  adjustment: "FX",
});

function EditorScreen({
  project,
  onChooseProject,
}: EditorScreenProps): React.JSX.Element {
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
        <aside className="editor-panel editor-panel--media">
          <div className="editor-panel__heading">
            <div>
              <span className="section-label">RECURSOS</span>
              <h2>Medios</h2>
            </div>
            <span className="panel-count">{project.media.length}</span>
          </div>

          <div className="editor-tool-list">
            <div className="editor-tool-item">
              <AppIcon name="video" size={18} />
              Videos
            </div>
            <div className="editor-tool-item">
              <AppIcon name="audio" size={18} />
              Audio
            </div>
            <div className="editor-tool-item">
              <AppIcon name="text" size={18} />
              Textos
            </div>
            <div className="editor-tool-item">
              <AppIcon name="transition" size={18} />
              Transiciones
            </div>
          </div>

          <div className="editor-panel__placeholder">
            {project.media.length === 0
              ? "Los archivos importados aparecerán aquí."
              : `${project.media.length} recursos disponibles en el proyecto.`}
          </div>
        </aside>

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
              <span>Clips</span>
              <small>{project.clips.length}</small>
            </div>
            <div className="property-row">
              <span>Textos</span>
              <small>{project.textLayers.length}</small>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

export { EditorScreen, type EditorScreenProps };
