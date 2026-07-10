/* =========================================================
Nombre completo: project-management-contracts.ts
Ruta o ubicación: /apps/desktop/shared/project-management-contracts.ts

Función o funciones:
- Definir las operaciones públicas de gestión de proyectos.
- Compartir entradas y resultados entre preload, main y renderer.
- Mantener SQLite oculto detrás de contratos tipados.
========================================================= */

import type {
  EntityId,
  ProjectDocument,
  ProjectStatus,
} from "./domain/index.js";
import type { IpcResult } from "./ipc-contracts.js";
import type { ProjectListItem } from "./persistence/project-repository.js";

type ProjectCanvasPreset =
  | "horizontal"
  | "vertical"
  | "square"
  | "portrait";

interface CreateProjectInput {
  readonly name: string;
  readonly preset: ProjectCanvasPreset;
}

interface ProjectIdInput {
  readonly projectId: EntityId<"project">;
}

interface RenameProjectInput extends ProjectIdInput {
  readonly name: string;
}

interface DuplicateProjectInput extends ProjectIdInput {
  readonly name: string;
}

interface SetProjectStatusInput extends ProjectIdInput {
  readonly status: ProjectStatus;
}

interface DeleteProjectResult {
  readonly projectId: EntityId<"project">;
  readonly deleted: true;
}

interface ProjectBridge {
  list(): Promise<IpcResult<readonly ProjectListItem[]>>;
  create(input: CreateProjectInput): Promise<IpcResult<ProjectListItem>>;
  open(input: ProjectIdInput): Promise<IpcResult<ProjectDocument>>;
  rename(input: RenameProjectInput): Promise<IpcResult<ProjectListItem>>;
  duplicate(input: DuplicateProjectInput): Promise<IpcResult<ProjectListItem>>;
  setStatus(input: SetProjectStatusInput): Promise<IpcResult<ProjectListItem>>;
  delete(input: ProjectIdInput): Promise<IpcResult<DeleteProjectResult>>;
}

export {
  type CreateProjectInput,
  type DeleteProjectResult,
  type DuplicateProjectInput,
  type ProjectBridge,
  type ProjectCanvasPreset,
  type ProjectIdInput,
  type RenameProjectInput,
  type SetProjectStatusInput,
};
