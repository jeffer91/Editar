/* =========================================================
Nombre completo: database.test.mjs
Ruta o ubicación: /tests/database.test.mjs

Función o funciones:
- Probar migraciones e integridad de SQLite.
- Probar guardado, lectura, snapshots y borrado de proyectos.
- Probar respaldos, retención y reapertura de la base.
========================================================= */

import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createClip,
  createEmptyProjectDocument,
  createMediaAsset,
  createSequence,
  createTrack,
  secondsToMicroseconds,
  validateProjectDocument,
} from "../dist-electron/shared/domain/index.js";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";

async function createTestService(options = {}) {
  const root = await mkdtemp(join(tmpdir(), "editar-sqlite-"));
  const paths = {
    dataDirectory: join(root, "data"),
    databasePath: join(root, "data", "editar-test.sqlite3"),
    backupsDirectory: join(root, "backups"),
  };
  const service = new DatabaseService({
    paths,
    automaticBackups: false,
    maxBackups: options.maxBackups ?? 3,
  });

  await service.initialize();

  return {
    root,
    paths,
    service,
    async cleanup() {
      service.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function createDocumentWithVideo() {
  const document = createEmptyProjectDocument({
    name: "Proyecto persistente",
    now: "2026-07-10T12:00:00.000Z",
  });
  const videoTrack = document.tracks.find((track) => track.kind === "video");

  assert.ok(videoTrack);

  const media = createMediaAsset({
    projectId: document.project.id,
    fileName: "muestra.mp4",
    sourcePath: "C:/Videos/muestra.mp4",
    sizeBytes: 125_000,
    contentHash: "b".repeat(64),
    importedAt: "2026-07-10T12:00:01.000Z",
    metadata: {
      kind: "video",
      durationUs: secondsToMicroseconds(12),
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      videoCodec: "h264",
      audio: {
        codec: "aac",
        channels: 2,
        sampleRate: 48_000,
      },
    },
  });
  const clip = createClip({
    kind: "media",
    trackId: videoTrack.id,
    mediaId: media.id,
    name: "Clip principal",
    timelineStartUs: 0,
    sourceDurationUs: secondsToMicroseconds(12),
  });
  const updatedTrack = createTrack({
    id: videoTrack.id,
    sequenceId: videoTrack.sequenceId,
    kind: videoTrack.kind,
    name: videoTrack.name,
    order: videoTrack.order,
    muted: videoTrack.muted,
    hidden: videoTrack.hidden,
    locked: videoTrack.locked,
    clipIds: [clip.id],
  });
  const currentSequence = document.sequences[0];
  const updatedSequence = createSequence({
    id: currentSequence.id,
    projectId: currentSequence.projectId,
    name: currentSequence.name,
    trackIds: currentSequence.trackIds,
    durationUs: clip.durationUs,
  });
  const completeDocument = {
    ...document,
    sequences: [updatedSequence],
    tracks: document.tracks.map((track) =>
      track.id === updatedTrack.id ? updatedTrack : track,
    ),
    media: [media],
    clips: [clip],
  };

  return validateProjectDocument(completeDocument);
}

test("aplica migraciones y configura SQLite correctamente", async () => {
  const context = await createTestService();

  try {
    const status = await context.service.getStatus(true);

    assert.equal(status.isOpen, true);
    assert.equal(status.schemaVersion, status.latestSchemaVersion);
    assert.equal(status.schemaVersion, 2);
    assert.equal(status.journalMode, "wal");
    assert.equal(status.integrity, "ok");
    assert.equal(status.projectCount, 0);
  } finally {
    await context.cleanup();
  }
});

test("guarda y reconstruye un proyecto completo", async () => {
  const context = await createTestService();

  try {
    const document = createDocumentWithVideo();

    await context.service.projects.save(document, {
      snapshotReason: "prueba inicial",
    });

    const loaded = await context.service.projects.findById(document.project.id);
    const projects = await context.service.projects.list();

    assert.ok(loaded);
    assert.equal(loaded.project.id, document.project.id);
    assert.equal(loaded.media.length, 1);
    assert.equal(loaded.clips.length, 1);
    assert.equal(loaded.clips[0].source.type, "media");
    assert.equal(projects.length, 1);
    assert.equal(projects[0].mediaCount, 1);
    assert.equal(projects[0].clipCount, 1);
    assert.equal(projects[0].durationUs, secondsToMicroseconds(12));
    assert.equal(
      await context.service.projects.countSnapshots(document.project.id),
      1,
    );
  } finally {
    await context.cleanup();
  }
});

test("limita snapshots y elimina proyectos en cascada", async () => {
  const context = await createTestService();

  try {
    const document = createDocumentWithVideo();

    await context.service.projects.save(document, {
      snapshotReason: "primero",
      keepSnapshots: 2,
    });
    await context.service.projects.save(document, {
      snapshotReason: "segundo",
      keepSnapshots: 2,
    });
    await context.service.projects.save(document, {
      snapshotReason: "tercero",
      keepSnapshots: 2,
    });

    assert.equal(
      await context.service.projects.countSnapshots(document.project.id),
      2,
    );
    assert.equal(await context.service.projects.delete(document.project.id), true);
    assert.equal(await context.service.projects.findById(document.project.id), null);

    const status = await context.service.getStatus();
    assert.equal(status.projectCount, 0);
    assert.equal(status.snapshotCount, 0);
  } finally {
    await context.cleanup();
  }
});

test("crea respaldos verificables y aplica retención", async () => {
  const context = await createTestService({ maxBackups: 2 });

  try {
    const document = createDocumentWithVideo();
    await context.service.projects.save(document);

    const first = await context.service.createBackup();
    const second = await context.service.createBackup();
    const third = await context.service.createBackup();

    await access(second.path);
    await access(third.path);
    await assert.rejects(access(first.path));

    assert.equal(first.checksum.length, 64);
    assert.equal(third.schemaVersion, 2);

    const status = await context.service.getStatus();
    assert.equal(status.backupCount, 2);
    assert.equal(status.lastBackupAt, third.createdAt);
  } finally {
    await context.cleanup();
  }
});

test("reabre la misma base sin repetir ni alterar migraciones", async () => {
  const context = await createTestService();
  const document = createDocumentWithVideo();

  try {
    await context.service.projects.save(document);
    context.service.close();

    const reopened = new DatabaseService({
      paths: context.paths,
      automaticBackups: false,
    });

    await reopened.initialize();

    try {
      const loaded = await reopened.projects.findById(document.project.id);
      const status = await reopened.getStatus(true);

      assert.ok(loaded);
      assert.equal(loaded.project.name, "Proyecto persistente");
      assert.equal(status.schemaVersion, 2);
      assert.equal(status.integrity, "ok");
    } finally {
      reopened.close();
    }
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});
