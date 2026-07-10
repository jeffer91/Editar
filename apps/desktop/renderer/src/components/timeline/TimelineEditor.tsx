/* =========================================================
Nombre completo: TimelineEditor.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/timeline/TimelineEditor.tsx

Función o funciones:
- Representar clips con posición y duración proporcionales.
- Permitir seleccionar clips y controlar estados de pistas.
- Insertar plantillas de títulos y subtítulos animados.
========================================================= */

import { useMemo, useState } from "react";
import type {
  EntityId,
  ProjectDocument,
  TextTemplateId,
  TrackKind,
} from "../../../../shared/domain";

interface TimelineEditorProps {
  readonly project: ProjectDocument;
  readonly selectedClipId: EntityId<"clip"> | null;
  readonly busy: boolean;
  readonly onSelectClip: (clipId: EntityId<"clip"> | null) => void;
  readonly onUpdateTrack: (
    trackId: EntityId<"track">,
    state: { readonly muted?: boolean; readonly hidden?: boolean; readonly locked?: boolean },
  ) => void;
  readonly onAddText: (templateId: TextTemplateId) => void;
}

const trackLabels: Readonly<Record<TrackKind, string>> = Object.freeze({
  video: "Video",
  audio: "Audio",
  text: "Textos",
  overlay: "Superposición",
  adjustment: "Ajustes",
});

const templateButtons: readonly {
  readonly id: TextTemplateId;
  readonly label: string;
}[] = Object.freeze([
  { id: "title", label: "Título" },
  { id: "subtitle", label: "Subtítulo" },
  { id: "lower-third", label: "Rótulo" },
  { id: "caption", label: "Flotante" },
]);

function formatTime(microseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(microseconds / 1_000_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function TimelineEditor({
  project,
  selectedClipId,
  busy,
  onSelectClip,
  onUpdateTrack,
  onAddText,
}: TimelineEditorProps): React.JSX.Element {
  const [zoom, setZoom] = useState(1);
  const sequence =
    project.sequences.find(
      (candidate) => candidate.id === project.project.mainSequenceId,
    ) ?? project.sequences[0];
  const tracks = useMemo(
    () =>
      project.tracks
        .filter((track) => track.sequenceId === sequence?.id)
        .slice()
        .sort((left, right) => left.order - right.order),
    [project.tracks, sequence?.id],
  );
  const baseDurationUs = Math.max(sequence?.durationUs ?? 0, 20_000_000);
  const visibleDurationUs = Math.max(5_000_000, Math.round(baseDurationUs / zoom));
  const ticks = Array.from({ length: 6 }, (_, index) =>
    Math.round((visibleDurationUs * index) / 5),
  );
  const archived = project.project.status === "archived";

  return (
    <section className="timeline-editor" aria-label="Línea de tiempo funcional">
      <header className="timeline-editor__toolbar">
        <div>
          <span className="section-label">LÍNEA DE TIEMPO</span>
          <strong>{sequence?.name ?? "Secuencia principal"}</strong>
          <small>
            {project.clips.length} clips · {formatTime(sequence?.durationUs ?? 0)}
          </small>
        </div>

        <div className="timeline-editor__text-tools" aria-label="Añadir texto">
          {templateButtons.map((template) => (
            <button
              type="button"
              key={template.id}
              disabled={archived || busy}
              onClick={() => onAddText(template.id)}
            >
              + {template.label}
            </button>
          ))}
        </div>

        <label className="timeline-editor__zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="4"
            step="0.25"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </header>

      <div className="timeline-editor__ruler">
        <span className="timeline-editor__ruler-spacer" />
        <span className="timeline-editor__ruler-lane">
          {ticks.map((tick) => (
            <i
              key={tick}
              style={{ left: `${(tick / visibleDurationUs) * 100}%` }}
            >
              {formatTime(tick)}
            </i>
          ))}
        </span>
      </div>

      <div className="timeline-editor__tracks">
        {tracks.map((track) => {
          const clips = project.clips
            .filter((clip) => clip.trackId === track.id)
            .slice()
            .sort((left, right) => left.timelineStartUs - right.timelineStartUs);

          return (
            <div
              className={`timeline-editor__track ${track.locked ? "timeline-editor__track--locked" : ""}`}
              key={track.id}
            >
              <div className="timeline-editor__track-header">
                <strong>{trackLabels[track.kind]}</strong>
                <small>{track.name}</small>
                <span>
                  <button
                    type="button"
                    className={track.muted ? "is-active" : ""}
                    title={track.muted ? "Activar audio" : "Silenciar pista"}
                    disabled={archived || busy || track.kind === "text"}
                    onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={track.hidden ? "is-active" : ""}
                    title={track.hidden ? "Mostrar pista" : "Ocultar pista"}
                    disabled={archived || busy || track.kind === "audio"}
                    onClick={() => onUpdateTrack(track.id, { hidden: !track.hidden })}
                  >
                    O
                  </button>
                  <button
                    type="button"
                    className={track.locked ? "is-active" : ""}
                    title={track.locked ? "Desbloquear pista" : "Bloquear pista"}
                    disabled={archived || busy}
                    onClick={() => onUpdateTrack(track.id, { locked: !track.locked })}
                  >
                    L
                  </button>
                </span>
              </div>

              <div
                className={`timeline-editor__lane timeline-editor__lane--${track.kind}`}
                onClick={(event) => {
                  if (event.currentTarget === event.target) onSelectClip(null);
                }}
              >
                {clips.length === 0 ? (
                  <span className="timeline-editor__empty">Pista vacía</span>
                ) : null}
                {clips.map((clip) => {
                  const left = Math.min(
                    100,
                    (clip.timelineStartUs / visibleDurationUs) * 100,
                  );
                  const width = Math.max(
                    1.2,
                    Math.min(
                      100 - left,
                      (clip.durationUs / visibleDurationUs) * 100,
                    ),
                  );

                  return (
                    <button
                      type="button"
                      className={`timeline-clip timeline-clip--${clip.kind} ${selectedClipId === clip.id ? "timeline-clip--selected" : ""}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${clip.name} · ${formatTime(clip.durationUs)}`}
                      aria-pressed={selectedClipId === clip.id}
                      key={clip.id}
                      onClick={() => onSelectClip(clip.id)}
                    >
                      <strong>{clip.name}</strong>
                      <small>{formatTime(clip.durationUs)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export {
  TimelineEditor,
  formatTime,
  type TimelineEditorProps,
};
