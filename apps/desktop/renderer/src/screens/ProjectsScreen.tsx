/* =========================================================
Nombre completo: ProjectsScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/ProjectsScreen.tsx

Función o funciones:
- Gestionar proyectos almacenados en SQLite.
- Crear, buscar, filtrar, abrir, renombrar y duplicar.
- Archivar, restaurar y eliminar con confirmación.
========================================================= */

import { useMemo, useState } from "react";
import type { ProjectDocument } from "../../../shared/domain";
import type { ProjectCanvasPreset } from "../../../shared/project-management-contracts";
import type { ProjectListItem } from "../../../shared/persistence/project-repository";
import { useProjectManagement } from "../app/use-project-management";
import { ConfirmProjectDialog } from "../components/projects/ConfirmProjectDialog";
import { ProjectCard } from "../components/projects/ProjectCard";
import {
  ProjectFormDialog,
  type ProjectFormMode,
} from "../components/projects/ProjectFormDialog";
import { AppIcon } from "../components/ui/AppIcon";

interface ProjectsScreenProps {
  readonly onOpenProject: (document: ProjectDocument) => void;
}

type ProjectFilter = "active" | "archived" | "all";

interface FormDialogState {
  readonly mode: ProjectFormMode;
  readonly project: ProjectListItem | null;
}

function ProjectsScreen({
  onOpenProject,
}: ProjectsScreenProps): React.JSX.Element {
  const management = useProjectManagement();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("active");
  const [formDialog, setFormDialog] = useState<FormDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);

  const counts = useMemo(() => {
    const archived = management.projects.filter(
      (project) => project.status === "archived",
    ).length;

    return {
      all: management.projects.length,
      archived,
      active: management.projects.length - archived,
    };
  }, [management.projects]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");

    return management.projects.filter((project) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "archived"
          ? project.status === "archived"
          : project.status !== "archived");
      const matchesQuery =
        !normalizedQuery ||
        project.name.toLocaleLowerCase("es").includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [filter, management.projects, query]);

  const dialogBusy =
    management.operation === "creating" ||
    management.operation === "renaming" ||
    management.operation === "duplicating";

  const handleOpen = async (project: ProjectListItem): Promise<void> => {
    try {
      const document = await management.open(project.id);
      onOpenProject(document);
    } catch {
      // El hook ya expone el mensaje para la interfaz.
    }
  };

  const handleFormSubmit = async (
    name: string,
    preset: ProjectCanvasPreset,
  ): Promise<void> => {
    if (!formDialog) {
      return;
    }

    try {
      if (formDialog.mode === "create") {
        const created = await management.create(name, preset);
        const document = await management.open(created.id);
        setFormDialog(null);
        onOpenProject(document);
        return;
      }

      if (!formDialog.project) {
        return;
      }

      if (formDialog.mode === "rename") {
        await management.rename(formDialog.project.id, name);
      } else {
        await management.duplicate(formDialog.project.id, name);
      }

      setFormDialog(null);
    } catch {
      // El diálogo permanece abierto para que el usuario pueda corregir o reintentar.
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }

    try {
      await management.remove(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // El mensaje se muestra en el banner de error.
    }
  };

  const loading = management.operation === "loading";

  return (
    <div className="screen-stack">
      <section className="screen-banner screen-banner--projects">
        <div>
          <span className="section-label">GESTIÓN DE TRABAJO</span>
          <h2>Todos los proyectos en un solo lugar</h2>
          <p>
            Crea proyectos por formato, ábrelos en el editor y administra sus
            copias, estados y snapshots desde una única pantalla conectada a
            SQLite.
          </p>
          <div className="screen-banner__actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setFormDialog({ mode: "create", project: null })}
            >
              <span aria-hidden="true">＋</span>
              Nuevo proyecto
            </button>
          </div>
        </div>
        <span className="screen-banner__icon" aria-hidden="true">
          <AppIcon name="projects" size={34} />
        </span>
      </section>

      {management.errorMessage ? (
        <section className="project-error-banner" role="alert">
          <div>
            <strong>No fue posible completar la operación</strong>
            <p>{management.errorMessage}</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              management.clearError();
              void management.refresh().catch(() => undefined);
            }}
          >
            Reintentar
          </button>
        </section>
      ) : null}

      <section className="content-section projects-section">
        <div className="projects-toolbar">
          <div className="project-filter-tabs" role="tablist" aria-label="Filtrar proyectos">
            {(
              [
                ["active", "Activos", counts.active],
                ["archived", "Archivados", counts.archived],
                ["all", "Todos", counts.all],
              ] as const
            ).map(([value, label, count]) => (
              <button
                className={`project-filter-tab ${
                  filter === value ? "project-filter-tab--active" : ""
                }`}
                type="button"
                role="tab"
                aria-selected={filter === value}
                key={value}
                onClick={() => setFilter(value)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>

          <label className="project-search">
            <span className="sr-only">Buscar proyectos</span>
            <AppIcon name="projects" size={17} />
            <input
              type="search"
              value={query}
              placeholder="Buscar por nombre..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="projects-loading" role="status">
            <span className="projects-loading__spinner" />
            Consultando proyectos guardados…
          </div>
        ) : visibleProjects.length > 0 ? (
          <div className="project-grid">
            {visibleProjects.map((project) => (
              <ProjectCard
                project={project}
                busy={management.busyProjectId === project.id}
                key={project.id}
                onOpen={() => void handleOpen(project)}
                onRename={() =>
                  setFormDialog({ mode: "rename", project })
                }
                onDuplicate={() =>
                  setFormDialog({
                    mode: "duplicate",
                    project,
                  })
                }
                onToggleArchive={() =>
                  void management
                    .setStatus(
                      project.id,
                      project.status === "archived" ? "draft" : "archived",
                    )
                    .catch(() => undefined)
                }
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
          </div>
        ) : (
          <div className="projects-empty-state">
            <span className="empty-state__icon">
              <AppIcon name="projects" size={30} />
            </span>
            <h3>
              {management.projects.length === 0
                ? "Aún no existen proyectos"
                : "No encontramos coincidencias"}
            </h3>
            <p>
              {management.projects.length === 0
                ? "Crea el primer proyecto y elige el formato que usarás en el editor."
                : "Cambia el filtro o escribe otro nombre en la búsqueda."}
            </p>
            {management.projects.length === 0 ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setFormDialog({ mode: "create", project: null })}
              >
                Crear primer proyecto
              </button>
            ) : null}
          </div>
        )}
      </section>

      <ProjectFormDialog
        open={formDialog !== null}
        mode={formDialog?.mode ?? "create"}
        initialName={
          formDialog?.mode === "duplicate"
            ? `${formDialog.project?.name ?? "Proyecto"} - copia`
            : formDialog?.project?.name ?? ""
        }
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) {
            setFormDialog(null);
          }
        }}
        onSubmit={handleFormSubmit}
      />

      <ConfirmProjectDialog
        open={deleteTarget !== null}
        projectName={deleteTarget?.name ?? ""}
        busy={management.operation === "deleting"}
        onClose={() => {
          if (management.operation !== "deleting") {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export { ProjectsScreen, type ProjectsScreenProps };
