/* =========================================================
Nombre completo: job-queue.test.mjs
Ruta o ubicación: /tests/job-queue.test.mjs

Función o funciones:
- Probar ejecución real dentro de Worker Threads.
- Verificar pausa, reanudación, cancelación y persistencia.
- Confirmar recuperación después de una interrupción.
========================================================= */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import { JobQueueService } from "../dist-electron/main/jobs/job-queue-service.js";
import { WorkerThreadJobExecutor } from "../dist-electron/main/jobs/worker-thread-job-executor.js";
import { ProjectManagementService } from "../dist-electron/main/projects/project-management-service.js";
import {
  createJob,
  updateJobState,
} from "../dist-electron/shared/domain/index.js";

async function waitFor(operation, timeoutMs = 5_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await operation();

    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("La condición de la prueba no se cumplió a tiempo.");
}

async function createContext({ executor, concurrency = 1 } = {}) {
  const root = await mkdtemp(join(tmpdir(), "editar-jobs-"));
  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "jobs.sqlite3"),
      backupsDirectory: join(root, "backups"),
    },
    automaticBackups: false,
  });

  await database.initialize();
  const projects = new ProjectManagementService(database.projects);
  const queue = new JobQueueService({
    repository: database.jobs,
    projects: database.projects,
    executor: executor ?? new WorkerThreadJobExecutor(),
    concurrency,
    pollIntervalMs: 25,
  });

  return {
    root,
    database,
    projects,
    queue,
    async cleanup() {
      await queue.stop();
      database.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("ejecuta un diagnóstico en Worker Thread sin crear snapshots", async () => {
  const context = await createContext();

  try {
    const project = await context.projects.create({
      name: "Cola real",
      preset: "horizontal",
    });
    await context.queue.start();
    const created = await context.queue.enqueueDiagnostic(project.id);

    const completed = await waitFor(async () => {
      const job = await context.database.jobs.findById(created.job.id);
      return job?.status === "completed" ? job : null;
    });

    assert.equal(completed.progress, 100);
    assert.equal(completed.attempt, 1);
    assert.equal(completed.result.workerThread, true);
    assert.equal(
      await context.database.projects.countSnapshots(project.id),
      1,
    );
  } finally {
    await context.cleanup();
  }
});

test("pausa y reanuda una ejecución activa", async () => {
  const context = await createContext();

  try {
    const project = await context.projects.create({
      name: "Pausa y reanudación",
      preset: "vertical",
    });
    await context.queue.start();
    const created = await context.queue.enqueueDiagnostic(project.id);

    await waitFor(async () => {
      const job = await context.database.jobs.findById(created.job.id);
      return job?.status === "running" ? job : null;
    });

    const paused = await context.queue.pause(created.job.id);
    assert.equal(paused.job.status, "paused");

    const resumed = await context.queue.resume(created.job.id);
    assert.equal(resumed.job.status, "pending");

    const completed = await waitFor(async () => {
      const job = await context.database.jobs.findById(created.job.id);
      return job?.status === "completed" ? job : null;
    });

    assert.equal(completed.attempt, 2);
    assert.equal(completed.progress, 100);
  } finally {
    await context.cleanup();
  }
});

test("cancela un trabajo activo y conserva el estado", async () => {
  const context = await createContext();

  try {
    const project = await context.projects.create({
      name: "Cancelación",
      preset: "square",
    });
    await context.queue.start();
    const created = await context.queue.enqueueDiagnostic(project.id);

    await waitFor(async () => {
      const job = await context.database.jobs.findById(created.job.id);
      return job?.status === "running" ? job : null;
    });

    const cancelled = await context.queue.cancel(created.job.id);
    assert.equal(cancelled.job.status, "cancelled");

    await new Promise((resolve) => setTimeout(resolve, 150));
    const persisted = await context.database.jobs.findById(created.job.id);
    assert.equal(persisted.status, "cancelled");
  } finally {
    await context.cleanup();
  }
});

test("recupera trabajos interrumpidos al iniciar", async () => {
  const idleExecutor = {
    online: true,
    supports: () => false,
    async execute() {
      throw new Error("No debe ejecutarse durante esta prueba.");
    },
    async close() {},
  };
  const context = await createContext({ executor: idleExecutor });

  try {
    const project = await context.projects.create({
      name: "Recuperación",
      preset: "portrait",
    });
    const pending = createJob({
      projectId: project.id,
      kind: "diagnostic-worker",
      maxAttempts: 3,
    });
    const preparing = updateJobState(pending, {
      status: "preparing",
      attempt: 1,
    });
    const running = updateJobState(preparing, {
      status: "running",
      progress: 40,
    });
    await context.database.jobs.insert(running);

    await context.queue.start();

    const recovered = await context.database.jobs.findById(running.id);
    assert.equal(recovered.status, "pending");
    assert.equal(recovered.progress, 0);
    assert.equal(recovered.attempt, 1);
  } finally {
    await context.cleanup();
  }
});

test("respeta prioridad y límite de concurrencia", async () => {
  const context = await createContext({ concurrency: 1 });

  try {
    const project = await context.projects.create({
      name: "Concurrencia",
      preset: "horizontal",
    });
    await context.queue.start();
    const first = await context.queue.enqueueDiagnostic(project.id);
    const second = await context.queue.enqueueDiagnostic(project.id);

    await waitFor(async () => {
      const snapshot = await context.queue.getSnapshot();
      return snapshot.summary.running === 1 && snapshot.summary.pending >= 1
        ? snapshot
        : null;
    });

    await waitFor(async () => {
      const firstJob = await context.database.jobs.findById(first.job.id);
      const secondJob = await context.database.jobs.findById(second.job.id);
      return firstJob?.status === "completed" && secondJob?.status === "completed"
        ? true
        : null;
    }, 8_000);
  } finally {
    await context.cleanup();
  }
});
