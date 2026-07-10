/* =========================================================
Nombre completo: timeline-editing-contracts.ts
Ruta o ubicación: /apps/desktop/shared/timeline-editing-contracts.ts

Función o funciones:
- Definir operaciones públicas de clips, pistas y textos.
- Compartir entradas tipadas entre renderer, preload y main.
- Mantener microsegundos y persistencia fuera de la interfaz.
========================================================= */

import type {
  EntityId,
  ProjectDocument,
  TextAnimationPresetId,
  TextStyle,
  TextTemplateId,
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

interface TextStylePatch extends Partial<TextStyle> {}

interface UpdateTextClipRequest extends TimelineProjectInput {
  readonly clipId: EntityId<"clip">;
  readonly content: string;
  readonly style?: TextStylePatch;
  readonly entrancePresetId?: TextAnimationPresetId | null;
  readonly entranceDurationMs?: number;
  readonly exitPresetId?: TextAnimationPresetId | null;
  readonly exitDurationMs?: number;
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
}

export {
  type AddMediaClipRequest,
  type AddTextClipRequest,
  type DeleteClipRequest,
  type MoveClipRequest,
  type SplitClipRequest,
  type TextStylePatch,
  type TimelineEditingBridge,
  type TimelineProjectInput,
  type TrimClipRequest,
  type UpdateTextClipRequest,
  type UpdateTrackStateRequest,
};
