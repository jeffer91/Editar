/* =========================================================
Nombre completo: worker-thread-job-executor.ts
Ruta o ubicación: /apps/desktop/main/jobs/worker-thread-job-executor.ts

Función o funciones:
- Ejecutar diagnósticos, FFprobe y FFmpeg dentro de Worker Threads.
- Traducir progreso, resultados, errores y cancelaciones.
- Solicitar una detención cooperativa antes de terminar el Worker.
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
  | { readonly type: "failed"; readonly error: JobErrorInfo }
  | { readonly type: "aborted" };

const SUPPORTED_JOB_KINDS: readonly JobKind[] = Object.freeze([
  "diagnostic-worker",
  "probe-media",
  "generate-proxy",
  "generate-waveform",
  "generate-thumbnails",
]);

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
    return SUPPORTED_JOB_KINDS.includes(kind);
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
      let abortRequested = false;
      let abortTimer: NodeJS.Timeout | null = null;

      this.activeWorkers.add(worker);

      const cleanup = (): void => {
        signal.removeEventListener("abort", abort);
        this.activeWorkers.delete(worker);

        if (abortTimer) {
          clearTimeout(abortTimer);
          abortTimer = null;
        }
      };

      const finish = (operation: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        operation();
      };

      const terminateAfterFinish = (): void => {
        void worker.terminate().catch(() => undefined);
      };

      const abort = (): void => {
        if (abortRequested || settled) {
          return;
        }

        abortRequested = true;
        worker.postMessage({ type: "abort" });
        abortTimer = setTimeout(() => {
          void worker.terminate().finally(() => {
            finish(() => reject(new JobExecutionAbortedError()));
          });
        }, 2_500);
      };

      if (signal.aborted) {
        abort();
      } else {
        signal.addEventListener("abort", abort, { once: true });
      }

      worker.on("message", (message: WorkerMessage) => {
        if (message.type === "progress") {
          void reportProgress(message.progress);
          return;
        }

        if (message.type === "aborted") {
          finish(() => reject(new JobExecutionAbortedError()));
          terminateAfterFinish();
          return;
        }

        if (message.type === "completed") {
          finish(() => resolve({ result: message.result }));
          terminateAfterFinish();
          return;
        }

        finish(() => reject(new JobWorkerError(message.error)));
        terminateAfterFinish();
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
        if (settled) {
          return;
        }

        if (abortRequested) {
          finish(() => reject(new JobExecutionAbortedError()));
          return;
        }

        finish(() =>
          reject(
            new JobWorkerError({
              code: "WORKER_UNEXPECTED_EXIT",
              message: `El trabajador terminó inesperadamente con código ${code}.`,
              retryable: true,
            }),
          ),
        );
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
  SUPPORTED_JOB_KINDS,
  WorkerThreadJobExecutor,
};
