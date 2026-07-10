/* =========================================================
Nombre completo: use-project-management.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-project-management.ts

Función o funciones:
- Cargar y mantener sincronizada la lista de proyectos.
- Ejecutar operaciones mediante el bridge seguro de Electron.
- Centralizar estados de carga, operación y error.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import type { ProjectDocument, ProjectStatus } from "../../../shared/domain";
import type {
  CreateProjectInput,
  ProjectCanvasPreset,
} from "../../../shared/project-management-contracts";
import type { ProjectListItem } from "../../../shared/persistence/project-repository";

type ProjectOperation =
  | "loading"
  | "creating"
  | "opening"
  | "renaming"
  | "duplicating"
  | "status"
  | "deleting"
  | "idle";

interface ProjectManagementState {
  readonly projects: readonly ProjectListItem[];
  readonly operation: ProjectOperation;
  readonly busyProjectId: string | null;
  readonly errorMessage: string;
  readonly refresh: () => Promise<void>;
  readonly create: (
    name: string,
    preset: ProjectCanvasPreset,
  ) => Promise<ProjectListItem>;
  readonly open: (projectId: ProjectListItem["id"]) => Promise<ProjectDocument>;
  readonly rename: (
    projectId: ProjectListItem["id"],
    name: string,
  ) => Promise<ProjectListItem>;
  readonly duplicate: (
    projectId: ProjectListItem["id"],
    name: string,
  ) => Promise<ProjectListItem>;
  readonly setStatus: (
    projectId: ProjectListItem["id"],
    status: ProjectStatus,
  ) => Promise<ProjectListItem>;
  readonly remove: (projectId: ProjectListItem["id"]) => Promise<void>;
  readonly clearError: () => void;
}

function useProjectManagement(): ProjectManagementState {
  const [projects, setProjects] = useState<readonly ProjectListItem[]>([]);
  const [operation, setOperation] = useState<ProjectOperation>("loading");
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleError = useCallback((error: unknown): never => {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible completar la operación del proyecto.";

    setErrorMessage(message);
    throw error instanceof Error ? error : new Error(message);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setOperation("loading");
    setErrorMessage("");

    try {
      const result = await window.editar.projects.list();

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      setProjects(result.data);
    } catch (error) {
      handleError(error);
    } finally {
      setOperation("idle");
    }
  }, [handleError]);

  const replaceProject = useCallback((updated: ProjectListItem): void => {
    setProjects((current) => {
      const withoutUpdated = current.filter((item) => item.id !== updated.id);
      return Object.freeze(
        [updated, ...withoutUpdated].sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        ),
      );
    });
  }, []);

  const create = useCallback(
    async (
      name: string,
      preset: ProjectCanvasPreset,
    ): Promise<ProjectListItem> => {
      setOperation("creating");
      setErrorMessage("");

      try {
        const input: CreateProjectInput = { name, preset };
        const result = await window.editar.projects.create(input);

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        replaceProject(result.data);
        return result.data;
      } catch (error) {
        return handleError(error);
      } finally {
        setOperation("idle");
      }
    },
    [handleError, replaceProject],
  );

  const open = useCallback(
    async (projectId: ProjectListItem["id"]): Promise<ProjectDocument> => {
      setOperation("opening");
      setBusyProjectId(projectId);
      setErrorMessage("");

      try {
        const result = await window.editar.projects.open({ projectId });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        return result.data;
      } catch (error) {
        return handleError(error);
      } finally {
        setBusyProjectId(null);
        setOperation("idle");
      }
    },
    [handleError],
  );

  const rename = useCallback(
    async (
      projectId: ProjectListItem["id"],
      name: string,
    ): Promise<ProjectListItem> => {
      setOperation("renaming");
      setBusyProjectId(projectId);
      setErrorMessage("");

      try {
        const result = await window.editar.projects.rename({ projectId, name });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        replaceProject(result.data);
        return result.data;
      } catch (error) {
        return handleError(error);
      } finally {
        setBusyProjectId(null);
        setOperation("idle");
      }
    },
    [handleError, replaceProject],
  );

  const duplicate = useCallback(
    async (
      projectId: ProjectListItem["id"],
      name: string,
    ): Promise<ProjectListItem> => {
      setOperation("duplicating");
      setBusyProjectId(projectId);
      setErrorMessage("");

      try {
        const result = await window.editar.projects.duplicate({ projectId, name });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        replaceProject(result.data);
        return result.data;
      } catch (error) {
        return handleError(error);
      } finally {
        setBusyProjectId(null);
        setOperation("idle");
      }
    },
    [handleError, replaceProject],
  );

  const setStatus = useCallback(
    async (
      projectId: ProjectListItem["id"],
      status: ProjectStatus,
    ): Promise<ProjectListItem> => {
      setOperation("status");
      setBusyProjectId(projectId);
      setErrorMessage("");

      try {
        const result = await window.editar.projects.setStatus({
          projectId,
          status,
        });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        replaceProject(result.data);
        return result.data;
      } catch (error) {
        return handleError(error);
      } finally {
        setBusyProjectId(null);
        setOperation("idle");
      }
    },
    [handleError, replaceProject],
  );

  const remove = useCallback(
    async (projectId: ProjectListItem["id"]): Promise<void> => {
      setOperation("deleting");
      setBusyProjectId(projectId);
      setErrorMessage("");

      try {
        const result = await window.editar.projects.delete({ projectId });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        setProjects((current) =>
          Object.freeze(current.filter((item) => item.id !== projectId)),
        );
      } catch (error) {
        handleError(error);
      } finally {
        setBusyProjectId(null);
        setOperation("idle");
      }
    },
    [handleError],
  );

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  return {
    projects,
    operation,
    busyProjectId,
    errorMessage,
    refresh,
    create,
    open,
    rename,
    duplicate,
    setStatus,
    remove,
    clearError: () => setErrorMessage(""),
  };
}

export {
  useProjectManagement,
  type ProjectManagementState,
  type ProjectOperation,
};
