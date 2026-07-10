/* =========================================================
Nombre completo: ProjectCard.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/projects/ProjectCard.tsx

Función o funciones:
- Mostrar el resumen y estado de un proyecto.
- Ofrecer acciones de apertura, edición, duplicación y archivo.
- Mantener deshabilitadas las acciones durante operaciones activas.
========================================================= */

import type { ProjectListItem } from "../../../../shared/persistence/project-repository";
import { AppIcon } from "../ui/AppIcon";

interface ProjectCardProps {
  readonly project: ProjectListItem;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onRename: () => void;
  readonly onDuplicate: () => void;
  readonly onToggleArchive: () => void;
  readonly onDelete: () => void;
}

const statusLabels = Object.freeze({
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
});

function formatDuration(durationUs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationUs / 1_000_000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ProjectCard({
  project,
  busy,
  onOpen,
  onRename,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: ProjectCardProps): React.JSX.Element {
  const archived = project.status === "archived";

  return (
    <article className={`project-card ${archived ? "project-card--archived" : ""}`}>
      <div className="project-card__preview" aria-hidden="true">
        <span className="project-card__preview-icon">
          <AppIcon name="editor" size={30} />
        </span>
        <span className="project-card__duration">
          {formatDuration(project.durationUs)}
        </span>
      </div>

      <div className="project-card__body">
        <div className="project-card__heading">
          <div>
            <span className={`project-status project-status--${project.status}`}>
              {statusLabels[project.status]}
            </span>
            <h3 title={project.name}>{project.name}</h3>
          </div>
          {busy ? <span className="project-card__busy">Procesando…</span> : null}
        </div>

        <p className="project-card__updated">
          Actualizado {formatUpdatedAt(project.updatedAt)}
        </p>

        <div className="project-card__metrics">
          <span>
            <strong>{project.mediaCount}</strong>
            recursos
          </span>
          <span>
            <strong>{project.clipCount}</strong>
            clips
          </span>
          <span>
            <strong>v{project.schemaVersion}</strong>
            esquema
          </span>
        </div>
      </div>

      <footer className="project-card__actions">
        <button
          className="project-action project-action--primary"
          type="button"
          onClick={onOpen}
          disabled={busy || archived}
        >
          Abrir
          <AppIcon name="arrow" size={16} />
        </button>
        <button
          className="project-action"
          type="button"
          onClick={onRename}
          disabled={busy}
        >
          Renombrar
        </button>
        <button
          className="project-action"
          type="button"
          onClick={onDuplicate}
          disabled={busy}
        >
          Duplicar
        </button>
        <button
          className="project-action"
          type="button"
          onClick={onToggleArchive}
          disabled={busy}
        >
          {archived ? "Restaurar" : "Archivar"}
        </button>
        <button
          className="project-action project-action--danger"
          type="button"
          onClick={onDelete}
          disabled={busy}
        >
          Eliminar
        </button>
      </footer>
    </article>
  );
}

export { ProjectCard, type ProjectCardProps };
