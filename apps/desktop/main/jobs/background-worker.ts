/* =========================================================
Nombre completo: background-worker.ts
Ruta o ubicación: /apps/desktop/main/jobs/background-worker.ts

Función o funciones:
- Ejecutar tareas compatibles dentro de un Worker Thread.
- Ejecutar FFprobe sin shell y con límites de salida y tiempo.
- Reportar progreso, cancelación, resultados y errores controlados.
========================================================= */

import { spawn, type ChildProcess } from "node:child_process";
import { parentPort, workerData } from "node:worker_threads";
import type {
  JobErrorInfo,
  JobRecord,
  JsonValue,
  MediaKind,
} from "../../shared/domain/index.js";
import {
  FfprobeParseError,
  parseFfprobeMetadata,
} from "../media/ffprobe-parser.js";

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

class WorkerTaskError extends Error {
  constructor(readonly info: JobErrorInfo) {
    super(info.message);
    this.name = "WorkerTaskError";
  }
}

class WorkerAbortError extends Error {
  constructor() {
    super("La ejecución fue cancelada.");
    this.name = "WorkerAbortError";
  }
}

const MAX_STDOUT_BYTES = 8 * 1024 * 1024;
const MAX_STDERR_BYTES = 1024 * 1024;
const PROBE_TIMEOUT_MS = 60_000;
let activeChild: ChildProcess | null = null;
let abortRequested = false;

function send(message: WorkerMessage): void {
  parentPort?.postMessage(message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requirePayloadString(job: JobRecord, key: string): string {
  const value = job.payload[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: `El trabajo no contiene ${key} con un formato válido.`,
      retryable: false,
    });
  }

  return value;
}

function parseArgumentsPrefix(job: JobRecord): readonly string[] {
  const value = job.payload.ffprobeArgumentsPrefix;

  if (value === undefined) {
    return Object.freeze([]);
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new WorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: "Los argumentos previos de FFprobe no son válidos.",
      retryable: false,
    });
  }

  return Object.freeze([...value]);
}

function classifyProbeError(stderr: string): JobErrorInfo {
  const normalized = stderr.toLocaleLowerCase();

  if (
    normalized.includes("no such file") ||
    normalized.includes("could not find") ||
    normalized.includes("cannot find")
  ) {
    return {
      code: "SOURCE_FILE_UNAVAILABLE",
      message: "El archivo original ya no está disponible en la ruta registrada.",
      retryable: false,
    };
  }

  if (
    normalized.includes("invalid data") ||
    normalized.includes("could not find codec parameters")
  ) {
    return {
      code: "FFPROBE_INVALID_MEDIA",
      message: "FFprobe no pudo reconocer una estructura multimedia válida.",
      retryable: false,
    };
  }

  return {
    code: "FFPROBE_EXECUTION_ERROR",
    message: stderr.trim().slice(0, 800) || "FFprobe terminó con un error.",
    retryable: true,
  };
}

function executeFfprobe(
  command: string,
  argumentsPrefix: readonly string[],
  sourcePath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      [
        ...argumentsPrefix,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-show_error",
        sourcePath,
      ],
      {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          AV_LOG_FORCE_NOCOLOR: "1",
        },
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;

    activeChild = child;

    const finish = (operation: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      activeChild = null;
      operation();
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(() =>
        reject(
          new WorkerTaskError({
            code: "FFPROBE_TIMEOUT",
            message: "FFprobe superó el tiempo máximo de análisis.",
            retryable: true,
          }),
        ),
      );
    }, PROBE_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;

      if (Buffer.byteLength(stdout, "utf8") > MAX_STDOUT_BYTES) {
        child.kill();
        finish(() =>
          reject(
            new WorkerTaskError({
              code: "FFPROBE_OUTPUT_LIMIT",
              message: "FFprobe devolvió una respuesta demasiado grande.",
              retryable: false,
            }),
          ),
        );
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr, "utf8") < MAX_STDERR_BYTES) {
        stderr += chunk;
      }
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          new WorkerTaskError({
            code: error.code === "ENOENT" ? "FFPROBE_UNAVAILABLE" : "FFPROBE_START_ERROR",
            message:
              error.code === "ENOENT"
                ? "El ejecutable de FFprobe ya no está disponible."
                : error.message,
            retryable: false,
          }),
        ),
      );
    });
    child.once("close", (code) => {
      if (abortRequested) {
        finish(() => reject(new WorkerAbortError()));
        return;
      }

      if (code !== 0) {
        finish(() => reject(new WorkerTaskError(classifyProbeError(stderr))));
        return;
      }

      finish(() => resolve(stdout));
    });
  });
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
    if (abortRequested) {
      throw new WorkerAbortError();
    }

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

async function runProbeMedia(job: JobRecord): Promise<void> {
  const mediaId = requirePayloadString(job, "mediaId");
  const sourcePath = requirePayloadString(job, "sourcePath");
  const ffprobeCommand = requirePayloadString(job, "ffprobeCommand");
  const expectedKind = requirePayloadString(job, "expectedKind") as MediaKind;
  const ffprobeVersion = requirePayloadString(job, "ffprobeVersion");
  const argumentsPrefix = parseArgumentsPrefix(job);

  if (!["video", "audio", "image"].includes(expectedKind)) {
    throw new WorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: "El tipo esperado del medio no está permitido.",
      retryable: false,
    });
  }

  send({ type: "progress", progress: 10 });
  const output = await executeFfprobe(
    ffprobeCommand,
    argumentsPrefix,
    sourcePath,
  );
  send({ type: "progress", progress: 75 });

  let metadata;

  try {
    metadata = parseFfprobeMetadata(output, expectedKind);
  } catch (error) {
    if (error instanceof FfprobeParseError) {
      throw new WorkerTaskError({
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }

    throw error;
  }

  send({ type: "progress", progress: 95 });
  send({
    type: "completed",
    result: {
      mediaId,
      metadata,
      inspectedAt: new Date().toISOString(),
      ffprobeVersion,
    },
  });
}

async function main(): Promise<void> {
  const input = workerData as WorkerInput;

  switch (input.job.kind) {
    case "diagnostic-worker":
      await runDiagnostic(input.job);
      return;
    case "probe-media":
      await runProbeMedia(input.job);
      return;
    default:
      throw new WorkerTaskError({
        code: "UNSUPPORTED_JOB_KIND",
        message: `El trabajador todavía no admite ${input.job.kind}.`,
        retryable: false,
      });
  }
}

parentPort?.on("message", (message: WorkerCommand) => {
  if (message?.type !== "abort") {
    return;
  }

  abortRequested = true;
  activeChild?.kill();
});

void main().catch((error: unknown) => {
  if (error instanceof WorkerAbortError || abortRequested) {
    send({ type: "aborted" });
    return;
  }

  send({
    type: "failed",
    error:
      error instanceof WorkerTaskError
        ? error.info
        : {
            code: "WORKER_EXECUTION_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "El trabajador terminó con un error desconocido.",
            retryable: true,
          },
  });
});
