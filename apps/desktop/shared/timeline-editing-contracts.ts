/* =========================================================
Nombre completo: timeline-editing-contracts.ts
Ruta o ubicación: /apps/desktop/shared/timeline-editing-contracts.ts

Función o funciones:
- Definir operaciones públicas de clips, pistas, audio, video y transiciones.
- Compartir entradas tipadas entre renderer, preload y main.
- Mantener milisegundos en IPC y microsegundos dentro del dominio.
========================================================= */

import type {
  AnimationEasing,
  EntityId,
  ProjectDocument,
  SoundEffectPresetId,
  TextAnimationPresetId,
  TextStyle,
  TextTemplateId,
  TransitionAlignment,
  TransitionPresetId,
  VideoAnimationPresetId,
  VideoStylePresetId,
} from "./domain/index.js";
import type { IpcResult } from "./ipc-contracts.js";

interface TimelineProjectInput {
  readonly projectId: EntityId<"project">;
}

interface AddMediaClipRequest extends TimelineProjectInput {
  readonly mediaId: EntityId<"media">;
  readonly trackId?: EntityId<"track">;
  readonly timelineStartMs?: number;
  readonly sourceStartMs?: number;
  readonly sourceDurationMs?: number;
  readonly imageDurationMs?: number;
}

interface MoveClipRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
  readonly trackId: EntityId<"track">;
  readonly timelineStartMs: number;
}

interface TrimClipRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
  readonly timelineStartMs: number;
  readonly durationMs: number;
  readonly sourceStartMs?: number;
}

interface SplitClipRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
  readonly splitAtMs: number;
}

interface DeleteClipRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
}

interface UpdateTrackStateRequest extends TimelineProjectInput {
  readonly trackId: EntityId<"track">;
  readonly muted?: boolean;
  readonly hidden?: boolean;
  readonly locked?: boolean;
}

interface AddTextClipRequest extends TimelineProjectInput {
  readonly trackId?: EntityId<"track">;
  readonly templateId: TextTemplateId;
  readonly content: string;
  readonly timelineStartMs?: number;
  readonly durationMs?: number;
}

type TextStylePatch = Partial<TextStyle>;

interface UpdateTextClipRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
  readonly content: string;
  readonly style?: TextStylePatch;
  readonly entrancePresetId?: TextAnimationPresetId | null;
  readonly entranceDurationMs?: number;
  readonly exitPresetId?: TextAnimationPresetId | null;
  readonly exitDurationMs?: number;
}

interface UpdateClipAudioMixRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
  readonly gainDb: number;
  readonly pan: number;
  readonly muted: boolean;
  readonly fadeInMs: number;
  readonly fadeOutMs: number;
  readonly normalize: boolean;
  readonly normalizationTargetDb: number;
}

interface ClipTransformPatch {
  readonly positionX?: number;
  readonly positionY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotationDegrees?: number;
  readonly opacity?: number;
  readonly anchorX?: number;
  readonly anchorY?: number;
}

interface UpdateClipVisualRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
  readonly transform: ClipTransformPatch;
  readonly stylePresetId: VideoStylePresetId;
  readonly styleIntensity: number;
  readonly animationPresetId: VideoAnimationPresetId;
  readonly animationDurationMs: number;
  readonly animationEasing: AnimationEasing;
}

interface SetTransitionRequest extends TimelineProjectInput {
  readonly fromClipId: EntityId<"clip">;
  readonly toClipId: EntityId<"clip">;
  readonly presetId: TransitionPresetId;
  readonly durationMs: number;
  readonly alignment: TransitionAlignment;
}

interface RemoveTransitionRequest extends TimelineProjectInput {
  readonly transitionId: EntityId<"transition">;
}

interface SoundEffectValuesRequest extends TimelineProjectInput {
  readonly sequenceId: EntityId<"sequence">;
  readonly presetId: SoundEffectPresetId;
  readonly startMs: number;
  readonly durationMs: number;
  readonly gainDb: number;
  readonly pan: number;
  readonly fadeInMs: number;
  readonly fadeOutMs: number;
}

interface AddSoundEffectRequest extends SoundEffectValuesRequest {}

interface UpdateSoundEffectRequest extends SoundEffectValuesRequest {
  readonly effectId: EntityId<"effect">;
}

interface DeleteSoundEffectRequest extends TimelineProjectInput {
  readonly effectId: EntityId<"effect">;
}

interface TimelineEditingBridge {
  addMediaClip(input: AddMediaClipRequest): Promise<IpcResult<ProjectDocument>>;
  moveClip(input: MoveClipRequest): Promise<IpcResult<ProjectDocument>>;
  trimClip(input: TrimClipRequest): Promise<IpcResult<ProjectDocument>>;
  splitClip(input: SplitClipRequest): Promise<IpcResult<ProjectDocument>>;
  deleteClip(input: DeleteClipRequest): Promise<IpcResult<ProjectDocument>>;
  updateTrackState(
    input: UpdateTrackStateRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  addTextClip(input: AddTextClipRequest): Promise<IpcResult<ProjectDocument>>;
  updateTextClip(
    input: UpdateTextClipRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  updateClipAudioMix(
    input: UpdateClipAudioMixRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  updateClipVisual(
    input: UpdateClipVisualRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  setTransition(
    input: SetTransitionRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  removeTransition(
    input: RemoveTransitionRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  addSoundEffect(
    input: AddSoundEffectRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  updateSoundEffect(
    input: UpdateSoundEffectRequest,
  ): Promise<IpcResult<ProjectDocument>>;
  deleteSoundEffect(
    input: DeleteSoundEffectRequest,
  ): Promise<IpcResult<ProjectDocument>>;
}

export {
  type AddMediaClipRequest,
  type AddSoundEffectRequest,
  type AddTextClipRequest,
  type ClipTransformPatch,
  type DeleteClipRequest,
  type DeleteSoundEffectRequest,
  type MoveClipRequest,
  type RemoveTransitionRequest,
  type SetTransitionRequest,
  type SoundEffectValuesRequest,
  type SplitClipRequest,
  type TextStylePatch,
  type TimelineEditingBridge,
  type TimelineProjectInput,
  type TrimClipRequest,
  type UpdateClipAudioMixRequest,
  type UpdateClipVisualRequest,
  type UpdateSoundEffectRequest,
  type UpdateTextClipRequest,
  type UpdateTrackStateRequest,
};
