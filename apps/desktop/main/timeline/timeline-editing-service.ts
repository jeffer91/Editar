/* =========================================================
Nombre completo: timeline-editing-service.ts
Ruta o ubicación: /apps/desktop/main/timeline/timeline-editing-service.ts

Función o funciones:
- Coordinar operaciones de clips, audio, video, transiciones y sonidos.
- Seleccionar pistas y posiciones predeterminadas.
- Persistir cada edición con snapshot recuperable.
========================================================= */

import {
  addMediaClip,
  addSoundEffectCue,
  addTextClip,
  appendPositionForTrack,
  millisecondsToMicroseconds,
  moveClip,
  pruneInvalidTransitions,
  removeClip,
  removeSoundEffectCue,
  removeTransition,
  requireTextLayerForClip,
  setTransition,
  splitClip,
  trimClip,
  updateClipAudioMix,
  updateClipVisualProperties,
  updateSoundEffectCue,
  updateTextLayerForClip,
  updateTrackState,
  type EntityId,
  type ProjectDocument,
  type TextAnimationReference,
  type Track,
} from "../../shared/domain/index.js";
import type {
  AddMediaClipRequest,
  AddSoundEffectRequest,
  AddTextClipRequest,
  DeleteClipRequest,
  DeleteSoundEffectRequest,
  MoveClipRequest,
  RemoveTransitionRequest,
  SetTransitionRequest,
  SplitClipRequest,
  TrimClipRequest,
  UpdateClipAudioMixRequest,
  UpdateClipVisualRequest,
  UpdateSoundEffectRequest,
  UpdateTextClipRequest,
  UpdateTrackStateRequest,
} from "../../shared/timeline-editing-contracts.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";

class TimelineEditingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimelineEditingConflictError";
  }
}

class TimelineEditingService {
  constructor(private readonly repository: ProjectRepository) {}

  async addMediaClip(input: AddMediaClipRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const media = document.media.find((candidate) => candidate.id === input.mediaId);
    if (!media) {
      throw new TimelineEditingConflictError(
        "El recurso seleccionado no pertenece al proyecto.",
      );
    }

    const track = input.trackId
      ? this.requireTrack(document, input.trackId)
      : this.defaultMediaTrack(document, media.kind);
    const timelineStartUs =
      input.timelineStartMs === undefined
        ? appendPositionForTrack(document, track.id)
        : millisecondsToMicroseconds(input.timelineStartMs, "timelineStartMs");
    const updated = addMediaClip(document, {
      mediaId: media.id,
      trackId: track.id,
      timelineStartUs,
      sourceStartUs:
        input.sourceStartMs === undefined
          ? undefined
          : millisecondsToMicroseconds(input.sourceStartMs, "sourceStartMs"),
      sourceDurationUs:
        input.sourceDurationMs === undefined
          ? undefined
          : millisecondsToMicroseconds(
              input.sourceDurationMs,
              "sourceDurationMs",
            ),
      imageDurationUs:
        input.imageDurationMs === undefined
          ? undefined
          : millisecondsToMicroseconds(
              input.imageDurationMs,
              "imageDurationMs",
            ),
    });

    return this.save(updated, `clip añadido: ${media.fileName}`);
  }

  async moveClip(input: MoveClipRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const moved = moveClip(document, {
      clipId: input.clipId,
      trackId: input.trackId,
      timelineStartUs: millisecondsToMicroseconds(
        input.timelineStartMs,
        "timelineStartMs",
      ),
    });
    return this.save(pruneInvalidTransitions(moved), "clip movido");
  }

  async trimClip(input: TrimClipRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const trimmed = trimClip(document, {
      clipId: input.clipId,
      timelineStartUs: millisecondsToMicroseconds(
        input.timelineStartMs,
        "timelineStartMs",
      ),
      durationUs: millisecondsToMicroseconds(input.durationMs, "durationMs"),
      sourceStartUs:
        input.sourceStartMs === undefined
          ? undefined
          : millisecondsToMicroseconds(input.sourceStartMs, "sourceStartMs"),
    });
    return this.save(pruneInvalidTransitions(trimmed), "clip recortado");
  }

  async splitClip(input: SplitClipRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const split = splitClip(document, {
      clipId: input.clipId,
      splitAtUs: millisecondsToMicroseconds(input.splitAtMs, "splitAtMs"),
    });
    return this.save(pruneInvalidTransitions(split), "clip dividido");
  }

  async deleteClip(input: DeleteClipRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    return this.save(removeClip(document, input.clipId), "clip eliminado");
  }

  async updateTrackState(
    input: UpdateTrackStateRequest,
  ): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const updated = updateTrackState(document, {
      trackId: input.trackId,
      muted: input.muted,
      hidden: input.hidden,
      locked: input.locked,
    });
    return this.save(updated, "estado de pista actualizado");
  }

  async addTextClip(input: AddTextClipRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const track = input.trackId
      ? this.requireTrack(document, input.trackId)
      : this.defaultTextTrack(document);
    const timelineStartUs =
      input.timelineStartMs === undefined
        ? appendPositionForTrack(document, track.id)
        : millisecondsToMicroseconds(input.timelineStartMs, "timelineStartMs");
    const updated = addTextClip(document, {
      trackId: track.id,
      templateId: input.templateId,
      content: input.content,
      timelineStartUs,
      durationUs: millisecondsToMicroseconds(
        input.durationMs ?? 4_000,
        "durationMs",
      ),
    });
    return this.save(updated, `texto añadido: ${input.templateId}`);
  }

  async updateTextClip(input: UpdateTextClipRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const current = requireTextLayerForClip(document, input.clipId);
    const entranceAnimation = this.animationPatch(
      input.entrancePresetId,
      input.entranceDurationMs,
      current.layer.entranceAnimation,
    );
    const exitAnimation = this.animationPatch(
      input.exitPresetId,
      input.exitDurationMs,
      current.layer.exitAnimation,
    );
    const updated = updateTextLayerForClip(document, {
      clipId: input.clipId,
      content: input.content,
      style: input.style,
      entranceAnimation,
      exitAnimation,
    });
    return this.save(updated, "texto actualizado");
  }

  async updateClipAudioMix(
    input: UpdateClipAudioMixRequest,
  ): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const updated = updateClipAudioMix(document, {
      clipId: input.clipId,
      gainDb: input.gainDb,
      pan: input.pan,
      muted: input.muted,
      fadeInUs: millisecondsToMicroseconds(input.fadeInMs, "fadeInMs"),
      fadeOutUs: millisecondsToMicroseconds(input.fadeOutMs, "fadeOutMs"),
      normalize: input.normalize,
      normalizationTargetDb: input.normalizationTargetDb,
    });
    return this.save(updated, "mezcla de audio actualizada");
  }

  async updateClipVisual(
    input: UpdateClipVisualRequest,
  ): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const updated = updateClipVisualProperties(document, {
      clipId: input.clipId,
      transform: input.transform,
      stylePresetId: input.stylePresetId,
      styleIntensity: input.styleIntensity,
      animationPresetId: input.animationPresetId,
      animationDurationUs: millisecondsToMicroseconds(
        input.animationDurationMs,
        "animationDurationMs",
      ),
      animationEasing: input.animationEasing,
    });
    return this.save(updated, "efectos visuales actualizados");
  }

  async setTransition(input: SetTransitionRequest): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const updated = setTransition(document, {
      fromClipId: input.fromClipId,
      toClipId: input.toClipId,
      presetId: input.presetId,
      durationUs: millisecondsToMicroseconds(input.durationMs, "durationMs"),
      alignment: input.alignment,
    });
    return this.save(updated, "transición actualizada");
  }

  async removeTransition(
    input: RemoveTransitionRequest,
  ): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    return this.save(
      removeTransition(document, input.transitionId),
      "transición eliminada",
    );
  }

  async addSoundEffect(
    input: AddSoundEffectRequest,
  ): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const updated = addSoundEffectCue(document, {
      sequenceId: input.sequenceId,
      presetId: input.presetId,
      startOffsetUs: millisecondsToMicroseconds(input.startMs, "startMs"),
      durationUs: millisecondsToMicroseconds(input.durationMs, "durationMs"),
      gainDb: input.gainDb,
      pan: input.pan,
      fadeInUs: millisecondsToMicroseconds(input.fadeInMs, "fadeInMs"),
      fadeOutUs: millisecondsToMicroseconds(input.fadeOutMs, "fadeOutMs"),
    });
    return this.save(updated, `efecto de sonido añadido: ${input.presetId}`);
  }

  async updateSoundEffect(
    input: UpdateSoundEffectRequest,
  ): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    const updated = updateSoundEffectCue(document, {
      effectId: input.effectId,
      sequenceId: input.sequenceId,
      presetId: input.presetId,
      startOffsetUs: millisecondsToMicroseconds(input.startMs, "startMs"),
      durationUs: millisecondsToMicroseconds(input.durationMs, "durationMs"),
      gainDb: input.gainDb,
      pan: input.pan,
      fadeInUs: millisecondsToMicroseconds(input.fadeInMs, "fadeInMs"),
      fadeOutUs: millisecondsToMicroseconds(input.fadeOutMs, "fadeOutMs"),
    });
    return this.save(updated, "efecto de sonido actualizado");
  }

  async deleteSoundEffect(
    input: DeleteSoundEffectRequest,
  ): Promise<ProjectDocument> {
    const document = await this.requireDocument(input.projectId);
    return this.save(
      removeSoundEffectCue(document, input.effectId),
      "efecto de sonido eliminado",
    );
  }

  private animationPatch(
    presetId: UpdateTextClipRequest["entrancePresetId"],
    durationMs: number | undefined,
    current: TextAnimationReference | undefined,
  ): TextAnimationReference | null | undefined {
    if (presetId === undefined && durationMs === undefined) return undefined;
    if (presetId === null) return null;
    const resolvedPreset = presetId ?? current?.presetId;
    if (!resolvedPreset) return undefined;
    return Object.freeze({
      presetId: resolvedPreset,
      durationMs: Math.round(durationMs ?? current?.durationMs ?? 350),
    });
  }

  private defaultMediaTrack(
    document: ProjectDocument,
    kind: "video" | "audio" | "image",
  ): Track {
    const targetKind = kind === "audio" ? "audio" : "video";
    const track = document.tracks.find(
      (candidate) =>
        candidate.sequenceId === document.project.mainSequenceId &&
        candidate.kind === targetKind,
    );
    if (!track) {
      throw new TimelineEditingConflictError(
        `El proyecto no tiene una pista ${targetKind} disponible.`,
      );
    }
    return track;
  }

  private defaultTextTrack(document: ProjectDocument): Track {
    const track = document.tracks.find(
      (candidate) =>
        candidate.sequenceId === document.project.mainSequenceId &&
        candidate.kind === "text",
    );
    if (!track) {
      throw new TimelineEditingConflictError(
        "El proyecto no tiene una pista de texto disponible.",
      );
    }
    return track;
  }

  private requireTrack(
    document: ProjectDocument,
    trackId: EntityId<"track">,
  ): Track {
    const track = document.tracks.find((candidate) => candidate.id === trackId);
    if (!track) {
      throw new TimelineEditingConflictError("La pista seleccionada no existe.");
    }
    return track;
  }

  private async requireDocument(
    projectId: EntityId<"project">,
  ): Promise<ProjectDocument> {
    const document = await this.repository.findById(projectId);
    if (!document) throw new ProjectNotFoundError(projectId);
    return document;
  }

  private async save(
    document: ProjectDocument,
    snapshotReason: string,
  ): Promise<ProjectDocument> {
    await this.repository.save(document, {
      snapshotReason,
      keepSnapshots: 50,
    });
    return document;
  }
}

export { TimelineEditingConflictError, TimelineEditingService };
