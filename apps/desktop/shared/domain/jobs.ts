/* =========================================================
Nombre completo: jobs.ts
Ruta o ubicación: /apps/desktop/shared/domain/jobs.ts

Función o funciones:
- Definir trabajos pesados y sus estados.
- Modelar progreso, prioridad, dependencias y reintentos.
- Preparar la cola central que se implementará en el Bloque 8.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  clampNumber,
  createEntityId,
  toIsoDateTime,
  type EntityId,
  type IsoDateTime,
  type JsonValue,
} from "./primitives.js";

type JobKind =
  | "probe-media"
  | "generate-proxy"
  | "generate-waveform"
  | "generate-thumbnails"
  | "extract-audio"
  | "detect-silence"
  | "transcribe-audio"
  | "detect-scenes"
  | "render-preview"
  | "export-video";

type JobStatus =
  | "pending"
  | "preparing"
  | "running"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed";

interface JobErrorInfo {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

interface JobRecord {
  readonly id: EntityId<"job">;
  readonly projectId: EntityId<"project">;
  readonly kind: JobKind;
  readonly status: JobStatus;
  readonly priority: number;
  readonly progress: number;
  readonly dependencyIds: readonly EntityId<"job">[];
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly result?: Readonly<Record<string, JsonValue>>;
  readonly error?: JobErrorInfo;
  readonly createdAt: IsoDateTime;
  readonly startedAt?: IsoDateTime;
  readonly finishedAt?: IsoDateTime;
}

interface CreateJobInput {
  readonly id?: EntityId<"job">;
  readonly projectId: EntityId<"project">;
  readonly kind: JobKind;
  readonly priority?: number;
  readonly dependencyIds?: readonly EntityId<"job">[];
  readonly maxAttempts?: number;
  readonly payload?: Readonly<Record<string, JsonValue>>;
  readonly createdAt?: Date | string;
}

interface UpdateJobStateInput {
  readonly status: JobStatus;
  readonly progress?: number;
  readonly attempt?: number;
  readonly result?: Readonly<Record<string, JsonValue>>;
  readonly error?: JobErrorInfo;
  readonly now?: Date | string;
}

const TERMINAL_JOB_STATUSES: readonly JobStatus[] = Object.freeze([
  "cancelled",
  "completed",
  "failed",
]);

const ALLOWED_JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> =
  Object.freeze({
    pending: ["preparing", "cancelled"],
    preparing: ["running", "cancelled", "failed"],
    running: ["paused", "cancelled", "completed", "failed"],
    paused: ["running", "cancelled", "failed"],
    cancelled: [],
    completed: [],
    failed: ["pending"],
  });

function assertUniqueDependencies(
  jobId: EntityId<"job">,
  dependencyIds: readonly EntityId<"job">[],
): void {
  assertDomain(
    new Set(dependencyIds).size === dependencyIds.length,
    "DUPLICATE_VALUE",
    "dependencyIds",
    "La lista de dependencias contiene valores duplicados.",
  );
  assertDomain(
    !dependencyIds.includes(jobId),
    "INVALID_RELATION",
    "dependencyIds",
    "Un trabajo no puede depender de sí mismo.",
  );
}

function validateAttempt(
  attempt: number,
  maxAttempts: number,
): void {
  assertDomain(
    Number.isSafeInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 100,
    "OUT_OF_RANGE",
    "maxAttempts",
    "El máximo de intentos debe estar entre 1 y 100.",
  );
  assertDomain(
    Number.isSafeInteger(attempt) && attempt >= 0 && attempt <= maxAttempts,
    "OUT_OF_RANGE",
    "attempt",
    "El número de intento no puede superar el máximo permitido.",
  );
}

function createJob(input: CreateJobInput): JobRecord {
  const id = input.id ?? createEntityId("job");
  const dependencyIds = Object.freeze([...(input.dependencyIds ?? [])]);
  const maxAttempts = input.maxAttempts ?? 3;

  assertUniqueDependencies(id, dependencyIds);
  validateAttempt(0, maxAttempts);

  return Object.freeze({
    id,
    projectId: input.projectId,
    kind: input.kind,
    status: "pending",
    priority: clampNumber(input.priority ?? 50, 0, 100, "priority"),
    progress: 0,
    dependencyIds,
    attempt: 0,
    maxAttempts,
    payload: Object.freeze({ ...(input.payload ?? {}) }),
    createdAt: toIsoDateTime(input.createdAt ?? new Date(), "createdAt"),
  });
}

function canTransitionJob(
  currentStatus: JobStatus,
  nextStatus: JobStatus,
): boolean {
  return ALLOWED_JOB_TRANSITIONS[currentStatus].includes(nextStatus);
}

function updateJobState(
  job: JobRecord,
  input: UpdateJobStateInput,
): JobRecord {
  assertDomain(
    canTransitionJob(job.status, input.status),
    "INVALID_RELATION",
    "status",
    `No se puede cambiar un trabajo de ${job.status} a ${input.status}.`,
  );

  const progress = clampNumber(
    input.progress ?? job.progress,
    0,
    100,
    "progress",
  );
  const attempt = input.attempt ?? job.attempt;
  validateAttempt(attempt, job.maxAttempts);

  if (input.status === "completed") {
    assertDomain(
      progress === 100,
      "INVALID_RELATION",
      "progress",
      "Un trabajo completado debe tener progreso 100.",
    );
  }

  if (input.status === "failed") {
    assertDomain(
      input.error !== undefined,
      "REQUIRED",
      "error",
      "Un trabajo fallido debe incluir información del error.",
    );
  }

  const now = toIsoDateTime(input.now ?? new Date(), "now");
  const startedAt =
    job.startedAt ??
    (input.status === "running" || input.status === "preparing" ? now : undefined);
  const finishedAt = TERMINAL_JOB_STATUSES.includes(input.status)
    ? now
    : undefined;

  return Object.freeze({
    ...job,
    status: input.status,
    progress,
    attempt,
    result: input.result
      ? Object.freeze({ ...input.result })
      : job.result,
    error: input.error,
    startedAt,
    finishedAt,
  });
}

function areJobDependenciesCompleted(
  job: JobRecord,
  jobs: readonly JobRecord[],
): boolean {
  const jobsById = new Map(jobs.map((item) => [item.id, item]));

  return job.dependencyIds.every(
    (dependencyId) => jobsById.get(dependencyId)?.status === "completed",
  );
}

export {
  ALLOWED_JOB_TRANSITIONS,
  TERMINAL_JOB_STATUSES,
  areJobDependenciesCompleted,
  canTransitionJob,
  createJob,
  updateJobState,
  type CreateJobInput,
  type JobErrorInfo,
  type JobKind,
  type JobRecord,
  type JobStatus,
  type UpdateJobStateInput,
};
