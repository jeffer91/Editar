/* =========================================================
Nombre completo: job-queue-service.ts
Ruta o ubicación: /apps/desktop/main/jobs/job-queue-service.ts

Función o funciones:
- Coordinar la cola persistente con prioridad y dependencias.
- Ejecutar, pausar, cancelar, reintentar y recuperar trabajos.
- Limitar concurrencia y mantener progreso fuera del renderer.
========================================================= */

import {
  areJobDependenciesCompleted,
  createJob,
  recoverInterruptedJob,
  updateJobState,
  type EntityId,
  type JobErrorInfo,
  type JobRecord,
} from "../../shared/domain/index.js";
import type {
  JobActionResult,
  JobQueueSnapshot,
  JobQueueSummary,
} from "../../shared/job-queue-contracts.js";
import type { JobQueueRepository } from "../../shared/persistence/job-queue-repository.js";
import type { ProjectRepository } from "../../shared/persistence/project-repository.js";
import type { JobExecutor } from "./job-executor.js";
import {
  JobExecutionAbortedError,
  JobWorkerError,
} from "./worker-thread-job-executor.js";

interface JobQueueServiceOptions {
  readonly repository: JobQueueRepository;
  readonly projects: ProjectRepository;
  readonly executor: JobExecutor;
  readonly concurrency?: number;
  readonly pollIntervalMs?: number;
}

interface ActiveExecution {
  readonly controller: AbortController;
  promise: Promise<void>;
  desiredState: "paused" | "cancelled" | null;
}

class JobNotFoundError extends Error {
  constructor(readonly jobId: EntityId<"job">) {
    super("El trabajo solicitado no existe.");
    this.name = "JobNotFoundError";
  }
}

class JobQueueConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobQueueConflictError";
  }
}

function createSummary(jobs: readonly JobRecord[]): JobQueueSummary {
  const count = (status: JobRecord["status"]): number =>
    jobs.filter((job) => job.status === status).length;

  return Object.freeze({
    total: jobs.length,
    pending: count("pending") + count("preparing"),
    running: count("running"),
    paused: count("paused"),
    completed: count("completed"),
    failed: count("failed"),
    cancelled: count("cancelled"),
  });
}

class JobQueueService {
  readonly concurrency: number;

  private readonly pollIntervalMs: number;
  private readonly active = new Map<EntityId<"job">, ActiveExecution>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private stopping = false;

  constructor(private readonly options: JobQueueServiceOptions) {
    this.concurrency = Math.min(Math.max(options.concurrency ?? 2, 1), 8);
    this.pollIntervalMs = Math.min(
      Math.max(options.pollIntervalMs ?? 250, 50),
      5_000,
    );
  }

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    this.stopping = false;
    await this.recoverInterrupted();
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    this.timer.unref();
    await this.tick();
  }

  async stop(): Promise<void> {
    this.stopping = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    for (const execution of this.active.values()) {
      execution.desiredState = "paused";
      execution.controller.abort();
    }

    await Promise.allSettled(
      [...this.active.values()].map((execution) => execution.promise),
    );
    await this.options.executor.close();
  }

  async getSnapshot(): Promise<JobQueueSnapshot> {
    const items = await this.options.repository.list();
    const jobs = items.map((item) => item.job);

    return Object.freeze({
      items,
      summary: createSummary(jobs),
      concurrency: this.concurrency,
      workerOnline: this.options.executor.online,
      updatedAt: new Date().toISOString(),
    });
  }

  async enqueueDiagnostic(
    projectId: EntityId<"project">,
  ): Promise<JobActionResult> {
    const project = await this.options.projects.findById(projectId);

    if (!project) {
      throw new JobQueueConflictError("El proyecto seleccionado no existe.");
    }

    if (project.project.status === "archived") {
      throw new JobQueueConflictError(
        "Restaura el proyecto antes de crear trabajos.",
      );
    }

    const job = createJob({
      projectId,
      kind: "diagnostic-worker",
      priority: 90,
      maxAttempts: 2,
      payload: { delayMs: 60, purpose: "worker-thread-check" },
    });

    await this.options.repository.insert(job);
    void this.tick();

    return {
      job,
      snapshot: await this.getSnapshot(),
    };
  }

  async pause(jobId: EntityId<"job">): Promise<JobActionResult> {
    const active = this.active.get(jobId);

    if (active) {
      active.desiredState = "paused";
      active.controller.abort();
      await active.promise;
      return this.resultFor(jobId);
    }

    const job = await this.requireJob(jobId);

    if (job.status !== "pending") {
      throw new JobQueueConflictError(
        "Solo se pueden pausar trabajos pendientes o en ejecución.",
      );
    }

    const paused = updateJobState(job, { status: "paused" });
    await this.options.repository.update(paused);
    return { job: paused, snapshot: await this.getSnapshot() };
  }

  async resume(jobId: EntityId<"job">): Promise<JobActionResult> {
    const job = await this.requireJob(jobId);

    if (job.status !== "paused") {
      throw new JobQueueConflictError("El trabajo no está pausado.");
    }

    const resumed = updateJobState(job, { status: "pending" });
    await this.options.repository.update(resumed);
    void this.tick();
    return { job: resumed, snapshot: await this.getSnapshot() };
  }

  async cancel(jobId: EntityId<"job">): Promise<JobActionResult> {
    const active = this.active.get(jobId);

    if (active) {
      active.desiredState = "cancelled";
      active.controller.abort();
      await active.promise;
      return this.resultFor(jobId);
    }

    const job = await this.requireJob(jobId);

    if (!["pending", "paused"].includes(job.status)) {
      throw new JobQueueConflictError(
        "El trabajo ya finalizó y no puede cancelarse.",
      );
    }

    const cancelled = updateJobState(job, { status: "cancelled" });
    await this.options.repository.update(cancelled);
    return { job: cancelled, snapshot: await this.getSnapshot() };
  }

  async retry(jobId: EntityId<"job">): Promise<JobActionResult> {
    const job = await this.requireJob(jobId);

    if (job.status !== "failed") {
      throw new JobQueueConflictError("Solo se pueden reintentar trabajos fallidos.");
    }

    const retried = updateJobState(job, {
      status: "pending",
      attempt: job.attempt >= job.maxAttempts ? 0 : job.attempt,
    });
    await this.options.repository.update(retried);
    void this.tick();
    return { job: retried, snapshot: await this.getSnapshot() };
  }

  private async resultFor(jobId: EntityId<"job">): Promise<JobActionResult> {
    return {
      job: await this.requireJob(jobId),
      snapshot: await this.getSnapshot(),
    };
  }

  private async requireJob(jobId: EntityId<"job">): Promise<JobRecord> {
    const job = await this.options.repository.findById(jobId);

    if (!job) {
      throw new JobNotFoundError(jobId);
    }

    return job;
  }

  private async recoverInterrupted(): Promise<void> {
    const interrupted = await this.options.repository.listByStatuses([
      "preparing",
      "running",
    ]);

    for (const job of interrupted) {
      await this.options.repository.update(recoverInterruptedJob(job));
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.stopping || this.active.size >= this.concurrency) {
      return;
    }

    this.ticking = true;

    try {
      const items = await this.options.repository.list();
      const jobs = items.map((item) => item.job);
      const candidates = jobs.filter(
        (job) =>
          job.status === "pending" &&
          !this.active.has(job.id) &&
          this.options.executor.supports(job.kind) &&
          areJobDependenciesCompleted(job, jobs),
      );

      for (const job of candidates) {
        if (this.active.size >= this.concurrency) {
          break;
        }

        this.launch(job);
      }
    } finally {
      this.ticking = false;
    }
  }

  private launch(job: JobRecord): void {
    const controller = new AbortController();
    const execution: ActiveExecution = {
      controller,
      desiredState: null,
      promise: Promise.resolve(),
    };
    const promise = this.executeJob(job, execution)
      .catch((error) => {
        console.error(`Error ejecutando el trabajo ${job.id}:`, error);
      })
      .finally(() => {
        this.active.delete(job.id);
        if (!this.stopping) {
          void this.tick();
        }
      });

    execution.promise = promise;
    this.active.set(job.id, execution);
  }

  private async executeJob(
    initialJob: JobRecord,
    execution: ActiveExecution,
  ): Promise<void> {
    let current = updateJobState(initialJob, {
      status: "preparing",
      attempt: initialJob.attempt + 1,
    });
    await this.options.repository.update(current);

    current = updateJobState(current, { status: "running", progress: 0 });
    await this.options.repository.update(current);

    try {
      const result = await this.options.executor.execute(
        current,
        async (progress) => {
          if (execution.controller.signal.aborted) {
            return;
          }

          const latest = await this.requireJob(current.id);

          if (latest.status !== "running" || progress <= latest.progress) {
            return;
          }

          current = updateJobState(latest, {
            status: "running",
            progress,
          });
          await this.options.repository.update(current);
        },
        execution.controller.signal,
      );
      const latest = await this.requireJob(current.id);
      const completed = updateJobState(latest, {
        status: "completed",
        progress: 100,
        result: result.result,
      });
      await this.options.repository.update(completed);
    } catch (error) {
      const latest = await this.requireJob(current.id);

      if (error instanceof JobExecutionAbortedError) {
        const target = execution.desiredState ?? "paused";
        const stopped = updateJobState(latest, { status: target });
        await this.options.repository.update(stopped);
        return;
      }

      const info: JobErrorInfo =
        error instanceof JobWorkerError
          ? error.info
          : {
              code: "JOB_EXECUTION_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "El trabajo terminó con un error desconocido.",
              retryable: true,
            };
      const failed = updateJobState(latest, {
        status: "failed",
        error: info,
      });
      await this.options.repository.update(failed);

      if (info.retryable && failed.attempt < failed.maxAttempts && !this.stopping) {
        const pending = updateJobState(failed, { status: "pending" });
        await this.options.repository.update(pending);
      }
    }
  }
}

export {
  JobNotFoundError,
  JobQueueConflictError,
  JobQueueService,
  createSummary,
  type JobQueueServiceOptions,
};
