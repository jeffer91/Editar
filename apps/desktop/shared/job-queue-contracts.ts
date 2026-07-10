/* =========================================================
Nombre completo: job-queue-contracts.ts
Ruta o ubicación: /apps/desktop/shared/job-queue-contracts.ts

Función o funciones:
- Definir operaciones públicas de la cola de trabajos.
- Compartir estados, acciones y resúmenes entre procesos.
- Mantener el renderer aislado del ejecutor y SQLite.
========================================================= */

import type {
  EntityId,
  JobRecord,
  JobStatus,
} from "./domain/index.js";
import type { IpcResult } from "./ipc-contracts.js";
import type { JobQueueListItem } from "./persistence/job-queue-repository.js";

interface JobIdInput {
  readonly jobId: EntityId<"job">;
}

interface ProjectJobInput {
  readonly projectId: EntityId<"project">;
}

interface JobQueueSummary {
  readonly total: number;
  readonly pending: number;
  readonly running: number;
  readonly paused: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
}

interface JobQueueSnapshot {
  readonly items: readonly JobQueueListItem[];
  readonly summary: JobQueueSummary;
  readonly concurrency: number;
  readonly workerOnline: boolean;
  readonly updatedAt: string;
}

interface JobActionResult {
  readonly job: JobRecord;
  readonly snapshot: JobQueueSnapshot;
}

interface JobQueueBridge {
  getSnapshot(): Promise<IpcResult<JobQueueSnapshot>>;
  enqueueDiagnostic(input: ProjectJobInput): Promise<IpcResult<JobActionResult>>;
  pause(input: JobIdInput): Promise<IpcResult<JobActionResult>>;
  resume(input: JobIdInput): Promise<IpcResult<JobActionResult>>;
  cancel(input: JobIdInput): Promise<IpcResult<JobActionResult>>;
  retry(input: JobIdInput): Promise<IpcResult<JobActionResult>>;
}

const MANAGEABLE_JOB_STATUSES: readonly JobStatus[] = Object.freeze([
  "pending",
  "preparing",
  "running",
  "paused",
  "failed",
]);

export {
  MANAGEABLE_JOB_STATUSES,
  type JobActionResult,
  type JobIdInput,
  type JobQueueBridge,
  type JobQueueSnapshot,
  type JobQueueSummary,
  type ProjectJobInput,
};
