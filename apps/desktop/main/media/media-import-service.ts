/* =========================================================
Nombre completo: media-import-service.ts
Ruta o ubicación: /apps/desktop/main/media/media-import-service.ts

Función o funciones:
- Importar rutas seleccionadas dentro de un proyecto.
- Detectar duplicados por hash sin modificar los originales.
- Guardar recursos válidos y devolver un resumen detallado.
========================================================= */

import { basename } from "node:path";
import {
  addMediaAssetsToProject,
  createMediaAsset,
  type EntityId,
  type MediaAsset,
  type MediaKind,
  type ProjectDocument,
} from "../../shared/domain/index.js";
import type {
  MediaImportDuplicate,
  MediaImportRejection,
  MediaImportResult,
  MediaImportSummary,
} from "../../shared/media-import-contracts.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import { ProjectNotFoundError } from "../projects/project-management-service.js";
import {
  MediaFileInspectionError,
  inspectMediaFile,
} from "./media-file-inspector.js";

const MAX_FILES_PER_IMPORT = 100;

class MediaImportConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaImportConflictError";
  }
}

function emptyKindCounter(): Record<MediaKind, number> {
  return { video: 0, audio: 0, image: 0 };
}

function createSummary(
  selectedCount: number,
  imported: readonly MediaAsset[],
  duplicates: readonly MediaImportDuplicate[],
  rejected: readonly MediaImportRejection[],
  canceled = false,
): MediaImportSummary {
  const importedByKind = emptyKindCounter();

  for (const asset of imported) {
    importedByKind[asset.kind] += 1;
  }

  return Object.freeze({
    canceled,
    selectedCount,
    importedCount: imported.length,
    duplicateCount: duplicates.length,
    rejectedCount: rejected.length,
    importedByKind: Object.freeze(importedByKind),
  });
}

function createCanceledResult(project: ProjectDocument): MediaImportResult {
  return Object.freeze({
    project,
    imported: Object.freeze([]),
    duplicates: Object.freeze([]),
    rejected: Object.freeze([]),
    summary: createSummary(0, [], [], [], true),
  });
}

class MediaImportService {
  constructor(private readonly repository: ProjectRepository) {}

  async createCanceledResult(
    projectId: EntityId<"project">,
  ): Promise<MediaImportResult> {
    return createCanceledResult(await this.requireProject(projectId));
  }

  async importPaths(
    projectId: EntityId<"project">,
    selectedPaths: readonly string[],
  ): Promise<MediaImportResult> {
    const project = await this.requireProject(projectId);

    if (project.project.status === "archived") {
      throw new MediaImportConflictError(
        "Restaura el proyecto antes de importar archivos.",
      );
    }

    if (selectedPaths.length === 0) {
      return createCanceledResult(project);
    }

    const acceptedPaths = selectedPaths.slice(0, MAX_FILES_PER_IMPORT);
    const overflowPaths = selectedPaths.slice(MAX_FILES_PER_IMPORT);
    const imported: MediaAsset[] = [];
    const duplicates: MediaImportDuplicate[] = [];
    const rejected: MediaImportRejection[] = overflowPaths.map((sourcePath) =>
      Object.freeze({
        fileName: basename(sourcePath) || "Archivo",
        sourcePath,
        code: "TOO_MANY_FILES" as const,
        message: `Solo pueden procesarse ${MAX_FILES_PER_IMPORT} archivos por importación.`,
      }),
    );
    const mediaByHash = new Map<string, MediaAsset>();

    for (const asset of project.media) {
      if (asset.contentHash) {
        mediaByHash.set(asset.contentHash, asset);
      }
    }

    for (const sourcePath of acceptedPaths) {
      try {
        const inspected = await inspectMediaFile(sourcePath);
        const duplicate = mediaByHash.get(inspected.contentHash);

        if (duplicate) {
          duplicates.push(
            Object.freeze({
              fileName: inspected.fileName,
              sourcePath: inspected.sourcePath,
              existingMediaId: duplicate.id,
              contentHash: inspected.contentHash,
            }),
          );
          continue;
        }

        const asset = createMediaAsset({
          projectId,
          kind: inspected.kind,
          fileName: inspected.fileName,
          sourcePath: inspected.sourcePath,
          extension: inspected.extension,
          mimeType: inspected.mimeType,
          sizeBytes: inspected.sizeBytes,
          sourceModifiedAt: inspected.sourceModifiedAt,
          contentHash: inspected.contentHash,
          availability: "online",
          inspection: { status: "pending" },
        });

        imported.push(asset);
        mediaByHash.set(inspected.contentHash, asset);
      } catch (error) {
        if (error instanceof MediaFileInspectionError) {
          rejected.push(
            Object.freeze({
              fileName: basename(error.sourcePath) || "Archivo",
              sourcePath: error.sourcePath,
              code: error.code,
              message: error.message,
            }),
          );
          continue;
        }

        rejected.push(
          Object.freeze({
            fileName: basename(sourcePath) || "Archivo",
            sourcePath,
            code: "READ_ERROR",
            message: "No fue posible procesar el archivo seleccionado.",
          }),
        );
      }
    }

    const updatedProject =
      imported.length > 0
        ? addMediaAssetsToProject(project, { assets: imported })
        : project;

    if (imported.length > 0) {
      await this.repository.save(updatedProject, {
        snapshotReason: `importación de ${imported.length} medios`,
      });
    }

    return Object.freeze({
      project: updatedProject,
      imported: Object.freeze(imported),
      duplicates: Object.freeze(duplicates),
      rejected: Object.freeze(rejected),
      summary: createSummary(
        selectedPaths.length,
        imported,
        duplicates,
        rejected,
      ),
    });
  }

  private async requireProject(
    projectId: EntityId<"project">,
  ): Promise<ProjectDocument> {
    const project = await this.repository.findById(projectId);

    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    return project;
  }
}

export {
  MAX_FILES_PER_IMPORT,
  MediaImportConflictError,
  MediaImportService,
  createCanceledResult,
  createSummary,
};
