/* =========================================================
Nombre completo: project-document.ts
Ruta o ubicación: /apps/desktop/shared/domain/project-document.ts

Función o funciones:
- Agrupar todos los modelos que forman un proyecto completo.
- Validar referencias entre secuencias, pistas, clips y recursos.
- Crear un proyecto vacío coherente y listo para persistirse.
========================================================= */

import { assertDomain, type DomainErrorCode } from "./domain-error.js";
import type { EffectInstance, TransitionInstance } from "./effects.js";
import type { JobRecord } from "./jobs.js";
import type { MediaAsset } from "./media.js";
import {
  createEntityId,
  toMicroseconds,
  type EntityId,
} from "./primitives.js";
import { createProject, type Project } from "./project.js";
import type { TextLayer } from "./text.js";
import {
  createSequence,
  createTrack,
  isTrackCompatibleWithClip,
  type Clip,
  type Sequence,
  type Track,
} from "./timeline.js";

interface ProjectDocument {
  readonly project: Project;
  readonly sequences: readonly Sequence[];
  readonly tracks: readonly Track[];
  readonly clips: readonly Clip[];
  readonly media: readonly MediaAsset[];
  readonly textLayers: readonly TextLayer[];
  readonly effects: readonly EffectInstance[];
  readonly transitions: readonly TransitionInstance[];
  readonly jobs: readonly JobRecord[];
}

interface DomainIssue {
  readonly code: DomainErrorCode;
  readonly field: string;
  readonly message: string;
}

interface CreateEmptyProjectDocumentInput {
  readonly name: string;
  readonly now?: Date | string;
}

function addIssue(
  issues: DomainIssue[],
  code: DomainErrorCode,
  field: string,
  message: string,
): void {
  issues.push(Object.freeze({ code, field, message }));
}

function collectDuplicateIssues<T extends { readonly id: string }>(
  values: readonly T[],
  field: string,
  issues: DomainIssue[],
): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value.id)) {
      addIssue(
        issues,
        "DUPLICATE_VALUE",
        field,
        `El identificador ${value.id} está duplicado.`,
      );
    }

    seen.add(value.id);
  }
}

function collectJobCycleIssues(
  jobs: readonly JobRecord[],
  issues: DomainIssue[],
): void {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (jobId: string): boolean => {
    if (visiting.has(jobId)) {
      return true;
    }

    if (visited.has(jobId)) {
      return false;
    }

    const job = jobsById.get(jobId as EntityId<"job">);

    if (!job) {
      return false;
    }

    visiting.add(jobId);

    for (const dependencyId of job.dependencyIds) {
      if (visit(dependencyId)) {
        return true;
      }
    }

    visiting.delete(jobId);
    visited.add(jobId);
    return false;
  };

  for (const job of jobs) {
    if (visit(job.id)) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `jobs.${job.id}.dependencyIds`,
        "Las dependencias de trabajos contienen un ciclo.",
      );
      return;
    }
  }
}

function collectProjectDocumentIssues(
  document: ProjectDocument,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];

  collectDuplicateIssues(document.sequences, "sequences", issues);
  collectDuplicateIssues(document.tracks, "tracks", issues);
  collectDuplicateIssues(document.clips, "clips", issues);
  collectDuplicateIssues(document.media, "media", issues);
  collectDuplicateIssues(document.textLayers, "textLayers", issues);
  collectDuplicateIssues(document.effects, "effects", issues);
  collectDuplicateIssues(document.transitions, "transitions", issues);
  collectDuplicateIssues(document.jobs, "jobs", issues);

  const sequenceById = new Map(
    document.sequences.map((sequence) => [sequence.id, sequence]),
  );
  const trackById = new Map(document.tracks.map((track) => [track.id, track]));
  const clipById = new Map(document.clips.map((clip) => [clip.id, clip]));
  const mediaById = new Map(document.media.map((media) => [media.id, media]));
  const textById = new Map(
    document.textLayers.map((textLayer) => [textLayer.id, textLayer]),
  );
  const effectById = new Map(
    document.effects.map((effect) => [effect.id, effect]),
  );
  const jobById = new Map(document.jobs.map((job) => [job.id, job]));

  if (!sequenceById.has(document.project.mainSequenceId)) {
    addIssue(
      issues,
      "INVALID_RELATION",
      "project.mainSequenceId",
      "La secuencia principal del proyecto no existe.",
    );
  }

  for (const sequence of document.sequences) {
    if (sequence.projectId !== document.project.id) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `sequences.${sequence.id}.projectId`,
        "La secuencia pertenece a otro proyecto.",
      );
    }

    for (const trackId of sequence.trackIds) {
      const track = trackById.get(trackId);

      if (!track) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `sequences.${sequence.id}.trackIds`,
          `La pista ${trackId} no existe.`,
        );
      } else if (track.sequenceId !== sequence.id) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `tracks.${track.id}.sequenceId`,
          "La pista no pertenece a la secuencia que la contiene.",
        );
      }
    }
  }

  for (const track of document.tracks) {
    const sequence = sequenceById.get(track.sequenceId);

    if (!sequence) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `tracks.${track.id}.sequenceId`,
        "La secuencia de la pista no existe.",
      );
    } else if (!sequence.trackIds.includes(track.id)) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `sequences.${sequence.id}.trackIds`,
        "La secuencia no registra una pista que apunta hacia ella.",
      );
    }

    for (const clipId of track.clipIds) {
      const clip = clipById.get(clipId);

      if (!clip) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `tracks.${track.id}.clipIds`,
          `El clip ${clipId} no existe.`,
        );
      } else if (clip.trackId !== track.id) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `clips.${clip.id}.trackId`,
          "El clip no pertenece a la pista que lo contiene.",
        );
      }
    }
  }

  for (const clip of document.clips) {
    const track = trackById.get(clip.trackId);

    if (!track) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `clips.${clip.id}.trackId`,
        "La pista del clip no existe.",
      );
    } else {
      if (!track.clipIds.includes(clip.id)) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `tracks.${track.id}.clipIds`,
          "La pista no registra un clip que apunta hacia ella.",
        );
      }

      if (!isTrackCompatibleWithClip(track, clip)) {
        addIssue(
          issues,
          "UNSUPPORTED_VALUE",
          `clips.${clip.id}.kind`,
          `Un clip ${clip.kind} no es compatible con una pista ${track.kind}.`,
        );
      }
    }

    if (clip.source.type === "media") {
      const media = mediaById.get(clip.source.mediaId);

      if (!media) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `clips.${clip.id}.source.mediaId`,
          "El recurso multimedia del clip no existe.",
        );
      } else if (media.projectId !== document.project.id) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `media.${media.id}.projectId`,
          "El recurso multimedia pertenece a otro proyecto.",
        );
      }
    }

    if (clip.source.type === "text" && !textById.has(clip.source.textLayerId)) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `clips.${clip.id}.source.textLayerId`,
        "La capa de texto del clip no existe.",
      );
    }

    for (const effectId of clip.effectIds) {
      const effect = effectById.get(effectId);

      if (!effect) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `clips.${clip.id}.effectIds`,
          `El efecto ${effectId} no existe.`,
        );
      } else if (effect.ownerType !== "clip" || effect.ownerId !== clip.id) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `effects.${effect.id}.ownerId`,
          "El efecto no pertenece al clip que lo contiene.",
        );
      }
    }
  }

  for (const media of document.media) {
    if (media.projectId !== document.project.id) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `media.${media.id}.projectId`,
        "El recurso multimedia pertenece a otro proyecto.",
      );
    }
  }

  for (const textLayer of document.textLayers) {
    if (textLayer.projectId !== document.project.id) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `textLayers.${textLayer.id}.projectId`,
        "La capa de texto pertenece a otro proyecto.",
      );
    }
  }

  for (const effect of document.effects) {
    const ownerExists =
      effect.ownerType === "clip"
        ? clipById.has(effect.ownerId as EntityId<"clip">)
        : effect.ownerType === "track"
          ? trackById.has(effect.ownerId as EntityId<"track">)
          : sequenceById.has(effect.ownerId as EntityId<"sequence">);

    if (!ownerExists) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `effects.${effect.id}.ownerId`,
        "El propietario del efecto no existe.",
      );
    }
  }

  for (const transition of document.transitions) {
    const fromClip = clipById.get(transition.fromClipId);
    const toClip = clipById.get(transition.toClipId);

    if (!fromClip || !toClip) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `transitions.${transition.id}`,
        "Uno o ambos clips de la transición no existen.",
      );
      continue;
    }

    if (fromClip.trackId !== toClip.trackId) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `transitions.${transition.id}`,
        "Los clips de una transición deben pertenecer a la misma pista.",
      );
    }

    if (
      transition.durationUs > fromClip.durationUs ||
      transition.durationUs > toClip.durationUs
    ) {
      addIssue(
        issues,
        "OUT_OF_RANGE",
        `transitions.${transition.id}.durationUs`,
        "La transición no puede durar más que los clips conectados.",
      );
    }
  }

  for (const job of document.jobs) {
    if (job.projectId !== document.project.id) {
      addIssue(
        issues,
        "INVALID_RELATION",
        `jobs.${job.id}.projectId`,
        "El trabajo pertenece a otro proyecto.",
      );
    }

    for (const dependencyId of job.dependencyIds) {
      if (!jobById.has(dependencyId)) {
        addIssue(
          issues,
          "INVALID_RELATION",
          `jobs.${job.id}.dependencyIds`,
          `El trabajo dependiente ${dependencyId} no existe.`,
        );
      }
    }
  }

  collectJobCycleIssues(document.jobs, issues);

  return Object.freeze(issues);
}

function validateProjectDocument(
  document: ProjectDocument,
): ProjectDocument {
  const issues = collectProjectDocumentIssues(document);

  assertDomain(
    issues.length === 0,
    "INVALID_RELATION",
    "projectDocument",
    issues[0]?.message ?? "El documento del proyecto no es válido.",
    { issues },
  );

  return document;
}

function createEmptyProjectDocument(
  input: CreateEmptyProjectDocumentInput,
): ProjectDocument {
  const projectId = createEntityId("project");
  const sequenceId = createEntityId("sequence");
  const trackIds = {
    video: createEntityId("track"),
    overlay: createEntityId("track"),
    text: createEntityId("track"),
    audio: createEntityId("track"),
  } as const;

  const project = createProject({
    id: projectId,
    mainSequenceId: sequenceId,
    name: input.name,
    now: input.now,
  });
  const tracks = Object.freeze([
    createTrack({
      id: trackIds.video,
      sequenceId,
      kind: "video",
      name: "Video principal",
      order: 0,
    }),
    createTrack({
      id: trackIds.overlay,
      sequenceId,
      kind: "overlay",
      name: "Superposiciones",
      order: 1,
    }),
    createTrack({
      id: trackIds.text,
      sequenceId,
      kind: "text",
      name: "Textos",
      order: 2,
    }),
    createTrack({
      id: trackIds.audio,
      sequenceId,
      kind: "audio",
      name: "Audio principal",
      order: 3,
    }),
  ]);
  const sequence = createSequence({
    id: sequenceId,
    projectId,
    name: "Secuencia principal",
    trackIds: tracks.map((track) => track.id),
    durationUs: toMicroseconds(0),
  });

  return validateProjectDocument(
    Object.freeze({
      project,
      sequences: Object.freeze([sequence]),
      tracks,
      clips: Object.freeze([]),
      media: Object.freeze([]),
      textLayers: Object.freeze([]),
      effects: Object.freeze([]),
      transitions: Object.freeze([]),
      jobs: Object.freeze([]),
    }),
  );
}

export {
  collectProjectDocumentIssues,
  createEmptyProjectDocument,
  validateProjectDocument,
  type CreateEmptyProjectDocumentInput,
  type DomainIssue,
  type ProjectDocument,
};
