/* =========================================================
Nombre completo: timeline-editing.test.mjs
Ruta o ubicación: /tests/timeline-editing.test.mjs

Función o funciones:
- Probar edición persistente mediante SQLite.
- Verificar snapshots, posiciones predeterminadas y reapertura.
- Probar títulos animados y bloqueo de proyectos archivados.
========================================================= */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import {
  ProjectManagementService,
} from "../dist-electron/main/projects/project-management-service.js";
import {
  TimelineEditingService,
} from "../dist-electron/main/timeline/timeline-editing-service.js";
import {
  addMediaAssetsToProject,
  createMediaAsset,
} from "../dist-electron/shared/domain/index.js";

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-timeline-"));
  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "timeline.sqlite3"),
      backupsDirectory: join(root, "backups"),
    },
    automaticBackups: false,
  });
  await database.initialize();
  const projects = new ProjectManagementService(database.projects);
  const timeline = new TimelineEditingService(database.projects);

  return {
    root,
    database,
    projects,
    timeline,
    async cleanup() {
      database.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function createProjectWithMedia(context) {
  const summary = await context.projects.create({
    name: "Edición funcional",
    preset: "horizontal",
  });
  const document = await context.projects.open(summary.id);
  const media = createMediaAsset({
    projectId: summary.id,
    kind: "video",
    fileName: "clase.mp4",
    sourcePath: "/fixtures/clase.mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes: 250_000,
    contentHash: "b".repeat(64),
    inspection: {
      status: "ready",
      inspectedAt: "2026-07-10T10:00:00.000Z",
    },
    metadata: {
      kind: "video",
      durationUs: 20_000_000,
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      videoCodec: "h264",
      audio: { codec: "aac", channels: 2, sampleRate: 48_000 },
    },
  });
  const withMedia = addMediaAssetsToProject(document, { assets: [media] });
  await context.database.projects.save(withMedia);
  return { projectId: summary.id, media };
}

test("añade, recorta, mueve y divide clips con snapshots", async () => {
  const context = await createContext();

  try {
    const { projectId, media } = await createProjectWithMedia(context);
    const before = await context.database.projects.countSnapshots(projectId);
    const first = await context.timeline.addMediaClip({ projectId, mediaId: media.id });
    const firstClip = first.clips[0];
    const videoTrack = first.tracks.find((track) => track.kind === "video");

    assert.equal(firstClip.timelineStartUs, 0);
    assert.equal(firstClip.durationUs, 20_000_000);

    const trimmed = await context.timeline.trimClip({
      projectId,
      clipId: firstClip.id,
      timelineStartMs: 0,
      durationMs: 8_000,
      sourceStartMs: 2_000,
    });
    assert.equal(trimmed.clips[0].durationUs, 8_000_000);
    assert.equal(trimmed.clips[0].source.sourceStartUs, 2_000_000);

    const moved = await context.timeline.moveClip({
      projectId,
      clipId: firstClip.id,
      trackId: videoTrack.id,
      timelineStartMs: 1_000,
    });
    assert.equal(moved.clips[0].timelineStartUs, 1_000_000);

    const divided = await context.timeline.splitClip({
      projectId,
      clipId: firstClip.id,
      splitAtMs: 5_000,
    });
    assert.equal(divided.clips.length, 2);
    assert.equal(divided.sequences[0].durationUs, 9_000_000);

    const reopened = await context.projects.open(projectId);
    assert.equal(reopened.clips.length, 2);
    assert.ok((await context.database.projects.countSnapshots(projectId)) >= before + 4);
  } finally {
    await context.cleanup();
  }
});

test("añade y actualiza textos animados persistentes", async () => {
  const context = await createContext();

  try {
    const { projectId } = await createProjectWithMedia(context);
    const withTitle = await context.timeline.addTextClip({
      projectId,
      templateId: "lower-third",
      content: "Jefferson Villarreal\nCoordinación académica",
      durationMs: 5_000,
    });
    const clip = withTitle.clips.find((candidate) => candidate.kind === "text");
    const layer = withTitle.textLayers[0];

    assert.ok(clip);
    assert.equal(layer.entranceAnimation.presetId, "slide-left");
    assert.equal(layer.style.alignment, "left");

    const updated = await context.timeline.updateTextClip({
      projectId,
      clipId: clip.id,
      content: "Jefferson Villarreal\nDirector del proyecto",
      style: {
        color: "#FFDD33",
        fontSizePx: 48,
        backgroundOpacity: 0.5,
      },
      entrancePresetId: "typewriter",
      entranceDurationMs: 1_100,
      exitPresetId: null,
    });

    assert.equal(updated.textLayers[0].content.includes("Director"), true);
    assert.equal(updated.textLayers[0].style.color, "#FFDD33");
    assert.equal(updated.textLayers[0].entranceAnimation.presetId, "typewriter");
    assert.equal(updated.textLayers[0].exitAnimation, undefined);

    const reopened = await context.projects.open(projectId);
    assert.equal(reopened.textLayers[0].content, updated.textLayers[0].content);
  } finally {
    await context.cleanup();
  }
});

test("impide editar un proyecto archivado", async () => {
  const context = await createContext();

  try {
    const { projectId, media } = await createProjectWithMedia(context);
    await context.projects.setStatus({ projectId, status: "archived" });

    await assert.rejects(() =>
      context.timeline.addMediaClip({ projectId, mediaId: media.id }),
    );
    await assert.rejects(() =>
      context.timeline.addTextClip({
        projectId,
        templateId: "title",
        content: "No permitido",
      }),
    );
  } finally {
    await context.cleanup();
  }
});
