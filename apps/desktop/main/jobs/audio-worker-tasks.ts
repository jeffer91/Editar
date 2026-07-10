/* =========================================================
Nombre completo: audio-worker-tasks.ts
Ruta o ubicación: /apps/desktop/main/jobs/audio-worker-tasks.ts

Función o funciones:
- Ejecutar silencedetect con progreso y límites de salida.
- Generar versiones con silencios eliminados o acortados.
- Escribir filtros y salidas temporales antes del reemplazo final.
========================================================= */

import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import {
  validateSilenceReductionPlan,
  type JobErrorInfo,
  type JobRecord,
  type JsonValue,
  type MediaKind,
  type SilenceKeepRange,
  type SilenceReductionPlan,
} from "../../shared/domain/index.js";
import { parseSilenceDetection } from "../media/silence-detect-parser.js";

interface AudioWorkerHooks {
  readonly isAborted: () => boolean;
  readonly setActiveChild: (child: ChildProcess | null) => void;
  readonly reportProgress: (progress: number) => void;
}

class AudioWorkerTaskError extends Error {
  constructor(readonly info: JobErrorInfo) {
    super(info.message);
    this.name = "AudioWorkerTaskError";
  }
}

class AudioWorkerAbortError extends Error {
  constructor() {
    super("La tarea de audio fue cancelada.");
    this.name = "AudioWorkerAbortError";
  }
}

const MAX_ANALYSIS_LOG_BYTES = 16 * 1024 * 1024;
const MAX_ERROR_BYTES = 1024 * 1024;
const AUDIO_TASK_TIMEOUT_MS = 2 * 60 * 60 * 1_000;

function requiredString(job: JobRecord, key: string): string {
  const value = job.payload[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AudioWorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: `El trabajo no contiene ${key} con un formato válido.`,
      retryable: false,
    });
  }

  return value;
}

function requiredNumber(job: JobRecord, key: string): number {
  const value = job.payload[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AudioWorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: `El trabajo no contiene ${key} con un formato válido.`,
      retryable: false,
    });
  }

  return value;
}

function stringArray(job: JobRecord, key: string): readonly string[] {
  const value = job.payload[key];

  if (value === undefined) {
    return Object.freeze([]);
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new AudioWorkerTaskError({
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

function progressFromLine(line: string, durationUs: number): number | null {
  if (durationUs <= 0) {
    return null;
  }

  const separator = line.indexOf("=");

  if (separator <= 0) {
    return null;
  }

  const key = line.slice(0, separator);
  const value = Number.parseInt(line.slice(separator + 1), 10);

  if (
    (key !== "out_time_us" && key !== "out_time_ms") ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return Math.min(93, Math.max(5, 5 + (value / durationUs) * 88));
}

function classifyAudioError(stderr: string): JobErrorInfo {
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
    normalized.includes("matches no streams") ||
    normalized.includes("does not contain any stream") ||
    normalized.includes("stream specifier")
  ) {
    return {
      code: "AUDIO_STREAM_UNAVAILABLE",
      message: "FFmpeg no encontró un stream de audio utilizable.",
      retryable: false,
    };
  }

  if (normalized.includes("unknown encoder") || normalized.includes("encoder not found")) {
    return {
      code: "FFMPEG_ENCODER_UNAVAILABLE",
      message: "La instalación de FFmpeg no incluye el codificador requerido.",
      retryable: false,
    };
  }

  return {
    code: "AUDIO_PROCESSING_ERROR",
    message: stderr.trim().slice(0, 1_200) || "FFmpeg terminó con un error de audio.",
    retryable: true,
  };
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

function executeAnalysis(
  command: string,
  prefix: readonly string[],
  sourcePath: string,
  durationUs: number,
  thresholdDb: number,
  minSilenceUs: number,
  hooks: AudioWorkerHooks,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      [
        ...prefix,
        "-nostdin",
        "-hide_banner",
        "-progress",
        "pipe:1",
        "-nostats",
        "-i",
        sourcePath,
        "-vn",
        "-af",
        `silencedetect=noise=${thresholdDb}dB:d=${(minSilenceUs / 1_000_000).toFixed(6)}`,
        "-f",
        "null",
        "-",
      ],
      {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, AV_LOG_FORCE_NOCOLOR: "1" },
      },
    );
    let progressBuffer = "";
    let stderr = "";
    let settled = false;

    hooks.setActiveChild(child);

    const finish = (operation: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      hooks.setActiveChild(null);
      operation();
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(() =>
        reject(
          new AudioWorkerTaskError({
            code: "SILENCE_ANALYSIS_TIMEOUT",
            message: "La detección de silencios superó el tiempo máximo permitido.",
            retryable: true,
          }),
        ),
      );
    }, AUDIO_TASK_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      progressBuffer += chunk;
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const progress = progressFromLine(line.trim(), durationUs);
        if (progress !== null) {
          hooks.reportProgress(progress);
        }
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr = cappedAppend(stderr, chunk, MAX_ANALYSIS_LOG_BYTES);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          new AudioWorkerTaskError({
            code: error.code === "ENOENT" ? "FFMPEG_UNAVAILABLE" : "FFMPEG_START_ERROR",
            message:
              error.code === "ENOENT"
                ? "El ejecutable de FFmpeg ya no está disponible."
                : error.message,
            retryable: false,
          }),
        ),
      );
    });
    child.once("close", (code) => {
      if (hooks.isAborted()) {
        finish(() => reject(new AudioWorkerAbortError()));
        return;
      }

      if (code !== 0) {
        finish(() => reject(new AudioWorkerTaskError(classifyAudioError(stderr))));
        return;
      }

      finish(() => resolve(stderr));
    });
  });
}

function seconds(valueUs: number): string {
  return (valueUs / 1_000_000).toFixed(6);
}

function buildReductionFilter(
  kind: MediaKind,
  ranges: readonly SilenceKeepRange[],
): string {
  const parts: string[] = [];
  const labels: string[] = [];

  ranges.forEach((range, index) => {
    const start = seconds(range.sourceStartUs);
    const end = seconds(range.sourceEndUs);

    if (kind === "video") {
      parts.push(
        `[0:v:0]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${index}]`,
        `[0:a:0]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${index}]`,
      );
      labels.push(`[v${index}][a${index}]`);
    } else {
      parts.push(
        `[0:a:0]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${index}]`,
      );
      labels.push(`[a${index}]`);
    }
  });

  parts.push(
    kind === "video"
      ? `${labels.join("")}concat=n=${ranges.length}:v=1:a=1[vout][aout]`
      : `${labels.join("")}concat=n=${ranges.length}:v=0:a=1[aout]`,
  );

  return `${parts.join(";\n")}\n`;
}

async function executeReduction(
  job: JobRecord,
  plan: SilenceReductionPlan,
  hooks: AudioWorkerHooks,
): Promise<void> {
  const command = requiredString(job, "ffmpegCommand");
  const prefix = stringArray(job, "ffmpegArgumentsPrefix");
  const sourcePath = requiredString(job, "sourcePath");
  const outputPath = requiredString(job, "outputPath");
  const temporaryPath = requiredString(job, "temporaryPath");
  const filterScriptPath = requiredString(job, "filterScriptPath");
  const expectedKind = requiredString(job, "expectedKind") as MediaKind;

  if (expectedKind !== "video" && expectedKind !== "audio") {
    throw new AudioWorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: "Solo se pueden reducir silencios en videos o audios.",
      retryable: false,
    });
  }

  await mkdir(dirname(temporaryPath), { recursive: true });
  await rm(temporaryPath, { force: true });
  await rm(filterScriptPath, { force: true });
  await writeFile(
    filterScriptPath,
    buildReductionFilter(expectedKind, plan.keepRanges),
    "utf8",
  );

  return new Promise((resolve, reject) => {
    const outputArguments =
      expectedKind === "video"
        ? [
            "-map",
            "[vout]",
            "-map",
            "[aout]",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "22",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-movflags",
            "+faststart",
          ]
        : ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"];
    const child = spawn(
      command,
      [
        ...prefix,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-nostats",
        "-i",
        sourcePath,
        "-filter_complex_script",
        filterScriptPath,
        ...outputArguments,
        temporaryPath,
      ],
      {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, AV_LOG_FORCE_NOCOLOR: "1" },
      },
    );
    let progressBuffer = "";
    let stderr = "";
    let settled = false;

    hooks.setActiveChild(child);

    const cleanup = async (): Promise<void> => {
      hooks.setActiveChild(null);
      await Promise.allSettled([
        rm(temporaryPath, { force: true }),
        rm(filterScriptPath, { force: true }),
      ]);
    };

    const finishReject = async (error: unknown): Promise<void> => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await cleanup();
      reject(error);
    };

    const finishSuccess = async (): Promise<void> => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      hooks.setActiveChild(null);

      try {
        const information = await stat(temporaryPath);
        if (!information.isFile() || information.size <= 0) {
          throw new AudioWorkerTaskError({
            code: "FFMPEG_EMPTY_OUTPUT",
            message: "FFmpeg no produjo una versión reducida utilizable.",
            retryable: true,
          });
        }

        await rm(outputPath, { force: true });
        await rename(temporaryPath, outputPath);
        await rm(filterScriptPath, { force: true });
        resolve();
      } catch (error) {
        await cleanup();
        reject(error);
      }
    };

    const timer = setTimeout(() => {
      child.kill();
      void finishReject(
        new AudioWorkerTaskError({
          code: "SILENCE_REDUCTION_TIMEOUT",
          message: "La reducción de silencios superó el tiempo máximo permitido.",
          retryable: true,
        }),
      );
    }, AUDIO_TASK_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      progressBuffer += chunk;
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const progress = progressFromLine(line.trim(), plan.outputDurationUs);
        if (progress !== null) hooks.reportProgress(progress);
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr = cappedAppend(stderr, chunk, MAX_ERROR_BYTES);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      void finishReject(
        new AudioWorkerTaskError({
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
      if (hooks.isAborted()) {
        void finishReject(new AudioWorkerAbortError());
      } else if (code !== 0) {
        void finishReject(new AudioWorkerTaskError(classifyAudioError(stderr)));
      } else {
        void finishSuccess();
      }
    });
  });
}

async function runDetectSilenceJob(
  job: JobRecord,
  hooks: AudioWorkerHooks,
): Promise<Readonly<Record<string, JsonValue>>> {
  const mediaId = requiredString(job, "mediaId");
  const sourcePath = requiredString(job, "sourcePath");
  const sourceKey = requiredString(job, "sourceKey");
  const command = requiredString(job, "ffmpegCommand");
  const prefix = stringArray(job, "ffmpegArgumentsPrefix");
  const durationUs = requiredNumber(job, "durationUs");
  const thresholdDb = requiredNumber(job, "thresholdDb");
  const minSilenceUs = requiredNumber(job, "minSilenceUs");

  hooks.reportProgress(3);
  const stderr = await executeAnalysis(
    command,
    prefix,
    sourcePath,
    durationUs,
    thresholdDb,
    minSilenceUs,
    hooks,
  );
  const analysis = parseSilenceDetection({
    stderr,
    durationUs,
    thresholdDb,
    minSilenceUs,
    sourceKey,
  });

  hooks.reportProgress(96);

  return Object.freeze({
    mediaId,
    audioAnalysis: JSON.parse(JSON.stringify(analysis)) as JsonValue,
    ffmpegVersion: requiredString(job, "ffmpegVersion"),
  });
}

async function runReduceSilenceJob(
  job: JobRecord,
  hooks: AudioWorkerHooks,
): Promise<Readonly<Record<string, JsonValue>>> {
  const rawPlan = job.payload.plan;

  if (!rawPlan || typeof rawPlan !== "object" || Array.isArray(rawPlan)) {
    throw new AudioWorkerTaskError({
      code: "INVALID_JOB_PAYLOAD",
      message: "El trabajo no contiene un plan de reducción válido.",
      retryable: false,
    });
  }

  const plan = validateSilenceReductionPlan(
    rawPlan as unknown as SilenceReductionPlan,
  );
  await executeReduction(job, plan, hooks);
  hooks.reportProgress(96);

  const outputPath = requiredString(job, "outputPath");
  const information = await stat(outputPath);
  const checksum = await sha256File(outputPath);

  return Object.freeze({
    mediaId: requiredString(job, "mediaId"),
    outputSizeBytes: information.size,
    checksum,
    ffmpegVersion: requiredString(job, "ffmpegVersion"),
    silenceReduction: JSON.parse(JSON.stringify(plan)) as JsonValue,
    derivative: {
      id: requiredString(job, "derivativeId"),
      type: "silence-reduced",
      path: outputPath,
      cacheKey: requiredString(job, "cacheKey"),
      createdAt: new Date().toISOString(),
    },
  });
}

export {
  AudioWorkerAbortError,
  AudioWorkerTaskError,
  buildReductionFilter,
  classifyAudioError,
  progressFromLine,
  runDetectSilenceJob,
  runReduceSilenceJob,
  type AudioWorkerHooks,
};
