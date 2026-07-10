/* =========================================================
Nombre completo: background-worker.ts
Ruta o ubicación: /apps/desktop/main/jobs/background-worker.ts

Función o funciones:
- Ejecutar diagnósticos, FFprobe y FFmpeg dentro de Worker Threads.
- Generar proxies, miniaturas y formas de onda con escritura atómica.
- Reportar progreso, cancelación, resultados y errores controlados.
========================================================= */

import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import type {
  JobErrorInfo,
  JobRecord,
  JsonValue,
  MediaKind,
} from "../../shared/domain/index.js";
import type { GeneratedDerivativeType } from "../../shared/media-cache-contracts.js";
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
const FFMPEG_PROXY_TIMEOUT_MS = 2 * 60 * 60 * 1_000;
const FFMPEG_IMAGE_TIMEOUT_MS = 5 * 60 * 1_000;
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

function payloadNumber(job: JobRecord, key: string, fallback = 0): number {
  const value = job.payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseStringArray(job: JobRecord, key: string): readonly string[] {
  const value = job.payload[key];

  if (value === undefined) {
    return Object.freeze([]);
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new WorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: `El trabajo contiene ${key} con un formato inválido.`,
      retryable: false,
    });
  }

  return Object.freeze([...value]);
}

function cappedAppend(current: string, chunk: string, maxBytes: number): string {
  if (Buffer.byteLength(current, "utf8") >= maxBytes) {
    return current;
  }

  return `${current}${chunk}`.slice(0, maxBytes);
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

function classifyFfmpegError(stderr: string): JobErrorInfo {
  const normalized = stderr.toLocaleLowerCase();

  if (
    normalized.includes("no such file") ||
    normalized.includes("cannot find") ||
    normalized.includes("does not exist")
  ) {
    return {
      code: "SOURCE_FILE_UNAVAILABLE",
      message: "El archivo original ya no está disponible en la ruta registrada.",
      retryable: false,
    };
  }

  if (
    normalized.includes("unknown encoder") ||
    normalized.includes("encoder not found")
  ) {
    return {
      code: "FFMPEG_ENCODER_UNAVAILABLE",
      message: "La instalación de FFmpeg no incluye el codificador necesario para este derivado.",
      retryable: false,
    };
  }

  if (
    normalized.includes("matches no streams") ||
    normalized.includes("stream map") ||
    normalized.includes("does not contain any stream")
  ) {
    return {
      code: "FFMPEG_STREAM_UNAVAILABLE",
      message: "El medio no contiene el stream necesario para generar este derivado.",
      retryable: false,
    };
  }

  return {
    code: "FFMPEG_EXECUTION_ERROR",
    message: stderr.trim().slice(0, 1_200) || "FFmpeg terminó con un error.",
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
      stdout = cappedAppend(stdout, chunk, MAX_STDOUT_BYTES);

      if (Buffer.byteLength(stdout, "utf8") >= MAX_STDOUT_BYTES) {
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
      stderr = cappedAppend(stderr, chunk, MAX_STDERR_BYTES);
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

function progressFromLine(line: string, durationUs: number): number | null {
  if (durationUs <= 0) {
    return null;
  }

  const separator = line.indexOf("=");

  if (separator <= 0) {
    return null;
  }

  const key = line.slice(0, separator);
  const raw = line.slice(separator + 1);

  if (key !== "out_time_us" && key !== "out_time_ms") {
    return null;
  }

  const outTimeUs = Number.parseInt(raw, 10);

  if (!Number.isFinite(outTimeUs) || outTimeUs < 0) {
    return null;
  }

  return Math.min(92, Math.max(8, 8 + (outTimeUs / durationUs) * 84));
}

async function executeFfmpeg(
  command: string,
  argumentsPrefix: readonly string[],
  operationArguments: readonly string[],
  temporaryPath: string,
  outputPath: string,
  durationUs: number,
  timeoutMs: number,
): Promise<void> {
  await mkdir(dirname(temporaryPath), { recursive: true });
  await rm(temporaryPath, { force: true });

  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      [
        ...argumentsPrefix,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-nostats",
        ...operationArguments,
        temporaryPath,
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
    let progressBuffer = "";
    let stderr = "";
    let settled = false;

    activeChild = child;

    const cleanup = async (): Promise<void> => {
      activeChild = null;
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    };

    const finishReject = async (error: unknown): Promise<void> => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      await cleanup();
      reject(error);
    };

    const finishSuccess = async (): Promise<void> => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      activeChild = null;

      try {
        const information = await stat(temporaryPath);

        if (!information.isFile() || information.size <= 0) {
          throw new WorkerTaskError({
            code: "FFMPEG_EMPTY_OUTPUT",
            message: "FFmpeg terminó sin producir un archivo utilizable.",
            retryable: true,
          });
        }

        await rm(outputPath, { force: true });
        await rename(temporaryPath, outputPath);
        resolve();
      } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
        reject(error);
      }
    };

    const timer = setTimeout(() => {
      child.kill();
      void finishReject(
        new WorkerTaskError({
          code: "FFMPEG_TIMEOUT",
          message: "FFmpeg superó el tiempo máximo permitido para esta operación.",
          retryable: true,
        }),
      );
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      progressBuffer += chunk;
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const progress = progressFromLine(line.trim(), durationUs);

        if (progress !== null) {
          send({ type: "progress", progress });
        }
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr = cappedAppend(stderr, chunk, MAX_STDERR_BYTES);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      void finishReject(
        new WorkerTaskError({
          code: error.code === "ENOENT" ? "FFMPEG_UNAVAILABLE" : "FFMPEG_START_ERROR",
          message:
            error.code === "ENOENT"
              ? "El ejecutable de FFmpeg ya no está disponible."
              : error.message,
          retryable: false,
        }),
      );
    });
    child.once("close", (code) => {
      if (abortRequested) {
        void finishReject(new WorkerAbortError());
        return;
      }

      if (code !== 0) {
        void finishReject(new WorkerTaskError(classifyFfmpegError(stderr)));
        return;
      }

      void finishSuccess();
    });
  });
}

function proxyArguments(sourcePath: string): readonly string[] {
  return Object.freeze([
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-vf",
    "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
  ]);
}

function thumbnailArguments(
  sourcePath: string,
  expectedKind: MediaKind,
  seekUs: number,
): readonly string[] {
  const seek = expectedKind === "video" && seekUs > 0
    ? ["-ss", (seekUs / 1_000_000).toFixed(3)]
    : [];

  return Object.freeze([
    ...seek,
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-q:v",
    "3",
  ]);
}

function waveformArguments(sourcePath: string): readonly string[] {
  return Object.freeze([
    "-i",
    sourcePath,
    "-filter_complex",
    "aformat=channel_layouts=mono,showwavespic=s=1200x240:colors=0x5B53D6",
    "-frames:v",
    "1",
  ]);
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
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
  const argumentsPrefix = parseStringArray(job, "ffprobeArgumentsPrefix");

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

  const serializableMetadata = JSON.parse(JSON.stringify(metadata)) as JsonValue;

  send({ type: "progress", progress: 95 });
  send({
    type: "completed",
    result: {
      mediaId,
      metadata: serializableMetadata,
      inspectedAt: new Date().toISOString(),
      ffprobeVersion,
    },
  });
}

async function runDerivative(job: JobRecord): Promise<void> {
  const mediaId = requirePayloadString(job, "mediaId");
  const derivativeId = requirePayloadString(job, "derivativeId");
  const derivativeType = requirePayloadString(
    job,
    "derivativeType",
  ) as GeneratedDerivativeType;
  const sourcePath = requirePayloadString(job, "sourcePath");
  const outputPath = requirePayloadString(job, "outputPath");
  const temporaryPath = requirePayloadString(job, "temporaryPath");
  const cacheKey = requirePayloadString(job, "cacheKey");
  const ffmpegCommand = requirePayloadString(job, "ffmpegCommand");
  const ffmpegVersion = requirePayloadString(job, "ffmpegVersion");
  const expectedKind = requirePayloadString(job, "expectedKind") as MediaKind;
  const argumentsPrefix = parseStringArray(job, "ffmpegArgumentsPrefix");
  const durationUs = Math.max(0, payloadNumber(job, "durationUs"));
  const seekUs = Math.max(0, payloadNumber(job, "thumbnailSeekUs"));

  if (!["proxy", "thumbnail", "waveform"].includes(derivativeType)) {
    throw new WorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: "El tipo de derivado solicitado no está permitido.",
      retryable: false,
    });
  }

  let operationArguments: readonly string[];
  let timeoutMs: number;

  switch (derivativeType) {
    case "proxy":
      operationArguments = proxyArguments(sourcePath);
      timeoutMs = FFMPEG_PROXY_TIMEOUT_MS;
      break;
    case "thumbnail":
      operationArguments = thumbnailArguments(sourcePath, expectedKind, seekUs);
      timeoutMs = FFMPEG_IMAGE_TIMEOUT_MS;
      break;
    case "waveform":
      operationArguments = waveformArguments(sourcePath);
      timeoutMs = FFMPEG_IMAGE_TIMEOUT_MS;
      break;
  }

  send({ type: "progress", progress: 5 });
  await executeFfmpeg(
    ffmpegCommand,
    argumentsPrefix,
    operationArguments,
    temporaryPath,
    outputPath,
    durationUs,
    timeoutMs,
  );
  send({ type: "progress", progress: 95 });

  const [information, checksum] = await Promise.all([
    stat(outputPath),
    sha256File(outputPath),
  ]);

  send({
    type: "completed",
    result: {
      mediaId,
      outputSizeBytes: information.size,
      checksum,
      ffmpegVersion,
      derivative: {
        id: derivativeId,
        type: derivativeType,
        path: outputPath,
        cacheKey,
        createdAt: new Date().toISOString(),
      },
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
    case "generate-proxy":
    case "generate-waveform":
    case "generate-thumbnails":
      await runDerivative(input.job);
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
