/* =========================================================
Nombre completo: worker-thread-job-executor.ts
Ruta o ubicación: /apps/desktop/main/jobs/worker-thread-job-executor.ts

Función o funciones:
- Ejecutar trabajos compatibles dentro de Worker Threads.
- Traducir progreso, resultados, errores y cancelaciones.
- Cerrar trabajadores activos al terminar la aplicación.
========================================================= */

import { Worker } from "node:worker_threads";
import type {
  JobErrorInfo,
  JobKind,
  JobRecord,
  JsonValue,
} from "../../shared/domain/index.js";
import type {
  JobExecutionResult,
  JobExecutor,
  JobProgressReporter,
} from "./job-executor.js";

type WorkerMessage =
  | { readonly type: "progress"; readonly progress: number }
  | {
      readonly type: "completed";
      readonly result?: Readonly<Record<string, JsonValue>>;
    }
  | { readonly type: "failed"; readonly error: JobErrorInfo };

class JobWorkerError extends Error {
  constructor(readonly info: JobErrorInfo) {
    super(info.message);
    this.name = "JobWorkerError";
  }
}

class JobExecutionAbortedError extends Error {
  constructor() {
    super("La ejecución fue detenida.");
    this.name = "JobExecutionAbortedError";
  }
}

class WorkerThreadJobExecutor implements JobExecutor {
  private readonly activeWorkers = new Set<Worker>();
  private closed = false;

  get online(): boolean {
    return !this.closed;
  }

  supports(kind: JobKind): boolean {
    return kind === "diagnostic-worker";
  }

  execute(
    job: JobRecord,
    reportProgress: JobProgressReporter,
    signal: AbortSignal,
  ): Promise<JobExecutionResult> {
    if (this.closed) {
      return Promise.reject(new Error("El ejecutor de trabajos está cerrado."));
    }

    if (!this.supports(job.kind)) {
      return Promise.reject(
        new JobWorkerError({
          code: "UNSUPPORTED_JOB_KIND",
          message: `No existe un trabajador registrado para ${job.kind}.`,
          retryable: false,
        }),
      );
    }

    return new Promise<JobExecutionResult>((resolve, reject) => {
      const worker = new Worker(new URL("./background-worker.js", import.meta.url), {
        workerData: { job },
      });
      let settled = false;

      this.activeWorkers.add(worker);

      const cleanup = (): void => {
        signal.removeEventListener("abort", abort);
        this.activeWorkers.delete(worker);
      };

      const finish = (
        operation: () => void,
      ): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        operation();
      };

      const abort = (): void => {
        void worker.terminate().finally(() => {
          finish(() => reject(new JobExecutionAbortedError()));
        });
      };

      if (signal.aborted) {
        abort();
        return;
      }

      signal.addEventListener("abort", abort, { once: true });

      worker.on("message", (message: WorkerMessage) => {
        if (message.type === "progress") {
          void reportProgress(message.progress);
          return;
        }

        if (message.type === "completed") {
          finish(() => resolve({ result: message.result }));
          void worker.terminate();
          return;
        }

        finish(() => reject(new JobWorkerError(message.error)));
        void worker.terminate();
      });

      worker.once("error", (error) => {
        finish(() =>
          reject(
            new JobWorkerError({
              code: "WORKER_THREAD_ERROR",
              message: error.message,
              retryable: true,
            }),
          ),
        );
      });

      worker.once("exit", (code) => {
        if (!settled && code !== 0) {
          finish(() =>
            reject(
              new JobWorkerError({
                code: "WORKER_UNEXPECTED_EXIT",
                message: `El trabajador terminó inesperadamente con código ${code}.`,
                retryable: true,
              }),
            ),
          );
        }
      });
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    const workers = [...this.activeWorkers];
    this.activeWorkers.clear();
    await Promise.allSettled(workers.map((worker) => worker.terminate()));
  }
}

export {
  JobExecutionAbortedError,
  JobWorkerError,
  WorkerThreadJobExecutor,
};
