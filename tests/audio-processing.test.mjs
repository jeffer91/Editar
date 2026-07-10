/* =========================================================
Nombre completo: audio-processing.test.mjs
Ruta o ubicación: /tests/audio-processing.test.mjs

Función o funciones:
- Probar silencedetect dentro de un Worker Thread real.
- Probar render de una versión con silencios reducidos.
- Verificar SQLite, archivos atómicos, reutilización y snapshots.
========================================================= */

import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import { AudioAnalysisJobHandler } from "../dist-electron/main/jobs/audio-analysis-job-handler.js";
import { CompositeJobResultHandler } from "../dist-electron/main/jobs/composite-job-result-handler.js";
import { JobQueueService } from "../dist-electron/main/jobs/job-queue-service.js";
import { MediaDerivativeJobHandler } from "../dist-electron/main/jobs/media-derivative-job-handler.js";
import { WorkerThreadJobExecutor } from "../dist-electron/main/jobs/worker-thread-job-executor.js";
import { AudioAnalysisService } from "../dist-electron/main/media/audio-analysis-service.js";
import { MediaCachePaths } from "../dist-electron/main/media/media-cache-paths.js";
import { MediaImportService } from "../dist-electron/main/media/media-import-service.js";
import { SilenceReductionService } from "../dist-electron/main/media/silence-reduction-service.js";
import { ProjectManagementService } from "../dist-electron/main/projects/project-management-service.js";
import {
  updateMediaInspection,
} from "../dist-electron/shared/domain/index.js";

function mp4Buffer() {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d,
    0x6d, 0x70, 0x34, 0x32,
  ]);
}

async function waitFor(operation, timeoutMs = 10_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await operation();

    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  throw new Error("La condición de la prueba no se cumplió a tiempo.");
}

const fakeFfmpegScript = `
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
const args = process.argv.slice(2);
const isAnalysis = args.some((argument) => argument.includes("silencedetect="));
if (isAnalysis) {
  process.stdout.write("out_time_us=3000000\\nprogress=continue\\nout_time_us=10000000\\nprogress=end\\n");
  process.stderr.write("[silencedetect @ test] silence_start: 1\\n");
  process.stderr.write("[silencedetect @ test] silence_end: 3 | silence_duration: 2\\n");
  process.stderr.write("[silencedetect @ test] silence_start: 5\\n");
  process.stderr.write("[silencedetect @ test] silence_end: 8 | silence_duration: 3\\n");
} else {
  const outputPath = args.at(-1);
  await mkdir(dirname(outputPath), { recursive: true });
  process.stdout.write("out_time_us=2500000\\nprogress=continue\\n");
  await writeFile(outputPath, Buffer.from("SILENCE-REDUCED-EDITAR-" + outputPath));
  process.stdout.write("out_time_us=5600000\\nprogress=end\\n");
}
`;

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-audio-processing-"));
  const filesDirectory = join(root, "files");
  const scriptPath = join(root, "fake-ffmpeg.mjs");
  await mkdir(filesDirectory, { recursive: true });
  await writeFile(scriptPath, fakeFfmpegScript, "utf8");

  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "audio.sqlite3"),
      backupsDirectory: join(root, "backups"),
    },
    automaticBackups: false,
  });
  await database.initialize();

  const projects = new ProjectManagementService(database.projects);
  const paths = new MediaCachePaths(join(root, "cache", "media"));
  const resultHandler = new CompositeJobResultHandler();
  const queue = new JobQueueService({
    repository: database.jobs,
    projects: database.projects,
    executor: new WorkerThreadJobExecutor(),
    resultHandler,
    concurrency: 1,
    pollIntervalMs: 25,
  });
  const engines = {
    async getStatus() {
      const checkedAt = new Date().toISOString();
      return {
        ready: true,
        checkedAt,
        ffmpeg: {
          name: "ffmpeg",
          available: true,
          command: process.execPath,
          source: "environment",
          version: "ffmpeg version audio-test",
          error: null,
          checkedAt,
        },
        ffprobe: {
          name: "ffprobe",
          available: true,
          command: process.execPath,
          source: "environment",
          version: "ffprobe version audio-test",
          error: null,
          checkedAt,
        },
      };
    },
    async getCommand(tool) {
      assert.equal(tool, "ffmpeg");
      return {
        command: process.execPath,
        argumentsPrefix: [scriptPath],
        source: "environment",
        version: "ffmpeg version audio-test",
      };
    },
  };
  const analysis = new AudioAnalysisService({
    projects: database.projects,
    media: database.media,
    jobs: database.jobs,
    engines,
    queue,
  });
  const reduction = new SilenceReductionService({
    projects: database.projects,
    media: database.media,
    jobs: database.jobs,
    engines,
    queue,
    paths,
  });
  resultHandler.add(
    new AudioAnalysisJobHandler(database.media),
    new MediaDerivativeJobHandler(database.media, paths),
  );

  return {
    root,
    filesDirectory,
    database,
    projects,
    paths,
    queue,
    analysis,
    reduction,
    importer: new MediaImportService(database.projects),
    async cleanup() {
      await queue.stop();
      database.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function createReadyVideo(context) {
  const project = await context.projects.create({
    name: "Audio y silencios",
    preset: "horizontal",
  });
  const sourcePath = join(context.filesDirectory, "entrevista.mp4");
  await writeFile(sourcePath, mp4Buffer());
  const imported = await context.importer.importPaths(project.id, [sourcePath]);
  const asset = imported.imported[0];
  const ready = updateMediaInspection(asset, {
    inspection: {
      status: "ready",
      inspectedAt: "2026-07-10T10:00:00.000Z",
    },
    metadata: {
      kind: "video",
      durationUs: 10_000_000,
      width: 1280,
      height: 720,
      frameRate: { numerator: 30, denominator: 1 },
      videoCodec: "h264",
      audio: {
        codec: "aac",
        channels: 2,
        sampleRate: 48_000,
      },
    },
  });
  await context.database.media.update(ready);

  return { project, asset: ready };
}

test("detecta silencios y persiste el análisis acústico", async () => {
  const context = await createContext();

  try {
    const { project, asset } = await createReadyVideo(context);
    const snapshotsBefore = await context.database.projects.countSnapshots(project.id);
    const request = await context.analysis.enqueue(project.id, asset.id, {
      thresholdDb: -35,
      minSilenceUs: 500_000,
    });
    const duplicate = await context.analysis.enqueue(project.id, asset.id, {
      thresholdDb: -35,
      minSilenceUs: 500_000,
    });

    assert.equal(request.queued, true);
    assert.equal(duplicate.queued, false);
    assert.equal(duplicate.jobId, request.jobId);

    await context.queue.start();
    await waitFor(async () => {
      const job = await context.database.jobs.findById(request.jobId);
      return job?.status === "completed" ? job : null;
    });

    const stored = await context.database.media.findById(asset.id);
    assert.equal(stored.audioAnalysis.segments.length, 2);
    assert.equal(stored.audioAnalysis.silenceDurationUs, 5_000_000);
    assert.equal(stored.audioAnalysis.audibleDurationUs, 5_000_000);
    assert.equal(stored.audioAnalysis.thresholdDb, -35);
    assert.equal(
      await context.database.projects.countSnapshots(project.id),
      snapshotsBefore,
    );

    const reused = await context.analysis.enqueue(project.id, asset.id, {
      thresholdDb: -35,
      minSilenceUs: 500_000,
    });
    assert.equal(reused.reused, true);
    assert.equal(reused.jobId, null);
  } finally {
    await context.cleanup();
  }
});

test("crea una versión nueva con silencios acortados", async () => {
  const context = await createContext();

  try {
    const { project, asset } = await createReadyVideo(context);
    await context.queue.start();
    const analysisRequest = await context.analysis.enqueue(project.id, asset.id, {
      thresholdDb: -35,
      minSilenceUs: 500_000,
    });
    await waitFor(async () => {
      const job = await context.database.jobs.findById(analysisRequest.jobId);
      return job?.status === "completed" ? true : null;
    });

    const snapshotsBefore = await context.database.projects.countSnapshots(project.id);
    const reductionRequest = await context.reduction.enqueue(project.id, asset.id, {
      mode: "shorten",
      targetSilenceUs: 300_000,
      edgePaddingUs: 80_000,
    });

    assert.equal(reductionRequest.queued, true);
    assert.equal(reductionRequest.removedDurationMs, 4_400);
    assert.equal(reductionRequest.outputDurationMs, 5_600);

    await waitFor(async () => {
      const job = await context.database.jobs.findById(reductionRequest.jobId);
      return job?.status === "completed" ? job : null;
    });

    const stored = await context.database.media.findById(asset.id);
    const derivative = stored.derivatives.find(
      (item) => item.type === "silence-reduced",
    );

    assert.ok(derivative);
    assert.equal(derivative.path.endsWith(".mp4"), true);
    assert.equal(derivative.path.includes(".partial-"), false);
    assert.equal((await stat(derivative.path)).size > 0, true);
    assert.equal(stored.silenceReduction.mode, "shorten");
    assert.equal(stored.silenceReduction.removedDurationUs, 4_400_000);
    assert.equal(stored.silenceReduction.outputDurationUs, 5_600_000);
    assert.equal(
      await context.database.projects.countSnapshots(project.id),
      snapshotsBefore,
    );

    const reused = await context.reduction.enqueue(project.id, asset.id, {
      mode: "shorten",
      targetSilenceUs: 300_000,
      edgePaddingUs: 80_000,
    });
    assert.equal(reused.reused, true);
    assert.equal(reused.jobId, null);

    const scan = await context.paths.scan();
    assert.equal(scan.temporaryFileCount, 0);
    assert.equal(scan.files.length, 1);
  } finally {
    await context.cleanup();
  }
});
