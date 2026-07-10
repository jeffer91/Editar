/* =========================================================
Nombre completo: media-import.test.mjs
Ruta o ubicación: /tests/media-import.test.mjs

Función o funciones:
- Probar firmas y clasificación de archivos multimedia.
- Verificar importación, duplicados, snapshots y cancelación.
- Confirmar que proyectos archivados no acepten nuevos medios.
========================================================= */

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import {
  MediaImportConflictError,
  MediaImportService,
} from "../dist-electron/main/media/media-import-service.js";
import {
  MediaFileInspectionError,
  inspectMediaFile,
} from "../dist-electron/main/media/media-file-inspector.js";
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

function pngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);
}

function wavBuffer() {
  return Buffer.from("RIFF0000WAVEfmt 0000000000000000", "ascii");
}

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-media-"));
  const files = join(root, "files");
  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "media.sqlite3"),
      backupsDirectory: join(root, "backups"),
    },
    automaticBackups: false,
  });

  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(files, { recursive: true }),
  );
  await database.initialize();

  const projects = new ProjectManagementService(database.projects);

  return {
    root,
    files,
    database,
    projects,
    media: new MediaImportService(database.projects),
    async cleanup() {
      database.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("clasifica archivos mediante extensión y firma binaria", async () => {
  const context = await createContext();

  try {
    const videoPath = join(context.files, "video.mp4");
    const imagePath = join(context.files, "imagen.png");
    const audioPath = join(context.files, "audio.wav");
    await writeFile(videoPath, mp4Buffer());
    await writeFile(imagePath, pngBuffer());
    await writeFile(audioPath, wavBuffer());

    const video = await inspectMediaFile(videoPath);
    const image = await inspectMediaFile(imagePath);
    const audio = await inspectMediaFile(audioPath);

    assert.equal(video.kind, "video");
    assert.equal(video.mimeType, "video/mp4");
    assert.equal(image.kind, "image");
    assert.equal(image.extension, "png");
    assert.equal(audio.kind, "audio");
    assert.equal(video.contentHash.length, 64);
  } finally {
    await context.cleanup();
  }
});

test("rechaza archivos cuyo contenido no coincide con la extensión", async () => {
  const context = await createContext();

  try {
    const invalidPath = join(context.files, "falso.mp4");
    await writeFile(invalidPath, Buffer.from("esto no es un video"));

    await assert.rejects(
      inspectMediaFile(invalidPath),
      (error) =>
        error instanceof MediaFileInspectionError &&
        error.code === "INVALID_SIGNATURE",
    );
  } finally {
    await context.cleanup();
  }
});

test("importa medios, omite duplicados y guarda un snapshot", async () => {
  const context = await createContext();

  try {
    const project = await context.projects.create({
      name: "Proyecto con medios",
      preset: "horizontal",
    });
    const videoPath = join(context.files, "principal.mp4");
    const duplicatePath = join(context.files, "copia.mp4");
    const imagePath = join(context.files, "portada.png");
    await writeFile(videoPath, mp4Buffer());
    await writeFile(duplicatePath, mp4Buffer());
    await writeFile(imagePath, pngBuffer());

    const result = await context.media.importPaths(project.id, [
      videoPath,
      duplicatePath,
      imagePath,
    ]);

    assert.equal(result.summary.selectedCount, 3);
    assert.equal(result.summary.importedCount, 2);
    assert.equal(result.summary.duplicateCount, 1);
    assert.equal(result.summary.rejectedCount, 0);
    assert.equal(result.project.media.length, 2);
    assert.equal(result.project.media[0].inspection.status, "pending");
    assert.equal(result.project.media[0].metadata, undefined);
    assert.equal(result.summary.importedByKind.video, 1);
    assert.equal(result.summary.importedByKind.image, 1);
    assert.equal(
      await context.database.projects.countSnapshots(project.id),
      2,
    );

    const reopened = await context.projects.open(project.id);
    assert.equal(reopened.media.length, 2);
    assert.equal(reopened.media[0].contentHash.length, 64);
  } finally {
    await context.cleanup();
  }
});

test("una importación cancelada no modifica el proyecto", async () => {
  const context = await createContext();

  try {
    const project = await context.projects.create({
      name: "Proyecto cancelado",
      preset: "vertical",
    });
    const result = await context.media.createCanceledResult(project.id);

    assert.equal(result.summary.canceled, true);
    assert.equal(result.summary.selectedCount, 0);
    assert.equal(result.project.media.length, 0);
    assert.equal(
      await context.database.projects.countSnapshots(project.id),
      1,
    );
  } finally {
    await context.cleanup();
  }
});

test("impide importar en un proyecto archivado", async () => {
  const context = await createContext();

  try {
    const project = await context.projects.create({
      name: "Proyecto archivado",
      preset: "square",
    });
    await context.projects.setStatus({
      projectId: project.id,
      status: "archived",
    });
    const videoPath = join(context.files, "archivo.mp4");
    await writeFile(videoPath, mp4Buffer());

    await assert.rejects(
      context.media.importPaths(project.id, [videoPath]),
      (error) => error instanceof MediaImportConflictError,
    );
  } finally {
    await context.cleanup();
  }
});
