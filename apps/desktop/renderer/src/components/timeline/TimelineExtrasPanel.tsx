/* =========================================================
Nombre completo: TimelineExtrasPanel.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/timeline/TimelineExtrasPanel.tsx

Función o funciones:
- Editar transiciones entre clips visuales contiguos.
- Añadir, editar, previsualizar y eliminar efectos de sonido.
- Representar eventos de sonido sobre una pista temporal dedicada.
========================================================= */

import { useEffect, useMemo, useState } from "react";
import {
  SOUND_EFFECT_DEFAULT_DURATION_US,
  SOUND_EFFECT_PRESET_IDS,
  TRANSITION_PRESET_IDS,
  findTransitionBetween,
  getClipEndUs,
  isVisualClip,
  listSoundEffectCues,
  type EntityId,
  type ProjectDocument,
  type SoundEffectCue,
  type SoundEffectPresetId,
  type TransitionAlignment,
  type TransitionPresetId,
} from "../../../../shared/domain";
import type { SoundEffectFormInput } from "../../app/use-timeline-editor";
import { previewSoundEffect } from "../../app/sound-effect-preview";

interface TimelineExtrasPanelProps {
  readonly project: ProjectDocument;
  readonly busy: boolean;
  readonly onSetTransition: (input: {
    readonly fromClipId: EntityId<"clip">;
    readonly toClipId: EntityId<"clip">;
    readonly presetId: TransitionPresetId;
    readonly durationMs: number;
    readonly alignment: TransitionAlignment;
  }) => void;
  readonly onRemoveTransition: (transitionId: EntityId<"transition">) => void;
  readonly onAddSoundEffect: (input: SoundEffectFormInput) => void;
  readonly onUpdateSoundEffect: (
    effectId: EntityId<"effect">,
    input: SoundEffectFormInput,
  ) => void;
  readonly onDeleteSoundEffect: (effectId: EntityId<"effect">) => void;
}

const transitionLabels: Readonly<Record<TransitionPresetId, string>> = Object.freeze({
  crossfade: "Disolución",
  "dip-black": "Fundido a negro",
  "dip-white": "Fundido a blanco",
  "slide-left": "Deslizar a la izquierda",
  "slide-right": "Deslizar a la derecha",
  zoom: "Zoom",
  blur: "Desenfoque",
});

const soundLabels: Readonly<Record<SoundEffectPresetId, string>> = Object.freeze({
  click: "Clic",
  whoosh: "Barrido",
  pop: "Pop",
  impact: "Impacto",
  notification: "Notificación",
  camera: "Cámara",
  applause: "Aplausos",
});

function secondsToMs(value: number): number {
  return Math.max(0, Math.round(value * 1_000));
}

function cueToForm(cue: SoundEffectCue): SoundEffectFormInput {
  return {
    sequenceId: cue.sequenceId,
    presetId: cue.presetId,
    startMs: Math.round(cue.startOffsetUs / 1_000),
    durationMs: Math.round(cue.durationUs / 1_000),
    gainDb: cue.gainDb,
    pan: cue.pan,
    fadeInMs: Math.round(cue.fadeInUs / 1_000),
    fadeOutMs: Math.round(cue.fadeOutUs / 1_000),
  };
}

function TimelineExtrasPanel({
  project,
  busy,
  onSetTransition,
  onRemoveTransition,
  onAddSoundEffect,
  onUpdateSoundEffect,
  onDeleteSoundEffect,
}: TimelineExtrasPanelProps): React.JSX.Element {
  const sequence =
    project.sequences.find(
      (candidate) => candidate.id === project.project.mainSequenceId,
    ) ?? project.sequences[0];
  const archived = project.project.status === "archived";
  const transitionPairs = useMemo(() => {
    if (!sequence) return [];
    return project.tracks
      .filter(
        (track) =>
          track.sequenceId === sequence.id &&
          (track.kind === "video" ||
            track.kind === "overlay" ||
            track.kind === "text"),
      )
      .flatMap((track) => {
        const clips = project.clips
          .filter((clip) => clip.trackId === track.id)
          .filter((clip) => isVisualClip(project, clip.id))
          .slice()
          .sort((left, right) => left.timelineStartUs - right.timelineStartUs);
        return clips.slice(0, -1).flatMap((fromClip, index) => {
          const toClip = clips[index + 1];
          return toClip && getClipEndUs(fromClip) === toClip.timelineStartUs
            ? [{ fromClip, toClip, track }]
            : [];
        });
      });
  }, [project, sequence]);
  const [pairKey, setPairKey] = useState("");
  const selectedPair =
    transitionPairs.find(
      (pair) => `${pair.fromClip.id}|${pair.toClip.id}` === pairKey,
    ) ?? transitionPairs[0];
  const currentTransition = selectedPair
    ? findTransitionBetween(
        project,
        selectedPair.fromClip.id,
        selectedPair.toClip.id,
      )
    : undefined;
  const [transitionPreset, setTransitionPreset] =
    useState<TransitionPresetId>("crossfade");
  const [transitionSeconds, setTransitionSeconds] = useState(0.5);
  const [alignment, setAlignment] =
    useState<TransitionAlignment>("center");

  useEffect(() => {
    if (!selectedPair) return;
    setPairKey(`${selectedPair.fromClip.id}|${selectedPair.toClip.id}`);
    setTransitionPreset(
      (currentTransition?.transitionType as TransitionPresetId | undefined) ??
        "crossfade",
    );
    setTransitionSeconds(
      currentTransition ? currentTransition.durationUs / 1_000_000 : 0.5,
    );
    setAlignment(currentTransition?.alignment ?? "center");
  }, [currentTransition, selectedPair?.fromClip.id, selectedPair?.toClip.id]);

  const cues = useMemo(
    () => (sequence ? listSoundEffectCues(project, sequence.id) : []),
    [project, sequence],
  );
  const [editingCueId, setEditingCueId] =
    useState<EntityId<"effect"> | null>(null);
  const [soundPreset, setSoundPreset] =
    useState<SoundEffectPresetId>("click");
  const [soundStartSeconds, setSoundStartSeconds] = useState(0);
  const [soundDurationSeconds, setSoundDurationSeconds] = useState(
    SOUND_EFFECT_DEFAULT_DURATION_US.click / 1_000_000,
  );
  const [soundGainDb, setSoundGainDb] = useState(0);
  const [soundPan, setSoundPan] = useState(0);
  const [soundFadeInSeconds, setSoundFadeInSeconds] = useState(0);
  const [soundFadeOutSeconds, setSoundFadeOutSeconds] = useState(0);
  const cueEndUs = cues.reduce(
    (maximum, cue) =>
      Math.max(maximum, cue.startOffsetUs + cue.durationUs),
    0,
  );
  const visibleDurationUs = Math.max(
    sequence?.durationUs ?? 0,
    cueEndUs,
    20_000_000,
  );

  const resetSoundForm = (preset: SoundEffectPresetId = "click"): void => {
    setEditingCueId(null);
    setSoundPreset(preset);
    setSoundStartSeconds(0);
    setSoundDurationSeconds(
      SOUND_EFFECT_DEFAULT_DURATION_US[preset] / 1_000_000,
    );
    setSoundGainDb(0);
    setSoundPan(0);
    setSoundFadeInSeconds(0);
    setSoundFadeOutSeconds(0);
  };

  const editCue = (cue: SoundEffectCue): void => {
    const form = cueToForm(cue);
    setEditingCueId(cue.id);
    setSoundPreset(form.presetId);
    setSoundStartSeconds(form.startMs / 1_000);
    setSoundDurationSeconds(form.durationMs / 1_000);
    setSoundGainDb(form.gainDb);
    setSoundPan(form.pan);
    setSoundFadeInSeconds(form.fadeInMs / 1_000);
    setSoundFadeOutSeconds(form.fadeOutMs / 1_000);
  };

  const soundInput = (): SoundEffectFormInput => ({
    sequenceId: sequence?.id ?? project.project.mainSequenceId,
    presetId: soundPreset,
    startMs: secondsToMs(soundStartSeconds),
    durationMs: secondsToMs(soundDurationSeconds),
    gainDb: soundGainDb,
    pan: soundPan,
    fadeInMs: secondsToMs(soundFadeInSeconds),
    fadeOutMs: secondsToMs(soundFadeOutSeconds),
  });

  return (
    <section className="timeline-extras" aria-label="Transiciones y efectos de sonido">
      <div className="timeline-extras__section">
        <div className="timeline-extras__heading">
          <div>
            <span className="section-label">TRANSICIONES</span>
            <strong>Uniones visuales</strong>
          </div>
          <small>{project.transitions.length} guardadas</small>
        </div>
        {transitionPairs.length === 0 ? (
          <p className="timeline-extras__empty">
            Une dos clips visuales sin dejar espacio para habilitar transiciones.
          </p>
        ) : (
          <fieldset disabled={archived || busy}>
            <label>
              Unión
              <select
                value={pairKey}
                onChange={(event) => setPairKey(event.target.value)}
              >
                {transitionPairs.map((pair) => (
                  <option
                    key={`${pair.fromClip.id}|${pair.toClip.id}`}
                    value={`${pair.fromClip.id}|${pair.toClip.id}`}
                  >
                    {pair.fromClip.name} → {pair.toClip.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="timeline-extras__grid">
              <label>
                Tipo
                <select
                  value={transitionPreset}
                  onChange={(event) =>
                    setTransitionPreset(
                      event.target.value as TransitionPresetId,
                    )
                  }
                >
                  {TRANSITION_PRESET_IDS.map((preset) => (
                    <option key={preset} value={preset}>
                      {transitionLabels[preset]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Duración (s)
                <input
                  type="number"
                  min="0.01"
                  step="0.05"
                  value={transitionSeconds}
                  onChange={(event) =>
                    setTransitionSeconds(Number(event.target.value))
                  }
                />
              </label>
              <label>
                Alineación
                <select
                  value={alignment}
                  onChange={(event) =>
                    setAlignment(event.target.value as TransitionAlignment)
                  }
                >
                  <option value="start">Al inicio</option>
                  <option value="center">Centrada</option>
                  <option value="end">Al final</option>
                </select>
              </label>
            </div>
            <div className="timeline-extras__actions">
              <button
                type="button"
                onClick={() =>
                  selectedPair &&
                  onSetTransition({
                    fromClipId: selectedPair.fromClip.id,
                    toClipId: selectedPair.toClip.id,
                    presetId: transitionPreset,
                    durationMs: secondsToMs(transitionSeconds),
                    alignment,
                  })
                }
              >
                {currentTransition ? "Actualizar transición" : "Añadir transición"}
              </button>
              {currentTransition ? (
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => onRemoveTransition(currentTransition.id)}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          </fieldset>
        )}
      </div>

      <div className="timeline-extras__section timeline-extras__section--sound">
        <div className="timeline-extras__heading">
          <div>
            <span className="section-label">EFECTOS DE SONIDO</span>
            <strong>Eventos de secuencia</strong>
          </div>
          <button type="button" onClick={() => resetSoundForm()} disabled={archived || busy}>
            + Nuevo
          </button>
        </div>

        <div className="sound-cue-lane">
          {cues.length === 0 ? (
            <span className="timeline-extras__empty">Sin efectos de sonido</span>
          ) : null}
          {cues.map((cue) => {
            const left = (cue.startOffsetUs / visibleDurationUs) * 100;
            const width = Math.max(
              1.5,
              Math.min(
                100 - left,
                (cue.durationUs / visibleDurationUs) * 100,
              ),
            );
            return (
              <button
                type="button"
                className={`sound-cue ${editingCueId === cue.id ? "sound-cue--selected" : ""}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                key={cue.id}
                onClick={() => editCue(cue)}
                title={`${soundLabels[cue.presetId]} · ${(cue.startOffsetUs / 1_000_000).toFixed(2)} s`}
              >
                {soundLabels[cue.presetId]}
              </button>
            );
          })}
        </div>

        <fieldset disabled={archived || busy || !sequence}>
          <div className="timeline-extras__grid timeline-extras__grid--sound">
            <label>
              Sonido
              <select
                value={soundPreset}
                onChange={(event) => {
                  const preset = event.target.value as SoundEffectPresetId;
                  setSoundPreset(preset);
                  if (!editingCueId) {
                    setSoundDurationSeconds(
                      SOUND_EFFECT_DEFAULT_DURATION_US[preset] / 1_000_000,
                    );
                  }
                }}
              >
                {SOUND_EFFECT_PRESET_IDS.map((preset) => (
                  <option value={preset} key={preset}>
                    {soundLabels[preset]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Inicio (s)
              <input type="number" min="0" step="0.05" value={soundStartSeconds} onChange={(event) => setSoundStartSeconds(Number(event.target.value))} />
            </label>
            <label>
              Duración (s)
              <input type="number" min="0.05" max="30" step="0.05" value={soundDurationSeconds} onChange={(event) => setSoundDurationSeconds(Number(event.target.value))} />
            </label>
            <label>
              Ganancia (dB)
              <input type="number" min="-60" max="12" step="0.5" value={soundGainDb} onChange={(event) => setSoundGainDb(Number(event.target.value))} />
            </label>
            <label>
              Paneo
              <input type="number" min="-1" max="1" step="0.05" value={soundPan} onChange={(event) => setSoundPan(Number(event.target.value))} />
            </label>
            <label>
              Entrada (s)
              <input type="number" min="0" step="0.05" value={soundFadeInSeconds} onChange={(event) => setSoundFadeInSeconds(Number(event.target.value))} />
            </label>
            <label>
              Salida (s)
              <input type="number" min="0" step="0.05" value={soundFadeOutSeconds} onChange={(event) => setSoundFadeOutSeconds(Number(event.target.value))} />
            </label>
          </div>
          <div className="timeline-extras__actions">
            <button
              type="button"
              onClick={() =>
                void previewSoundEffect(
                  soundPreset,
                  soundGainDb,
                  soundPan,
                  soundDurationSeconds,
                )
              }
            >
              Escuchar aproximación
            </button>
            <button
              type="button"
              onClick={() => {
                const input = soundInput();
                if (editingCueId) onUpdateSoundEffect(editingCueId, input);
                else onAddSoundEffect(input);
              }}
            >
              {editingCueId ? "Actualizar sonido" : "Añadir sonido"}
            </button>
            {editingCueId ? (
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  onDeleteSoundEffect(editingCueId);
                  resetSoundForm();
                }}
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

export {
  TimelineExtrasPanel,
  soundLabels,
  transitionLabels,
  type TimelineExtrasPanelProps,
};
