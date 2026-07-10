/* =========================================================
Nombre completo: VideoEffectsInspector.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/timeline/VideoEffectsInspector.tsx

Función o funciones:
- Editar posición, escala, rotación, opacidad y anclaje visual.
- Aplicar presets de color, enfoque, desenfoque y viñeta.
- Configurar animaciones de entrada o salida con easing.
========================================================= */

import { useEffect, useMemo, useState } from "react";
import {
  ANIMATION_EASINGS,
  VIDEO_ANIMATION_PRESET_IDS,
  VIDEO_STYLE_PRESET_IDS,
  isVisualClip,
  readClipVisualSettings,
  type AnimationEasing,
  type EntityId,
  type ProjectDocument,
  type VideoAnimationPresetId,
  type VideoStylePresetId,
} from "../../../../shared/domain";
import type { ClipTransformPatch } from "../../../../shared/timeline-editing-contracts";

interface VisualInspectorInput {
  readonly transform: ClipTransformPatch;
  readonly stylePresetId: VideoStylePresetId;
  readonly styleIntensity: number;
  readonly animationPresetId: VideoAnimationPresetId;
  readonly animationDurationMs: number;
  readonly animationEasing: AnimationEasing;
}

interface VideoEffectsInspectorProps {
  readonly project: ProjectDocument;
  readonly clipId: EntityId<"clip">;
  readonly disabled: boolean;
  readonly onSave: (input: VisualInspectorInput) => void;
}

const styleLabels: Readonly<Record<VideoStylePresetId, string>> = Object.freeze({
  none: "Sin efecto",
  cinematic: "Cinemático",
  monochrome: "Blanco y negro",
  warm: "Cálido",
  cool: "Frío",
  vivid: "Vívido",
  "soft-blur": "Desenfoque suave",
  sharpen: "Nitidez",
  vignette: "Viñeta",
});

const animationLabels: Readonly<Record<VideoAnimationPresetId, string>> =
  Object.freeze({
    none: "Sin animación",
    "fade-in": "Aparecer",
    "fade-out": "Desvanecer",
    "zoom-in": "Acercamiento",
    "zoom-out": "Alejamiento",
    "pan-left": "Desplazar a la izquierda",
    "pan-right": "Desplazar a la derecha",
  });

function VideoEffectsInspector({
  project,
  clipId,
  disabled,
  onSave,
}: VideoEffectsInspectorProps): React.JSX.Element | null {
  const available = useMemo(
    () => isVisualClip(project, clipId),
    [clipId, project],
  );
  const settings = useMemo(
    () => (available ? readClipVisualSettings(project, clipId) : null),
    [available, clipId, project],
  );
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [anchorX, setAnchorX] = useState(0.5);
  const [anchorY, setAnchorY] = useState(0.5);
  const [stylePreset, setStylePreset] = useState<VideoStylePresetId>("none");
  const [styleIntensity, setStyleIntensity] = useState(1);
  const [animationPreset, setAnimationPreset] =
    useState<VideoAnimationPresetId>("none");
  const [animationSeconds, setAnimationSeconds] = useState(0.5);
  const [easing, setEasing] = useState<AnimationEasing>("ease-in-out");

  useEffect(() => {
    if (!settings) return;
    setPositionX(settings.transform.positionX);
    setPositionY(settings.transform.positionY);
    setScaleX(settings.transform.scaleX);
    setScaleY(settings.transform.scaleY);
    setRotation(settings.transform.rotationDegrees);
    setOpacity(settings.transform.opacity);
    setAnchorX(settings.transform.anchorX);
    setAnchorY(settings.transform.anchorY);
    setStylePreset(settings.stylePresetId);
    setStyleIntensity(settings.styleIntensity);
    setAnimationPreset(settings.animationPresetId);
    setAnimationSeconds(
      settings.animationDurationUs === 0
        ? 0.5
        : settings.animationDurationUs / 1_000_000,
    );
    setEasing(settings.animationEasing);
  }, [settings]);

  if (!available || !settings) return null;

  return (
    <fieldset className="clip-inspector__section" disabled={disabled}>
      <legend>Imagen, efectos y movimiento</legend>

      <div className="clip-inspector__grid">
        <label>
          Posición X
          <input
            type="number"
            step="1"
            value={positionX}
            onChange={(event) => setPositionX(Number(event.target.value))}
          />
        </label>
        <label>
          Posición Y
          <input
            type="number"
            step="1"
            value={positionY}
            onChange={(event) => setPositionY(Number(event.target.value))}
          />
        </label>
        <label>
          Escala X
          <input
            type="number"
            min="0.001"
            step="0.05"
            value={scaleX}
            onChange={(event) => setScaleX(Number(event.target.value))}
          />
        </label>
        <label>
          Escala Y
          <input
            type="number"
            min="0.001"
            step="0.05"
            value={scaleY}
            onChange={(event) => setScaleY(Number(event.target.value))}
          />
        </label>
        <label>
          Rotación
          <input
            type="number"
            step="1"
            value={rotation}
            onChange={(event) => setRotation(Number(event.target.value))}
          />
        </label>
        <label>
          Opacidad
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
        </label>
        <label>
          Anclaje X
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={anchorX}
            onChange={(event) => setAnchorX(Number(event.target.value))}
          />
        </label>
        <label>
          Anclaje Y
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={anchorY}
            onChange={(event) => setAnchorY(Number(event.target.value))}
          />
        </label>
      </div>

      <label>
        Preset visual
        <select
          value={stylePreset}
          onChange={(event) =>
            setStylePreset(event.target.value as VideoStylePresetId)
          }
        >
          {VIDEO_STYLE_PRESET_IDS.map((preset) => (
            <option value={preset} key={preset}>
              {styleLabels[preset]}
            </option>
          ))}
        </select>
      </label>

      <label className="clip-inspector__range-label">
        Intensidad
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={styleIntensity}
          disabled={disabled || stylePreset === "none"}
          onChange={(event) => setStyleIntensity(Number(event.target.value))}
        />
        <output>{Math.round(styleIntensity * 100)}%</output>
      </label>

      <div className="clip-inspector__grid">
        <label>
          Animación
          <select
            value={animationPreset}
            onChange={(event) =>
              setAnimationPreset(
                event.target.value as VideoAnimationPresetId,
              )
            }
          >
            {VIDEO_ANIMATION_PRESET_IDS.map((preset) => (
              <option value={preset} key={preset}>
                {animationLabels[preset]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Duración (s)
          <input
            type="number"
            min="0"
            step="0.05"
            value={animationSeconds}
            disabled={disabled || animationPreset === "none"}
            onChange={(event) =>
              setAnimationSeconds(Number(event.target.value))
            }
          />
        </label>
        <label>
          Curva
          <select
            value={easing}
            disabled={disabled || animationPreset === "none"}
            onChange={(event) =>
              setEasing(event.target.value as AnimationEasing)
            }
          >
            {ANIMATION_EASINGS.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        className="clip-inspector__save"
        type="button"
        onClick={() =>
          onSave({
            transform: {
              positionX,
              positionY,
              scaleX,
              scaleY,
              rotationDegrees: rotation,
              opacity,
              anchorX,
              anchorY,
            },
            stylePresetId: stylePreset,
            styleIntensity,
            animationPresetId: animationPreset,
            animationDurationMs:
              animationPreset === "none"
                ? 0
                : Math.round(animationSeconds * 1_000),
            animationEasing: easing,
          })
        }
      >
        Guardar imagen y animación
      </button>
    </fieldset>
  );
}

export {
  VideoEffectsInspector,
  animationLabels,
  styleLabels,
  type VideoEffectsInspectorProps,
  type VisualInspectorInput,
};
