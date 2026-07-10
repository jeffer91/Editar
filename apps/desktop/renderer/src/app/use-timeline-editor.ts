/* =========================================================
Nombre completo: use-timeline-editor.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-timeline-editor.ts

Función o funciones:
- Ejecutar operaciones de clips, pistas, textos, audio y video desde React.
- Mantener selección, operación activa, mensajes y errores.
- Entregar siempre el ProjectDocument persistido por main.
========================================================= */

import { useCallback, useState } from "react";
import type {
  AnimationEasing,
  EntityId,
  ProjectDocument,
  TextAnimationPresetId,
  TextStyle,
  TextTemplateId,
  VideoAnimationPresetId,
  VideoStylePresetId,
} from "../../../shared/domain";
import type { ClipTransformPatch } from "../../../shared/timeline-editing-contracts";

type TimelineOperation =
  | "add-media"
  | "move"
  | "trim"
  | "split"
  | "delete"
  | "track"
  | "add-text"
  | "update-text"
  | "audio-mix"
  | "visual";

interface TimelineEditorState {
  readonly selectedClipId: EntityId<"clip"> | null;
  readonly operation: TimelineOperation | null;
  readonly message: string;
  readonly errorMessage: string;
  readonly selectClip: (clipId: EntityId<"clip"> | null) => void;
  readonly addMedia: (
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
  ) => Promise<ProjectDocument | null>;
  readonly move: (
    projectId: EntityId<"project">,
    clipId: EntityId<"clip">,
    trackId: EntityId<"track">,
    timelineStartMs: number,
  ) => Promise<ProjectDocument | null>;
  readonly trim: (
    projectId: EntityId<"project">,
    clipId: EntityId<"clip">,
    timelineStartMs: number,
    durationMs: number,
    sourceStartMs?: number,
  ) => Promise<ProjectDocument | null>;
  readonly split: (
    projectId: EntityId<"project">,
    clipId: EntityId<"clip">,
    splitAtMs: number,
  ) => Promise<ProjectDocument | null>;
  readonly remove: (
    projectId: EntityId<"project">,
    clipId: EntityId<"clip">,
  ) => Promise<ProjectDocument | null>;
  readonly setTrackState: (
    projectId: EntityId<"project">,
    trackId: EntityId<"track">,
    state: {
      readonly muted?: boolean;
      readonly hidden?: boolean;
      readonly locked?: boolean;
    },
  ) => Promise<ProjectDocument | null>;
  readonly addText: (
    projectId: EntityId<"project">,
    templateId: TextTemplateId,
    content: string,
  ) => Promise<ProjectDocument | null>;
  readonly updateText: (
    projectId: EntityId<"project">,
    clipId: EntityId<"clip">,
    input: {
      readonly content: string;
      readonly style?: Partial<TextStyle>;
      readonly entrancePresetId?: TextAnimationPresetId | null;
      readonly entranceDurationMs?: number;
      readonly exitPresetId?: TextAnimationPresetId | null;
      readonly exitDurationMs?: number;
    },
  ) => Promise<ProjectDocument | null>;
  readonly updateAudioMix: (
    projectId: EntityId<"project">,
    clipId: EntityId<"clip">,
    input: {
      readonly gainDb: number;
      readonly pan: number;
      readonly muted: boolean;
      readonly fadeInMs: number;
      readonly fadeOutMs: number;
      readonly normalize: boolean;
      readonly normalizationTargetDb: number;
    },
  ) => Promise<ProjectDocument | null>;
  readonly updateVisual: (
    projectId: EntityId<"project">,
    clipId: EntityId<"clip">,
    input: {
      readonly transform: ClipTransformPatch;
      readonly stylePresetId: VideoStylePresetId;
      readonly styleIntensity: number;
      readonly animationPresetId: VideoAnimationPresetId;
      readonly animationDurationMs: number;
      readonly animationEasing: AnimationEasing;
    },
  ) => Promise<ProjectDocument | null>;
  readonly clearMessages: () => void;
}

function useTimelineEditor(): TimelineEditorState {
  const [selectedClipId, setSelectedClipId] =
    useState<EntityId<"clip"> | null>(null);
  const [operation, setOperation] = useState<TimelineOperation | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const run = useCallback(
    async (
      activeOperation: TimelineOperation,
      request: () => Promise<
        Awaited<ReturnType<typeof window.editar.timeline.addMediaClip>>
      >,
      successMessage: string,
    ): Promise<ProjectDocument | null> => {
      setOperation(activeOperation);
      setMessage("");
      setErrorMessage("");

      try {
        const result = await request();
        if (!result.ok) throw new Error(result.error.message);
        setMessage(successMessage);
        return result.data;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No fue posible guardar la edición.",
        );
        return null;
      } finally {
        setOperation(null);
      }
    },
    [],
  );

  return {
    selectedClipId,
    operation,
    message,
    errorMessage,
    selectClip: setSelectedClipId,
    addMedia: (projectId, mediaId) =>
      run(
        "add-media",
        () => window.editar.timeline.addMediaClip({ projectId, mediaId }),
        "El medio fue añadido al final de la pista.",
      ),
    move: (projectId, clipId, trackId, timelineStartMs) =>
      run(
        "move",
        () =>
          window.editar.timeline.moveClip({
            projectId,
            clipId,
            trackId,
            timelineStartMs,
          }),
        "El clip fue movido.",
      ),
    trim: (projectId, clipId, timelineStartMs, durationMs, sourceStartMs) =>
      run(
        "trim",
        () =>
          window.editar.timeline.trimClip({
            projectId,
            clipId,
            timelineStartMs,
            durationMs,
            sourceStartMs,
          }),
        "El clip fue recortado.",
      ),
    split: (projectId, clipId, splitAtMs) =>
      run(
        "split",
        () => window.editar.timeline.splitClip({ projectId, clipId, splitAtMs }),
        "El clip fue dividido.",
      ),
    remove: async (projectId, clipId) => {
      const document = await run(
        "delete",
        () => window.editar.timeline.deleteClip({ projectId, clipId }),
        "El clip fue eliminado.",
      );
      if (document) setSelectedClipId(null);
      return document;
    },
    setTrackState: (projectId, trackId, state) =>
      run(
        "track",
        () =>
          window.editar.timeline.updateTrackState({
            projectId,
            trackId,
            ...state,
          }),
        "La pista fue actualizada.",
      ),
    addText: (projectId, templateId, content) =>
      run(
        "add-text",
        () =>
          window.editar.timeline.addTextClip({
            projectId,
            templateId,
            content,
          }),
        "El texto animado fue añadido.",
      ),
    updateText: (projectId, clipId, input) =>
      run(
        "update-text",
        () =>
          window.editar.timeline.updateTextClip({
            projectId,
            clipId,
            ...input,
          }),
        "El texto fue actualizado.",
      ),
    updateAudioMix: (projectId, clipId, input) =>
      run(
        "audio-mix",
        () =>
          window.editar.timeline.updateClipAudioMix({
            projectId,
            clipId,
            ...input,
          }),
        "La mezcla de audio fue actualizada.",
      ),
    updateVisual: (projectId, clipId, input) =>
      run(
        "visual",
        () =>
          window.editar.timeline.updateClipVisual({
            projectId,
            clipId,
            ...input,
          }),
        "Los efectos visuales fueron actualizados.",
      ),
    clearMessages: () => {
      setMessage("");
      setErrorMessage("");
    },
  };
}

export {
  useTimelineEditor,
  type TimelineEditorState,
  type TimelineOperation,
};
