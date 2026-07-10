/* =========================================================
Nombre completo: job-queue-repository.ts
Ruta o ubicación: /apps/desktop/shared/persistence/job-queue-repository.ts

Función o funciones:
- Definir persistencia especializada para trabajos frecuentes.
- Evitar snapshots y guardados completos por cada cambio de progreso.
- Mantener la cola desacoplada de SQLite.
========================================================= */

import type {
  EntityId,
  JobRecord,
  JobStatus,
} from "../domain/index.js";

interface JobQueueListItem {
  readonly job: JobRecord;
  readonly projectName: string;
}

interface JobQueueRepository {
  insert(job: JobRecord): Promise<void>;
  update(job: JobRecord): Promise<void>;
  findById(id: EntityId<"job">): Promise<JobRecord | null>;
  list(projectId?: EntityId<"project">): Promise<readonly JobQueueListItem[]>;
  listByStatuses(statuses: readonly JobStatus[]): Promise<readonly JobRecord[]>;
}

export {
  type JobQueueListItem,
  type JobQueueRepository,
};
