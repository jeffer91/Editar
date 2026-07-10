/* =========================================================
Nombre completo: background-worker.ts
Ruta o ubicación: /apps/desktop/main/jobs/background-worker.ts

Función o funciones:
- Ejecutar tareas compatibles dentro de un Worker Thread.
- Reportar progreso sin bloquear Electron ni React.
- Servir como punto de extensión para FFmpeg y otros motores.
========================================================= */

import { parentPort, workerData } from "node:worker_threads";
import type { JobRecord, JsonValue } from "../../shared/domain/index.js";

interface WorkerInput {
  readonly job: JobRecord;
}

type WorkerMessage =
  | { readonly type: "progress"; readonly progress: number }
  | {
      readonly type: "completed";
      readonly result?: Readonly<Record<string, JsonValue>>;
    }
  | {
      readonly type: "failed";
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly retryable: boolean;
      };
    };

function send(message: WorkerMessage): void {
  parentPort?.postMessage(message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runDiagnostic(job: JobRecord): Promise<void> {
  const steps = 10;
  const delayMsRaw = job.payload.delayMs;
  const delayMs =
    typeof delayMsRaw === "number" && Number.isFinite(delayMsRaw)
      ? Math.min(Math.max(Math.trunc(delayMsRaw), 10), 1_000)
      : 60;
  let checksum = 0;

  for (let step = 1; step <= steps; step += 1) {
    for (let index = 0; index < 40_000; index += 1) {
      checksum = (checksum + index * step) % 1_000_003;
    }

    await delay(delayMs);
    send({ type: "progress", progress: step * 10 });
  }

  send({
    type: "completed",
    result: {
      workerThread: true,
      checksum,
      steps,
      completedAt: new Date().toISOString(),
    },
  });
}

async function main(): Promise<void> {
  const input = workerData as WorkerInput;

  switch (input.job.kind) {
    case "diagnostic-worker":
      await runDiagnostic(input.job);
      return;
    default:
      send({
        type: "failed",
        error: {
          code: "UNSUPPORTED_JOB_KIND",
          message: `El trabajador todavía no admite ${input.job.kind}.`,
          retryable: false,
        },
      });
  }
}

void main().catch((error: unknown) => {
  send({
    type: "failed",
    error: {
      code: "WORKER_EXECUTION_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "El trabajador terminó con un error desconocido.",
      retryable: true,
    },
  });
});
