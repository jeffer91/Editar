/* =========================================================
Nombre completo: JobsScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/JobsScreen.tsx

Función o funciones:
- Mostrar la cola global y su progreso.
- Crear una prueba real de procesamiento en Worker Thread.
- Supervisar análisis y generación de derivados multimedia.
========================================================= */

import { useEffect, useMemo, useState } from "react";
import type {
  EntityId,
  JobKind,
  JobRecord,
  JobStatus,
} from "../../../shared/domain";
import type { ProjectListItem } from "../../../shared/persistence/project-repository";
import { useJobQueue, type QueueAction } from "../app/use-job-queue";
import { AppIcon } from "../components/ui/AppIcon";

interface JobsScreenProps {
  readonly onNavigateProjects: () => void;
}

const statusLabels: Readonly<Record<JobStatus, string>> = Object.freeze({
  pending: "Pendiente",
  preparing: "Preparando",
  running: "Procesando",
  paused: "Pausado",
  cancelled: "Cancelado",
  completed: "Completado",
  failed: "Fallido",
});

const kindLabels: Readonly<Record<JobKind, string>> = Object.freeze({
  "diagnostic-worker": "Diagnóstico del trabajador",
  "probe-media": "Analizar medio",
  "generate-proxy": "Generar proxy",
  "generate-waveform": "Generar forma de onda",
  "generate-thumbnails": "Generar miniatura",
  "extract-audio": "Extraer audio",
  "detect-silence": "Detectar silencios",
  "transcribe-audio": "Transcribir audio",
  "detect-scenes": "Detectar escenas",
  "render-preview": "Renderizar vista previa",
  "export-video": "Exportar video",
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function actionsForStatus(status: JobStatus): readonly QueueAction[] {
  switch (status) {
    case "pending":
    case "preparing":
    case "running":
      return ["pause", "cancel"];
    case "paused":
      return ["resume", "cancel"];
    case "failed":
      return ["retry"];
    default:
      return [];
  }
}

const actionLabels: Readonly<Record<QueueAction, string>> = Object.freeze({
  pause: "Pausar",
  resume: "Reanudar",
  cancel: "Cancelar",
  retry: "Reintentar",
});

function JobCard({
  job,
  projectName,
  busy,
  onAction,
}: {
  readonly job: JobRecord;
  readonly projectName: string;
  readonly busy: boolean;
  readonly onAction: (action: QueueAction, jobId: EntityId<"job">) => void;
}): React.JSX.Element {
  const actions = actionsForStatus(job.status);

  return (
    <article className="job-card">
      <div className="job-card__heading">
        <span className="job-card__icon">
          <AppIcon name="jobs" size={19} />
        </span>
        <div>
          <strong>{kindLabels[job.kind]}</strong>
          <small>{projectName}</small>
        </div>
        <span className={`job-status job-status--${job.status}`}>
          {statusLabels[job.status]}
        </span>
      </div>

      <div className="job-progress" aria-label={`Progreso ${job.progress}%`}>
        <span style={{ width: `${job.progress}%` }} />
      </div>

      <div className="job-card__details">
        <span>Progreso: {Math.round(job.progress)}%</span>
        <span>Prioridad: {job.priority}</span>
        <span>Intento: {job.attempt}/{job.maxAttempts}</span>
        <span>Actualizado: {formatDate(job.updatedAt)}</span>
      </div>

      {job.error ? (
        <div className="job-card__error">
          <strong>{job.error.code}</strong>
          <span>{job.error.message}</span>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="job-card__actions">
          {actions.map((action) => (
            <button
              type="button"
              disabled={busy}
              key={action}
              onClick={() => onAction(action, job.id)}
            >
              {busy ? "Procesando…" : actionLabels[action]}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function JobsScreen({ onNavigateProjects }: JobsScreenProps): React.JSX.Element {
  const queue = useJobQueue();
  const [projects, setProjects] = useState<readonly ProjectListItem[]>([]);
  const [projectId, setProjectId] = useState<EntityId<"project"> | "">("");
  const [creatingDiagnostic, setCreatingDiagnostic] = useState(false);

  useEffect(() => {
    void window.editar.projects.list().then((result) => {
      if (!result.ok) {
        return;
      }

      const available = result.data.filter((project) => project.status !== "archived");
      setProjects(available);
      setProjectId((current) => current || available[0]?.id || "");
    });
  }, []);

  const summaryItems = useMemo(() => {
    const summary = queue.snapshot?.summary;

    return [
      ["Pendientes", summary?.pending ?? 0],
      ["Procesando", summary?.running ?? 0],
      ["Pausados", summary?.paused ?? 0],
      ["Completados", summary?.completed ?? 0],
      ["Fallidos", summary?.failed ?? 0],
    ] as const;
  }, [queue.snapshot]);

  const createDiagnostic = async (): Promise<void> => {
    if (!projectId) {
      return;
    }

    setCreatingDiagnostic(true);
    await queue.enqueueDiagnostic(projectId);
    setCreatingDiagnostic(false);
  };

  return (
    <div className="screen-stack">
      <section className="screen-banner">
        <div>
          <span className="section-label">BLOQUE 10 · PROCESAMIENTO MULTIMEDIA</span>
          <h2>Centro de trabajos</h2>
          <p>
            La cola ejecuta FFprobe y FFmpeg fuera del renderer. Aquí puedes
            supervisar análisis, proxies, miniaturas, formas de onda, pausas,
            cancelaciones y reintentos.
          </p>
        </div>
        <div className="queue-health">
          <span
            className={`queue-health__dot ${queue.snapshot?.workerOnline ? "queue-health__dot--online" : ""}`}
          />
          <div>
            <strong>
              {queue.snapshot?.workerOnline ? "Worker disponible" : "Worker desconectado"}
            </strong>
            <small>Concurrencia: {queue.snapshot?.concurrency ?? 0}</small>
          </div>
        </div>
      </section>

      <section className="job-summary-grid">
        {summaryItems.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="content-section job-diagnostic-section">
        <div>
          <span className="section-label">PRUEBA DEL MOTOR</span>
          <h2>Verificar Worker Thread</h2>
          <p>
            Ejecuta una tarea corta con progreso real. La misma infraestructura
            procesa actualmente FFprobe, proxies, miniaturas y formas de onda.
          </p>
        </div>
        {projects.length > 0 ? (
          <div className="job-diagnostic-controls">
            <select
              value={projectId}
              onChange={(event) =>
                setProjectId(event.target.value as EntityId<"project">)
              }
              aria-label="Proyecto para el diagnóstico"
            >
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              type="button"
              disabled={!projectId || creatingDiagnostic}
              onClick={() => void createDiagnostic()}
            >
              {creatingDiagnostic ? "Creando…" : "Ejecutar diagnóstico"}
            </button>
          </div>
        ) : (
          <button className="secondary-button" type="button" onClick={onNavigateProjects}>
            Crear un proyecto primero
          </button>
        )}
      </section>

      {queue.errorMessage ? (
        <div className="project-error-banner" role="alert">
          <div>
            <strong>Error en la cola</strong>
            <p>{queue.errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void queue.refresh()}>
            Reintentar
          </button>
        </div>
      ) : null}

      <section className="content-section jobs-list-section">
        <div className="content-section__heading">
          <div>
            <span className="section-label">COLA PERSISTENTE</span>
            <h2>Trabajos registrados</h2>
          </div>
          <p>{queue.snapshot?.summary.total ?? 0} trabajos en el historial.</p>
        </div>

        {queue.loading && !queue.snapshot ? (
          <div className="projects-loading">
            <span className="projects-loading__spinner" />
            Consultando trabajos…
          </div>
        ) : queue.snapshot?.items.length ? (
          <div className="jobs-grid">
            {queue.snapshot.items.map((item) => (
              <JobCard
                job={item.job}
                projectName={item.projectName}
                busy={queue.activeJobId === item.job.id}
                key={item.job.id}
                onAction={(action, jobId) => void queue.runAction(action, jobId)}
              />
            ))}
          </div>
        ) : (
          <div className="projects-empty-state">
            <AppIcon name="jobs" size={34} />
            <h3>La cola está vacía</h3>
            <p>Importa un medio o ejecuta el diagnóstico para crear trabajos.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export { JobsScreen, type JobsScreenProps };
