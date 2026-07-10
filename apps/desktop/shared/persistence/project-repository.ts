/* =========================================================
Nombre completo: project-repository.ts
Ruta o ubicación: /apps/desktop/shared/persistence/project-repository.ts

Función o funciones:
- Definir el contrato de persistencia de proyectos.
- Mantener el dominio desacoplado de SQLite.
- Permitir reemplazar o ampliar el almacenamiento en el futuro.
========================================================= */

import type {
  EntityId,
  ProjectAspectRatio,
  ProjectDocument,
  ProjectStatus,
} from "../domain/index.js";

interface ProjectListItem {
  readonly id: EntityId<"project">;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mediaCount: number;
  readonly clipCount: number;
  readonly durationUs: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly aspectRatio: ProjectAspectRatio;
}

interface SaveProjectOptions {
  readonly snapshotReason?: string;
  readonly keepSnapshots?: number;
}

interface ProjectRepository {
  save(
    document: ProjectDocument,
    options?: SaveProjectOptions,
  ): Promise<void>;
  findById(id: EntityId<"project">): Promise<ProjectDocument | null>;
  list(): Promise<readonly ProjectListItem[]>;
  delete(id: EntityId<"project">): Promise<boolean>;
  countSnapshots(id: EntityId<"project">): Promise<number>;
}

export {
  type ProjectListItem,
  type ProjectRepository,
  type SaveProjectOptions,
};
