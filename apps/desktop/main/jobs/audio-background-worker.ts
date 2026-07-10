/* =========================================================
Nombre completo: audio-background-worker.ts
Ruta o ubicación: /apps/desktop/main/jobs/audio-background-worker.ts

Función o funciones:
- Ejecutar análisis y reducción de silencios en un Worker dedicado.
- Coordinar cancelación del proceso hijo FFmpeg.
- Traducir resultados y errores al protocolo de la cola.
========================================================= */

import type { ChildProcess } from "node:child_process";
import { parentPort, workerData } from "node:worker_threads";
import type {
  JobErrorInfo,
  JobRecord,
  JsonValue,
} from "../../shared/domain/index.js";
import {
  AudioWorkerAbortError,
  AudioWorkerTaskError,
  runDetectSilenceJob,
  runReduceSilenceJob,
} from "./audio-worker-tasks.js";

interface WorkerInput {
  readonly job: JobRecord;
}

type WorkerCommand = { readonly type: "abort" };

type WorkerMessage =
  | { readonly type: "progress"; readonly progress: number }
  | {
      readonly type: "completed";
      readonly result?: Readonly<Record<string, JsonValue>>;
    }
  | { readonly type: "failed"; readonly error: JobErrorInfo }
  | { readonly type: "aborted" };

let activeChild: ChildProcess | null = null;
let abortRequested = false;

function send(message: WorkerMessage): void {
  parentPort?.postMessage(message);
}

async function main(): Promise<void> {
  const input = workerData as WorkerInput;
  const hooks = {
    isAborted: () => abortRequested,
    setActiveChild: (child: ChildProcess | null) => {
      activeChild = child;
    },
    reportProgress: (progress: number) => {
      send({ type: "progress", progress });
    },
  };
  let result: Readonly<Record<string, JsonValue>>;

  switch (input.job.kind) {
    case "detect-silence":
      result = await runDetectSilenceJob(input.job, hooks);
      break;
    case "reduce-silence":
      result = await runReduceSilenceJob(input.job, hooks);
      break;
    default:
      throw new AudioWorkerTaskError({
        code: "UNSUPPORTED_JOB_KIND",
        message: `El trabajador de audio no admite ${input.job.kind}.`,
        retryable: false,
      });
  }

  send({ type: "completed", result });
}

parentPort?.on("message", (message: WorkerCommand) => {
  if (message?.type !== "abort") {
    return;
  }

  abortRequested = true;
  activeChild?.kill();
});

void main().catch((error: unknown) => {
  if (error instanceof AudioWorkerAbortError || abortRequested) {
    send({ type: "aborted" });
    return;
  }

  send({
    type: "failed",
    error:
      error instanceof AudioWorkerTaskError
        ? error.info
        : {
            code: "AUDIO_WORKER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "El trabajador de audio terminó con un error desconocido.",
            retryable: true,
          },
  });
});
