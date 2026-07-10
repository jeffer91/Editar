/* =========================================================
Nombre completo: AudioMixInspector.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/timeline/AudioMixInspector.tsx

Función o funciones:
- Editar ganancia, paneo, mute y fundidos del clip seleccionado.
- Configurar normalización opcional con objetivo en decibelios.
- Mostrar siempre los valores persistidos en el proyecto.
========================================================= */

import { useEffect, useMemo, useState } from "react";
import {
  clipHasAudio,
  readClipAudioMix,
  type EntityId,
  type ProjectDocument,
} from "../../../../shared/domain";

interface AudioMixInput {
  readonly gainDb: number;
  readonly pan: number;
  readonly muted: boolean;
  readonly fadeInMs: number;
  readonly fadeOutMs: number;
  readonly normalize: boolean;
  readonly normalizationTargetDb: number;
}

interface AudioMixInspectorProps {
  readonly project: ProjectDocument;
  readonly clipId: EntityId<"clip">;
  readonly disabled: boolean;
  readonly onSave: (input: AudioMixInput) => void;
}

function AudioMixInspector({
  project,
  clipId,
  disabled,
  onSave,
}: AudioMixInspectorProps): React.JSX.Element | null {
  const available = useMemo(
    () => clipHasAudio(project, clipId),
    [clipId, project],
  );
  const settings = useMemo(
    () => (available ? readClipAudioMix(project, clipId) : null),
    [available, clipId, project],
  );
  const [gainDb, setGainDb] = useState(0);
  const [pan, setPan] = useState(0);
  const [muted, setMuted] = useState(false);
  const [fadeInSeconds, setFadeInSeconds] = useState(0);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0);
  const [normalize, setNormalize] = useState(false);
  const [targetDb, setTargetDb] = useState(-1);

  useEffect(() => {
    if (!settings) return;
    setGainDb(settings.gainDb);
    setPan(settings.pan);
    setMuted(settings.muted);
    setFadeInSeconds(settings.fadeInUs / 1_000_000);
    setFadeOutSeconds(settings.fadeOutUs / 1_000_000);
    setNormalize(settings.normalize);
    setTargetDb(settings.normalizationTargetDb);
  }, [settings]);

  if (!available || !settings) return null;

  return (
    <fieldset className="clip-inspector__section" disabled={disabled}>
      <legend>Mezcla de audio</legend>
      <div className="clip-inspector__range-row">
        <label>
          Ganancia
          <input
            type="range"
            min="-60"
            max="12"
            step="0.5"
            value={gainDb}
            onChange={(event) => setGainDb(Number(event.target.value))}
          />
          <output>{gainDb.toFixed(1)} dB</output>
        </label>
        <label>
          Paneo
          <input
            type="range"
            min="-1"
            max="1"
            step="0.05"
            value={pan}
            onChange={(event) => setPan(Number(event.target.value))}
          />
          <output>
            {pan === 0 ? "Centro" : pan < 0 ? `Izq. ${Math.abs(pan).toFixed(2)}` : `Der. ${pan.toFixed(2)}`}
          </output>
        </label>
      </div>

      <div className="clip-inspector__grid">
        <label>
          Entrada suave (s)
          <input
            type="number"
            min="0"
            step="0.05"
            value={fadeInSeconds}
            onChange={(event) => setFadeInSeconds(Number(event.target.value))}
          />
        </label>
        <label>
          Salida suave (s)
          <input
            type="number"
            min="0"
            step="0.05"
            value={fadeOutSeconds}
            onChange={(event) => setFadeOutSeconds(Number(event.target.value))}
          />
        </label>
      </div>

      <label className="clip-inspector__check">
        <input
          type="checkbox"
          checked={muted}
          onChange={(event) => setMuted(event.target.checked)}
        />
        Silenciar únicamente este clip
      </label>

      <label className="clip-inspector__check">
        <input
          type="checkbox"
          checked={normalize}
          onChange={(event) => setNormalize(event.target.checked)}
        />
        Normalizar al exportar
      </label>

      {normalize ? (
        <label>
          Pico objetivo (dB)
          <input
            type="number"
            min="-24"
            max="0"
            step="0.5"
            value={targetDb}
            onChange={(event) => setTargetDb(Number(event.target.value))}
          />
        </label>
      ) : null}

      <button
        className="clip-inspector__save"
        type="button"
        onClick={() =>
          onSave({
            gainDb,
            pan,
            muted,
            fadeInMs: Math.round(fadeInSeconds * 1_000),
            fadeOutMs: Math.round(fadeOutSeconds * 1_000),
            normalize,
            normalizationTargetDb: targetDb,
          })
        }
      >
        Guardar mezcla de audio
      </button>
    </fieldset>
  );
}

export {
  AudioMixInspector,
  type AudioMixInput,
  type AudioMixInspectorProps,
};
