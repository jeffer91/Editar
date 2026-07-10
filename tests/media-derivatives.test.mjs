/* =========================================================
Nombre completo: media-derivatives.test.mjs
Ruta o ubicación: /tests/media-derivatives.test.mjs

Función o funciones:
- Probar planificación, cola, Worker, FFmpeg simulado y SQLite.
- Verificar reutilización, archivos atómicos y ausencia de snapshots.
- Probar diagnóstico, reconciliación y limpieza completa de caché.
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
import { dirname, join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import { CompositeJobResultHandler } from "../dist-electron/main/jobs/composite-job-result-handler.js";
import { JobQueueService } from "../dist-electron/main/jobs/job-queue-service.js";
import { MediaDerivativeJobHandler } from "../dist-electron/main/jobs/media-derivative-job-handler.js";
import { WorkerThreadJobExecutor } from "../dist-electron/main/jobs/worker-thread-job-executor.js";
import { MediaCachePaths } from "../dist-electron/main/media/media-cache-paths.js";
import { MediaCacheService } from "../dist-electron/main/media/media-cache-service.js";
import { MediaDerivativeService } from "../dist-electron/main/media/media-derivative-service.js";
import { MediaImportService } from "../dist-electron/main/media/media-import-service.js";
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
const outputPath = process.argv.at(-1);
await mkdir(dirname(outputPath), { recursive: true });
process.stdout.write("out_time_us=2000000\\nprogress=continue\\n");
await writeFile(outputPath, Buffer.from("DERIVADO-EDITAR-" + outputPath));
process.stdout.write("out_time_us=10000000\\nprogress=end\\n");
`;

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-derivatives-"));
  const filesDirectory = join(root, "files");
  const scriptPath = join(root, "fake-ffmpeg.mjs");
  await mkdir(filesDirectory, { recursive: true });
  await writeFile(scriptPath, fakeFfmpegScript, "utf8");

  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "derivatives.sqlite3"),
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
    concurrency: 2,
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
          version: "ffmpeg version test",
          error: null,
          checkedAt,
        },
        ffprobe: {
          name: "ffprobe",
          available: true,
          command: process.execPath,
          source: "environment",
          version: "ffprobe version test",
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
        version: "ffmpeg version test",
      };
    },
  };
  const derivatives = new MediaDerivativeService({
    projects: database.projects,
    media: database.media,
    jobs: database.jobs,
    engines,
    queue,
    paths,
  });
  const cache = new MediaCacheService({
    paths,
    media: database.media,
    jobs: database.jobs,
  });
  resultHandler.add(new MediaDerivativeJobHandler(database.media, paths));

  return {
    root,
    filesDirectory,
    database,
    projects,
    paths,
    queue,
    derivatives,
    cache,
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
    name: "Proyecto de derivados",
    preset: "horizontal",
  });
  const sourcePath = join(context.filesDirectory, "video.mp4");
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
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      videoCodec: "h264",
      bitRate: 4_000_000,
      audio: {
        codec: "aac",
        channels: 2,
        sampleRate: 48_000,
        bitRate: 128_000,
      },
    },
  });
  await context.database.media.update(ready);

  return { project, asset: ready };
}

test("genera proxy, miniatura y onda mediante la cola", async () => {
  const context = await createContext();

  try {
    const { project, asset } = await createReadyVideo(context);
    const snapshotsBefore = await context.database.projects.countSnapshots(project.id);
    await context.queue.start();

    const request = await context.derivatives.enqueue(project.id, asset.id);

    assert.equal(request.queuedCount, 3);
    assert.deepEqual(
      [...request.requestedTypes].sort(),
      ["proxy", "thumbnail", "waveform"],
    );

    await waitFor(async () => {
      const jobs = await context.database.jobs.list(project.id);
      const selected = jobs.filter((item) => request.jobIds.includes(item.job.id));
      return selected.length === 3 &&
        selected.every((item) => item.job.status === "completed")
        ? selected
        : null;
    });

    const stored = await context.database.media.findById(asset.id);
    assert.equal(stored.derivatives.length, 3);
    assert.deepEqual(
      stored.derivatives.map((item) => item.type).sort(),
      ["proxy", "thumbnail", "waveform"],
    );

    for (const derivative of stored.derivatives) {
      const information = await stat(derivative.path);
      assert.equal(information.isFile(), true);
      assert.ok(information.size > 0);
      assert.equal(derivative.path.includes(".partial-"), false);
    }

    assert.equal(
      await context.database.projects.countSnapshots(project.id),
      snapshotsBefore,
    );

    const reused = await context.derivatives.enqueue(project.id, asset.id);
    assert.equal(reused.queuedCount, 0);
    assert.equal(reused.reusedCount, 3);

    const status = await context.cache.getStatus();
    assert.equal(status.fileCount, 3);
    assert.equal(status.derivativeCount, 3);
    assert.equal(status.temporaryFileCount, 0);
    assert.equal(status.orphanFileCount, 0);
  } finally {
    await context.cleanup();
  }
});

test("reconcilia temporales y huérfanos, y limpia referencias", async () => {
  const context = await createContext();

  try {
    const { project, asset } = await createReadyVideo(context);
    await context.queue.start();
    const request = await context.derivatives.enqueue(project.id, asset.id);

    await waitFor(async () => {
      const jobs = await context.database.jobs.list(project.id);
      return jobs.filter((item) => request.jobIds.includes(item.job.id)).every(
        (item) => item.job.status === "completed",
      ) ? true : null;
    });

    const orphan = context.paths.resolveDerivativePath(
      project.id,
      asset.id,
      "thumbnail",
      "f".repeat(64),
    );
    const temporary = context.paths.resolveTemporaryPath(
      orphan,
      request.jobIds[0],
    );
    await mkdir(dirname(orphan), { recursive: true });
    await writeFile(orphan, Buffer.from("orphan"));
    await writeFile(temporary, Buffer.from("temporary"));

    const before = await context.cache.getStatus();
    assert.equal(before.orphanFileCount, 1);
    assert.equal(before.temporaryFileCount, 1);

    const reconciled = await context.cache.reconcile();
    assert.equal(reconciled.orphanFileCount, 0);
    assert.equal(reconciled.temporaryFileCount, 0);
    assert.equal(reconciled.fileCount, 3);

    const cleared = await context.cache.clear();
    const stored = await context.database.media.findById(asset.id);

    assert.equal(cleared.removedFiles, 3);
    assert.equal(cleared.removedDerivatives, 3);
    assert.equal(cleared.status.fileCount, 0);
    assert.equal(stored.derivatives.length, 0);
  } finally {
    await context.cleanup();
  }
});
