/* =========================================================
Nombre completo: jobs.ts
Ruta o ubicación: /apps/desktop/shared/domain/jobs.ts

Función o funciones:
- Definir trabajos pesados, prioridades y dependencias.
- Controlar progreso, pausa, cancelación, recuperación y reintentos.
- Proporcionar estados persistentes para la cola central.
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
  | "diagnostic-worker"
  | "probe-media"
  | "generate-proxy"
  | "generate-waveform"
  | "generate-thumbnails"
  | "extract-audio"
  | "detect-silence"
  | "reduce-silence"
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
  readonly updatedAt: IsoDateTime;
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

const ACTIVE_JOB_STATUSES: readonly JobStatus[] = Object.freeze([
  "preparing",
  "running",
]);

const ALLOWED_JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> =
  Object.freeze({
    pending: ["preparing", "paused", "cancelled", "failed"],
    preparing: ["pending", "running", "cancelled", "failed"],
    running: ["running", "pending", "paused", "cancelled", "completed", "failed"],
    paused: ["pending", "cancelled"],
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

function validateAttempt(attempt: number, maxAttempts: number): void {
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
  const createdAt = toIsoDateTime(input.createdAt ?? new Date(), "createdAt");

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
    createdAt,
    updatedAt: createdAt,
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
    input.progress ?? (input.status === "pending" ? 0 : job.progress),
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
      : input.status === "pending"
        ? undefined
        : job.result,
    error:
      input.error ??
      (input.status === "pending" || input.status === "completed"
        ? undefined
        : job.error),
    updatedAt: now,
    startedAt,
    finishedAt,
  });
}

function recoverInterruptedJob(
  job: JobRecord,
  now: Date | string = new Date(),
): JobRecord {
  assertDomain(
    ACTIVE_JOB_STATUSES.includes(job.status),
    "INVALID_RELATION",
    "status",
    "Solo se pueden recuperar trabajos interrumpidos.",
  );

  if (job.attempt >= job.maxAttempts) {
    return updateJobState(job, {
      status: "failed",
      error: {
        code: "MAX_ATTEMPTS_REACHED",
        message: "El trabajo alcanzó el máximo de intentos después de una interrupción.",
        retryable: false,
      },
      now,
    });
  }

  return updateJobState(job, {
    status: "pending",
    progress: 0,
    now,
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
  ACTIVE_JOB_STATUSES,
  ALLOWED_JOB_TRANSITIONS,
  TERMINAL_JOB_STATUSES,
  areJobDependenciesCompleted,
  canTransitionJob,
  createJob,
  recoverInterruptedJob,
  updateJobState,
  type CreateJobInput,
  type JobErrorInfo,
  type JobKind,
  type JobRecord,
  type JobStatus,
  type UpdateJobStateInput,
};
