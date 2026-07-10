/* =========================================================
Nombre completo: project-management-service.ts
Ruta o ubicación: /apps/desktop/main/projects/project-management-service.ts

Función o funciones:
- Coordinar las operaciones funcionales sobre proyectos.
- Aplicar reglas de dominio antes de persistir cambios.
- Crear, abrir, renombrar, duplicar, archivar y eliminar proyectos.
========================================================= */

import {
  createEmptyProjectDocument,
  duplicateProjectDocument,
  normalizeName,
  updateProjectDocument,
  validateProjectDocument,
  type EntityId,
  type ProjectCanvas,
  type ProjectDocument,
  type ProjectStatus,
} from "../../shared/domain/index.js";
import type {
  CreateProjectInput,
  DuplicateProjectInput,
  RenameProjectInput,
  SetProjectStatusInput,
} from "../../shared/project-management-contracts.js";
import type {
  ProjectListItem,
  ProjectRepository,
} from "../../shared/persistence/project-repository.js";

class ProjectNotFoundError extends Error {
  constructor(readonly projectId: EntityId<"project">) {
    super("El proyecto solicitado no existe.");
    this.name = "ProjectNotFoundError";
  }
}

const PROJECT_CANVAS_PRESETS: Readonly<
  Record<CreateProjectInput["preset"], ProjectCanvas>
> = Object.freeze({
  horizontal: Object.freeze({
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: "16:9",
    backgroundColor: "#000000",
  }),
  vertical: Object.freeze({
    width: 1080,
    height: 1920,
    fps: 30,
    aspectRatio: "9:16",
    backgroundColor: "#000000",
  }),
  square: Object.freeze({
    width: 1080,
    height: 1080,
    fps: 30,
    aspectRatio: "1:1",
    backgroundColor: "#000000",
  }),
  portrait: Object.freeze({
    width: 1080,
    height: 1350,
    fps: 30,
    aspectRatio: "4:5",
    backgroundColor: "#000000",
  }),
});

class ProjectManagementService {
  constructor(private readonly repository: ProjectRepository) {}

  async list(): Promise<readonly ProjectListItem[]> {
    return this.repository.list();
  }

  async create(input: CreateProjectInput): Promise<ProjectListItem> {
    const name = normalizeName(input.name, "name", 120);
    const baseDocument = createEmptyProjectDocument({ name });
    const document = validateProjectDocument(
      Object.freeze({
        ...baseDocument,
        project: Object.freeze({
          ...baseDocument.project,
          canvas: PROJECT_CANVAS_PRESETS[input.preset],
        }),
      }),
    );

    await this.repository.save(document, {
      snapshotReason: "proyecto creado",
    });

    return this.requireSummary(document.project.id);
  }

  async open(projectId: EntityId<"project">): Promise<ProjectDocument> {
    return this.requireDocument(projectId);
  }

  async rename(input: RenameProjectInput): Promise<ProjectListItem> {
    const document = await this.requireDocument(input.projectId);
    const updated = updateProjectDocument(document, { name: input.name });

    await this.repository.save(updated, {
      snapshotReason: "proyecto renombrado",
    });

    return this.requireSummary(input.projectId);
  }

  async duplicate(input: DuplicateProjectInput): Promise<ProjectListItem> {
    const source = await this.requireDocument(input.projectId);
    const duplicated = duplicateProjectDocument(source, {
      name: input.name,
    });

    await this.repository.save(duplicated, {
      snapshotReason: "proyecto duplicado",
    });

    return this.requireSummary(duplicated.project.id);
  }

  async setStatus(input: SetProjectStatusInput): Promise<ProjectListItem> {
    const document = await this.requireDocument(input.projectId);
    const updated = updateProjectDocument(document, {
      status: input.status,
    });

    await this.repository.save(updated, {
      snapshotReason: `estado cambiado a ${input.status}`,
    });

    return this.requireSummary(input.projectId);
  }

  async delete(projectId: EntityId<"project">): Promise<void> {
    const deleted = await this.repository.delete(projectId);

    if (!deleted) {
      throw new ProjectNotFoundError(projectId);
    }
  }

  private async requireDocument(
    projectId: EntityId<"project">,
  ): Promise<ProjectDocument> {
    const document = await this.repository.findById(projectId);

    if (!document) {
      throw new ProjectNotFoundError(projectId);
    }

    return document;
  }

  private async requireSummary(
    projectId: EntityId<"project">,
  ): Promise<ProjectListItem> {
    const projects = await this.repository.list();
    const summary = projects.find((project) => project.id === projectId);

    if (!summary) {
      throw new ProjectNotFoundError(projectId);
    }

    return summary;
  }
}

export {
  PROJECT_CANVAS_PRESETS,
  ProjectManagementService,
  ProjectNotFoundError,
};
