/* =========================================================
Nombre completo: project-operations.ts
Ruta o ubicación: /apps/desktop/shared/domain/project-operations.ts

Función o funciones:
- Actualizar nombre y estado de un proyecto completo.
- Duplicar documentos remapeando todos sus identificadores.
- Evitar copiar trabajos transitorios al nuevo proyecto.
========================================================= */

import type { EffectInstance, TransitionInstance } from "./effects.js";
import type { MediaAsset, MediaDerivative } from "./media.js";
import {
  createEntityId,
  normalizeName,
  toIsoDateTime,
  type EntityId,
} from "./primitives.js";
import type { ProjectDocument } from "./project-document.js";
import type { ProjectStatus } from "./project.js";
import type { TextLayer } from "./text.js";
import type { Clip, ClipSource, Sequence, Track } from "./timeline.js";
import { validateProjectDocument } from "./project-document.js";

interface UpdateProjectDocumentInput {
  readonly name?: string;
  readonly status?: ProjectStatus;
  readonly now?: Date | string;
}

interface DuplicateProjectDocumentInput {
  readonly name: string;
  readonly now?: Date | string;
}

function requireMappedId<TEntity extends string>(
  map: ReadonlyMap<string, EntityId<TEntity>>,
  sourceId: string,
  entity: string,
): EntityId<TEntity> {
  const mapped = map.get(sourceId);

  if (!mapped) {
    throw new Error(`No fue posible remapear ${entity}: ${sourceId}.`);
  }

  return mapped;
}

function updateProjectDocument(
  document: ProjectDocument,
  input: UpdateProjectDocumentInput,
): ProjectDocument {
  const updatedAt = toIsoDateTime(input.now ?? new Date(), "updatedAt");
  const updatedDocument: ProjectDocument = Object.freeze({
    ...document,
    project: Object.freeze({
      ...document.project,
      name:
        input.name === undefined
          ? document.project.name
          : normalizeName(input.name, "name", 120),
      status: input.status ?? document.project.status,
      updatedAt,
    }),
  });

  return validateProjectDocument(updatedDocument);
}

function duplicateProjectDocument(
  source: ProjectDocument,
  input: DuplicateProjectDocumentInput,
): ProjectDocument {
  validateProjectDocument(source);

  const timestamp = toIsoDateTime(input.now ?? new Date(), "now");
  const projectId = createEntityId("project");
  const sequenceIds = new Map(
    source.sequences.map((item) => [item.id, createEntityId("sequence")]),
  );
  const trackIds = new Map(
    source.tracks.map((item) => [item.id, createEntityId("track")]),
  );
  const mediaIds = new Map(
    source.media.map((item) => [item.id, createEntityId("media")]),
  );
  const textLayerIds = new Map(
    source.textLayers.map((item) => [item.id, createEntityId("text-layer")]),
  );
  const clipIds = new Map(
    source.clips.map((item) => [item.id, createEntityId("clip")]),
  );
  const effectIds = new Map(
    source.effects.map((item) => [item.id, createEntityId("effect")]),
  );

  const sequences: readonly Sequence[] = Object.freeze(
    source.sequences.map((sequence) =>
      Object.freeze({
        ...sequence,
        id: requireMappedId(sequenceIds, sequence.id, "la secuencia"),
        projectId,
        trackIds: Object.freeze(
          sequence.trackIds.map((trackId) =>
            requireMappedId(trackIds, trackId, "la pista"),
          ),
        ),
      }),
    ),
  );

  const tracks: readonly Track[] = Object.freeze(
    source.tracks.map((track) =>
      Object.freeze({
        ...track,
        id: requireMappedId(trackIds, track.id, "la pista"),
        sequenceId: requireMappedId(
          sequenceIds,
          track.sequenceId,
          "la secuencia de la pista",
        ),
        clipIds: Object.freeze(
          track.clipIds.map((clipId) =>
            requireMappedId(clipIds, clipId, "el clip"),
          ),
        ),
      }),
    ),
  );

  const media: readonly MediaAsset[] = Object.freeze(
    source.media.map((asset) => {
      const derivatives: readonly MediaDerivative[] = Object.freeze(
        asset.derivatives.map((derivative) =>
          Object.freeze({
            ...derivative,
            id: createEntityId("derivative"),
            createdAt: timestamp,
          }),
        ),
      );

      return Object.freeze({
        ...asset,
        id: requireMappedId(mediaIds, asset.id, "el recurso multimedia"),
        projectId,
        derivatives,
        importedAt: timestamp,
      });
    }),
  );

  const textLayers: readonly TextLayer[] = Object.freeze(
    source.textLayers.map((layer) =>
      Object.freeze({
        ...layer,
        id: requireMappedId(textLayerIds, layer.id, "la capa de texto"),
        projectId,
      }),
    ),
  );

  const mapClipSource = (clip: Clip): ClipSource => {
    switch (clip.source.type) {
      case "media":
        return Object.freeze({
          ...clip.source,
          mediaId: requireMappedId(
            mediaIds,
            clip.source.mediaId,
            "el medio del clip",
          ),
        });
      case "text":
        return Object.freeze({
          ...clip.source,
          textLayerId: requireMappedId(
            textLayerIds,
            clip.source.textLayerId,
            "el texto del clip",
          ),
        });
      case "generator":
        return Object.freeze({ ...clip.source });
      case "adjustment":
        return Object.freeze({ ...clip.source });
    }
  };

  const clips: readonly Clip[] = Object.freeze(
    source.clips.map((clip) =>
      Object.freeze({
        ...clip,
        id: requireMappedId(clipIds, clip.id, "el clip"),
        trackId: requireMappedId(trackIds, clip.trackId, "la pista del clip"),
        source: mapClipSource(clip),
        effectIds: Object.freeze(
          clip.effectIds.map((effectId) =>
            requireMappedId(effectIds, effectId, "el efecto"),
          ),
        ),
      }),
    ),
  );

  const effects: readonly EffectInstance[] = Object.freeze(
    source.effects.map((effect) => {
      const ownerId =
        effect.ownerType === "clip"
          ? requireMappedId(clipIds, effect.ownerId, "el clip del efecto")
          : effect.ownerType === "track"
            ? requireMappedId(trackIds, effect.ownerId, "la pista del efecto")
            : requireMappedId(
                sequenceIds,
                effect.ownerId,
                "la secuencia del efecto",
              );

      return Object.freeze({
        ...effect,
        id: requireMappedId(effectIds, effect.id, "el efecto"),
        ownerId,
      });
    }),
  );

  const transitions: readonly TransitionInstance[] = Object.freeze(
    source.transitions.map((transition) =>
      Object.freeze({
        ...transition,
        id: createEntityId("transition"),
        fromClipId: requireMappedId(
          clipIds,
          transition.fromClipId,
          "el clip inicial de la transición",
        ),
        toClipId: requireMappedId(
          clipIds,
          transition.toClipId,
          "el clip final de la transición",
        ),
      }),
    ),
  );

  const duplicated: ProjectDocument = Object.freeze({
    project: Object.freeze({
      ...source.project,
      id: projectId,
      name: normalizeName(input.name, "name", 120),
      status: "draft",
      mainSequenceId: requireMappedId(
        sequenceIds,
        source.project.mainSequenceId,
        "la secuencia principal",
      ),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    sequences,
    tracks,
    clips,
    media,
    textLayers,
    effects,
    transitions,
    jobs: Object.freeze([]),
  });

  return validateProjectDocument(duplicated);
}

export {
  duplicateProjectDocument,
  updateProjectDocument,
  type DuplicateProjectDocumentInput,
  type UpdateProjectDocumentInput,
};
