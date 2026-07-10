/* =========================================================
Nombre completo: ClipInspector.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/timeline/ClipInspector.tsx

Función o funciones:
- Editar posición, duración, pista y punto de entrada de clips.
- Dividir o eliminar el clip seleccionado.
- Editar contenido, estilo y animaciones de textos.
========================================================= */

import { useEffect, useMemo, useState } from "react";
import {
  TEXT_ANIMATION_PRESET_IDS,
  type EntityId,
  type ProjectDocument,
  type TextAnimationPresetId,
  type TextStyle,
} from "../../../../shared/domain";

interface ClipTimingInput {
  readonly trackId: EntityId<"track">;
  readonly timelineStartMs: number;
  readonly durationMs: number;
  readonly sourceStartMs?: number;
}

interface TextInspectorInput {
  readonly content: string;
  readonly style: Partial<TextStyle>;
  readonly entrancePresetId: TextAnimationPresetId | null;
  readonly entranceDurationMs: number;
  readonly exitPresetId: TextAnimationPresetId | null;
  readonly exitDurationMs: number;
}

interface ClipInspectorProps {
  readonly project: ProjectDocument;
  readonly selectedClipId: EntityId<"clip"> | null;
  readonly busy: boolean;
  readonly onSaveTiming: (
    clipId: EntityId<"clip">,
    input: ClipTimingInput,
  ) => void;
  readonly onSplit: (clipId: EntityId<"clip">, splitAtMs: number) => void;
  readonly onDelete: (clipId: EntityId<"clip">) => void;
  readonly onUpdateText: (
    clipId: EntityId<"clip">,
    input: TextInspectorInput,
  ) => void;
}

function seconds(microseconds: number): number {
  return Number((microseconds / 1_000_000).toFixed(3));
}

function ClipInspector({
  project,
  selectedClipId,
  busy,
  onSaveTiming,
  onSplit,
  onDelete,
  onUpdateText,
}: ClipInspectorProps): React.JSX.Element {
  const clip = project.clips.find((candidate) => candidate.id === selectedClipId);
  const textLayerId =
    clip?.source.type === "text" ? clip.source.textLayerId : null;
  const mediaId = clip?.source.type === "media" ? clip.source.mediaId : null;
  const layer = textLayerId
    ? project.textLayers.find((candidate) => candidate.id === textLayerId)
    : undefined;
  const selectedMedia = mediaId
    ? project.media.find((candidate) => candidate.id === mediaId)
    : undefined;
  const compatibleTracks = useMemo(() => {
    if (!clip) return [];

    return project.tracks.filter((track) => {
      if (clip.kind === "text") {
        return track.kind === "text" || track.kind === "overlay";
      }

      if (clip.kind === "generator") {
        return track.kind === "video" || track.kind === "overlay";
      }

      if (clip.kind === "adjustment") {
        return track.kind === "adjustment";
      }

      if (selectedMedia?.kind === "audio") {
        return track.kind === "audio";
      }

      if (selectedMedia?.kind === "image") {
        return track.kind === "video" || track.kind === "overlay";
      }

      if (selectedMedia?.kind === "video") {
        const hasAudio =
          selectedMedia.metadata?.kind === "video" &&
          selectedMedia.metadata.audio !== undefined;

        return (
          track.kind === "video" ||
          track.kind === "overlay" ||
          (track.kind === "audio" && hasAudio)
        );
      }

      return track.id === clip.trackId;
    });
  }, [clip, project.tracks, selectedMedia]);

  const [trackId, setTrackId] = useState("");
  const [startSeconds, setStartSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(1);
  const [sourceStartSeconds, setSourceStartSeconds] = useState(0);
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(64);
  const [fontWeight, setFontWeight] = useState(700);
  const [color, setColor] = useState("#FFFFFF");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [backgroundOpacity, setBackgroundOpacity] = useState(0);
  const [alignment, setAlignment] =
    useState<TextStyle["alignment"]>("center");
  const [entrance, setEntrance] =
    useState<TextAnimationPresetId | "none">("none");
  const [entranceDuration, setEntranceDuration] = useState(350);
  const [exit, setExit] =
    useState<TextAnimationPresetId | "none">("none");
  const [exitDuration, setExitDuration] = useState(250);

  useEffect(() => {
    if (!clip) return;

    setTrackId(clip.trackId);
    setStartSeconds(seconds(clip.timelineStartUs));
    setDurationSeconds(seconds(clip.durationUs));
    setSourceStartSeconds(
      clip.source.type === "media" ? seconds(clip.source.sourceStartUs) : 0,
    );

    if (layer) {
      setContent(layer.content);
      setFontSize(layer.style.fontSizePx);
      setFontWeight(layer.style.fontWeight);
      setColor(layer.style.color);
      setBackgroundColor(layer.style.backgroundColor);
      setBackgroundOpacity(layer.style.backgroundOpacity);
      setAlignment(layer.style.alignment);
      setEntrance(layer.entranceAnimation?.presetId ?? "none");
      setEntranceDuration(layer.entranceAnimation?.durationMs ?? 350);
      setExit(layer.exitAnimation?.presetId ?? "none");
      setExitDuration(layer.exitAnimation?.durationMs ?? 250);
    }
  }, [clip, layer]);

  if (!clip) {
    return (
      <aside className="clip-inspector clip-inspector--empty">
        <span className="section-label">PROPIEDADES</span>
        <h2>Selecciona un clip</h2>
        <p>
          Haz clic en un clip para moverlo, recortarlo, dividirlo o editar su
          texto.
        </p>
        <dl>
          <div><dt>Clips</dt><dd>{project.clips.length}</dd></div>
          <div><dt>Textos</dt><dd>{project.textLayers.length}</dd></div>
          <div><dt>Duración</dt><dd>{seconds(project.sequences[0]?.durationUs ?? 0)} s</dd></div>
        </dl>
      </aside>
    );
  }

  const locked =
    project.project.status === "archived" ||
    project.tracks.find((track) => track.id === clip.trackId)?.locked === true;
  const splitAtMs = Math.round(
    (clip.timelineStartUs + clip.durationUs / 2) / 1_000,
  );

  return (
    <aside className="clip-inspector">
      <div className="clip-inspector__heading">
        <div>
          <span className="section-label">CLIP SELECCIONADO</span>
          <h2>{clip.name}</h2>
        </div>
        <span>{clip.kind}</span>
      </div>

      <fieldset disabled={busy || locked}>
        <legend>Tiempo y pista</legend>
        <label>
          Pista
          <select
            value={trackId}
            onChange={(event) => setTrackId(event.target.value)}
          >
            {compatibleTracks.map((track) => (
              <option value={track.id} key={track.id}>{track.name}</option>
            ))}
          </select>
        </label>
        <div className="clip-inspector__grid">
          <label>
            Inicio (s)
            <input
              type="number"
              min="0"
              step="0.01"
              value={startSeconds}
              onChange={(event) => setStartSeconds(Number(event.target.value))}
            />
          </label>
          <label>
            Duración (s)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(Number(event.target.value))}
            />
          </label>
        </div>
        {clip.source.type === "media" ? (
          <label>
            Punto de entrada (s)
            <input
              type="number"
              min="0"
              step="0.01"
              value={sourceStartSeconds}
              onChange={(event) =>
                setSourceStartSeconds(Number(event.target.value))
              }
            />
          </label>
        ) : null}
        <button
          className="clip-inspector__save"
          type="button"
          onClick={() =>
            onSaveTiming(clip.id, {
              trackId: trackId as EntityId<"track">,
              timelineStartMs: Math.round(startSeconds * 1_000),
              durationMs: Math.round(durationSeconds * 1_000),
              sourceStartMs:
                clip.source.type === "media"
                  ? Math.round(sourceStartSeconds * 1_000)
                  : undefined,
            })
          }
        >
          Guardar posición y recorte
        </button>
      </fieldset>

      {layer ? (
        <fieldset disabled={busy || locked}>
          <legend>Texto y estilo</legend>
          <label>
            Contenido
            <textarea
              value={content}
              rows={4}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <div className="clip-inspector__grid">
            <label>
              Tamaño
              <input
                type="number"
                min="8"
                max="300"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </label>
            <label>
              Peso
              <select
                value={fontWeight}
                onChange={(event) => setFontWeight(Number(event.target.value))}
              >
                {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                  <option value={weight} key={weight}>{weight}</option>
                ))}
              </select>
            </label>
            <label>
              Color
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
            <label>
              Fondo
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
              />
            </label>
            <label>
              Opacidad fondo
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={backgroundOpacity}
                onChange={(event) =>
                  setBackgroundOpacity(Number(event.target.value))
                }
              />
            </label>
            <label>
              Alineación
              <select
                value={alignment}
                onChange={(event) =>
                  setAlignment(event.target.value as TextStyle["alignment"])
                }
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
                <option value="justify">Justificado</option>
              </select>
            </label>
          </div>
          <div className="clip-inspector__grid">
            <label>
              Entrada
              <select
                value={entrance}
                onChange={(event) =>
                  setEntrance(
                    event.target.value as TextAnimationPresetId | "none",
                  )
                }
              >
                <option value="none">Sin animación</option>
                {TEXT_ANIMATION_PRESET_IDS.map((preset) => (
                  <option value={preset} key={preset}>{preset}</option>
                ))}
              </select>
            </label>
            <label>
              Duración entrada
              <input
                type="number"
                min="0"
                max="60000"
                value={entranceDuration}
                onChange={(event) =>
                  setEntranceDuration(Number(event.target.value))
                }
              />
            </label>
            <label>
              Salida
              <select
                value={exit}
                onChange={(event) =>
                  setExit(event.target.value as TextAnimationPresetId | "none")
                }
              >
                <option value="none">Sin animación</option>
                {TEXT_ANIMATION_PRESET_IDS.map((preset) => (
                  <option value={preset} key={preset}>{preset}</option>
                ))}
              </select>
            </label>
            <label>
              Duración salida
              <input
                type="number"
                min="0"
                max="60000"
                value={exitDuration}
                onChange={(event) =>
                  setExitDuration(Number(event.target.value))
                }
              />
            </label>
          </div>
          <button
            className="clip-inspector__save"
            type="button"
            onClick={() =>
              onUpdateText(clip.id, {
                content,
                style: {
                  fontSizePx: fontSize,
                  fontWeight,
                  color,
                  backgroundColor,
                  backgroundOpacity,
                  alignment,
                },
                entrancePresetId: entrance === "none" ? null : entrance,
                entranceDurationMs: entranceDuration,
                exitPresetId: exit === "none" ? null : exit,
                exitDurationMs: exitDuration,
              })
            }
          >
            Guardar texto y animación
          </button>
        </fieldset>
      ) : null}

      <div className="clip-inspector__actions">
        <button
          type="button"
          disabled={busy || locked || clip.durationUs < 20_000}
          onClick={() => onSplit(clip.id, splitAtMs)}
        >
          Dividir a la mitad
        </button>
        <button
          className="is-danger"
          type="button"
          disabled={busy || locked}
          onClick={() => onDelete(clip.id)}
        >
          Eliminar clip
        </button>
      </div>
    </aside>
  );
}

export {
  ClipInspector,
  seconds,
  type ClipInspectorProps,
  type ClipTimingInput,
  type TextInspectorInput,
};
