/* =========================================================
Nombre completo: media-analysis.test.mjs
Ruta o ubicación: /tests/media-analysis.test.mjs

Función o funciones:
- Probar cola, Worker Thread, FFprobe simulado y SQLite.
- Confirmar persistencia de metadatos y errores definitivos.
- Verificar que el análisis no cree snapshots del proyecto.
========================================================= */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import { JobQueueService } from "../dist-electron/main/jobs/job-queue-service.js";
import { MediaProbeJobHandler } from "../dist-electron/main/jobs/media-probe-job-handler.js";
import { WorkerThreadJobExecutor } from "../dist-electron/main/jobs/worker-thread-job-executor.js";
import { MediaAnalysisService } from "../dist-electron/main/media/media-analysis-service.js";
import { MediaImportService } from "../dist-electron/main/media/media-import-service.js";
import { ProjectManagementService } from "../dist-electron/main/projects/project-management-service.js";

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

async function waitFor(operation, timeoutMs = 8_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await operation();

    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  throw new Error("La condición de la prueba no se cumplió a tiempo.");
}

function readyStatus(command) {
  const checkedAt = new Date().toISOString();

  return Object.freeze({
    ready: true,
    checkedAt,
    ffmpeg: Object.freeze({
      name: "ffmpeg",
      available: true,
      command,
      source: "environment",
      version: "ffmpeg version test",
      error: null,
      checkedAt,
    }),
    ffprobe: Object.freeze({
      name: "ffprobe",
      available: true,
      command,
      source: "environment",
      version: "ffprobe version test",
      error: null,
      checkedAt,
    }),
  });
}

async function createContext(scriptBody) {
  const root = await mkdtemp(join(tmpdir(), "editar-analysis-"));
  const filesDirectory = join(root, "files");
  const scriptPath = join(root, "fake-ffprobe.mjs");
  await mkdir(filesDirectory, { recursive: true });
  await writeFile(scriptPath, scriptBody, "utf8");

  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "analysis.sqlite3"),
      backupsDirectory: join(root, "backups"),
    },
    automaticBackups: false,
  });
  await database.initialize();

  const projects = new ProjectManagementService(database.projects);
  const queue = new JobQueueService({
    repository: database.jobs,
    projects: database.projects,
    executor: new WorkerThreadJobExecutor(),
    resultHandler: new MediaProbeJobHandler(database.media),
    concurrency: 1,
    pollIntervalMs: 25,
  });
  const engines = {
    async getStatus() {
      return readyStatus(process.execPath);
    },
    async getCommand(tool) {
      assert.equal(tool, "ffprobe");
      return Object.freeze({
        command: process.execPath,
        argumentsPrefix: Object.freeze([scriptPath]),
        source: "environment",
        version: "ffprobe version test",
      });
    },
  };
  const analysis = new MediaAnalysisService({
    projects: database.projects,
    media: database.media,
    jobs: database.jobs,
    engines,
    queue,
  });
  const importer = new MediaImportService(database.projects);

  return {
    root,
    filesDirectory,
    database,
    projects,
    queue,
    analysis,
    importer,
    async cleanup() {
      await queue.stop();
      database.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

const successScript = `
const payload = {
  streams: [
    {
      codec_name: "h264",
      codec_type: "video",
      width: 1280,
      height: 720,
      avg_frame_rate: "24000/1001",
      r_frame_rate: "24000/1001",
      bit_rate: "2500000",
      disposition: { attached_pic: 0 }
    },
    {
      codec_name: "aac",
      codec_type: "audio",
      sample_rate: "48000",
      channels: 2,
      bit_rate: "128000"
    }
  ],
  format: { duration: "9.25", bit_rate: "2700000" }
};
process.stdout.write(JSON.stringify(payload));
`;

const failureScript = `
process.stderr.write("Invalid data found when processing input");
process.exitCode = 1;
`;

test("analiza un video y persiste metadatos sin snapshots técnicos", async () => {
  const context = await createContext(successScript);

  try {
    const project = await context.projects.create({
      name: "Análisis correcto",
      preset: "horizontal",
    });
    const sourcePath = join(context.filesDirectory, "video.mp4");
    await writeFile(sourcePath, mp4Buffer());
    const imported = await context.importer.importPaths(project.id, [sourcePath]);
    const media = imported.imported[0];
    const snapshotsBefore = await context.database.projects.countSnapshots(project.id);

    await context.queue.start();
    const request = await context.analysis.enqueue(project.id, media.id);
    const duplicate = await context.analysis.enqueue(project.id, media.id);

    assert.equal(request.queued, true);
    assert.equal(duplicate.queued, false);
    assert.equal(duplicate.jobId, request.jobId);

    const completed = await waitFor(async () => {
      const job = await context.database.jobs.findById(request.jobId);
      return job?.status === "completed" ? job : null;
    });
    const storedMedia = await context.database.media.findById(media.id);
    const reopened = await context.projects.open(project.id);

    assert.equal(completed.progress, 100);
    assert.equal(storedMedia.inspection.status, "ready");
    assert.equal(storedMedia.metadata.kind, "video");
    assert.equal(storedMedia.metadata.durationUs, 9_250_000);
    assert.equal(storedMedia.metadata.width, 1280);
    assert.equal(storedMedia.metadata.height, 720);
    assert.equal(storedMedia.metadata.videoCodec, "h264");
    assert.equal(storedMedia.metadata.audio.codec, "aac");
    assert.equal(reopened.media[0].inspection.status, "ready");
    assert.equal(
      await context.database.projects.countSnapshots(project.id),
      snapshotsBefore,
    );
  } finally {
    await context.cleanup();
  }
});

test("registra un archivo inválido como análisis fallido", async () => {
  const context = await createContext(failureScript);

  try {
    const project = await context.projects.create({
      name: "Análisis fallido",
      preset: "vertical",
    });
    const sourcePath = join(context.filesDirectory, "roto.mp4");
    await writeFile(sourcePath, mp4Buffer());
    const imported = await context.importer.importPaths(project.id, [sourcePath]);
    const media = imported.imported[0];

    await context.queue.start();
    const request = await context.analysis.enqueue(project.id, media.id);

    const failed = await waitFor(async () => {
      const job = await context.database.jobs.findById(request.jobId);
      return job?.status === "failed" ? job : null;
    });
    const storedMedia = await context.database.media.findById(media.id);

    assert.equal(failed.error.code, "FFPROBE_INVALID_MEDIA");
    assert.equal(failed.error.retryable, false);
    assert.equal(storedMedia.inspection.status, "failed");
    assert.match(storedMedia.inspection.error, /estructura multimedia válida/i);
    assert.equal(storedMedia.metadata, undefined);
  } finally {
    await context.cleanup();
  }
});
