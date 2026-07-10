/* =========================================================
Nombre completo: clip-properties.test.mjs
Ruta o ubicación: /tests/clip-properties.test.mjs

Función o funciones:
- Probar mezcla y efectos mediante el servicio persistente.
- Verificar snapshots y reapertura desde SQLite.
- Confirmar bloqueos de proyectos archivados.
========================================================= */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import { ProjectManagementService } from "../dist-electron/main/projects/project-management-service.js";
import { TimelineEditingService } from "../dist-electron/main/timeline/timeline-editing-service.js";
import {
  addMediaAssetsToProject,
  createMediaAsset,
  readClipAudioMix,
  readClipVisualSettings,
} from "../dist-electron/shared/domain/index.js";

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-properties-"));
  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "properties.sqlite3"),
      backupsDirectory: join(root, "backups"),
    },
    automaticBackups: false,
  });
  await database.initialize();

  return {
    root,
    database,
    projects: new ProjectManagementService(database.projects),
    timeline: new TimelineEditingService(database.projects),
    async cleanup() {
      database.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function projectWithClip(context) {
  const summary = await context.projects.create({
    name: "Propiedades persistentes",
    preset: "horizontal",
  });
  const document = await context.projects.open(summary.id);
  const media = createMediaAsset({
    projectId: summary.id,
    kind: "video",
    fileName: "presentacion.mp4",
    sourcePath: "/fixtures/presentacion.mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes: 300_000,
    contentHash: "d".repeat(64),
    inspection: {
      status: "ready",
      inspectedAt: "2026-07-10T12:00:00.000Z",
    },
    metadata: {
      kind: "video",
      durationUs: 18_000_000,
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      videoCodec: "h264",
      audio: { codec: "aac", channels: 2, sampleRate: 48_000 },
    },
  });
  const withMedia = addMediaAssetsToProject(document, { assets: [media] });
  await context.database.projects.save(withMedia);
  const withClip = await context.timeline.addMediaClip({
    projectId: summary.id,
    mediaId: media.id,
  });

  return {
    projectId: summary.id,
    clipId: withClip.clips[0].id,
  };
}

test("persiste mezcla y efectos visuales con snapshots", async () => {
  const context = await createContext();

  try {
    const { projectId, clipId } = await projectWithClip(context);
    const before = await context.database.projects.countSnapshots(projectId);

    const mixed = await context.timeline.updateClipAudioMix({
      projectId,
      clipId,
      gainDb: -3,
      pan: 0.2,
      muted: false,
      fadeInMs: 400,
      fadeOutMs: 600,
      normalize: true,
      normalizationTargetDb: -1.5,
    });
    assert.equal(readClipAudioMix(mixed, clipId).gainDb, -3);

    const visual = await context.timeline.updateClipVisual({
      projectId,
      clipId,
      transform: {
        positionX: 80,
        positionY: -20,
        scaleX: 1.15,
        scaleY: 1.15,
        rotationDegrees: 2,
        opacity: 0.9,
        anchorX: 0.5,
        anchorY: 0.5,
      },
      stylePresetId: "vivid",
      styleIntensity: 0.65,
      animationPresetId: "pan-left",
      animationDurationMs: 1_200,
      animationEasing: "ease-in-out",
    });
    assert.equal(readClipVisualSettings(visual, clipId).stylePresetId, "vivid");

    const reopened = await context.projects.open(projectId);
    const reopenedAudio = readClipAudioMix(reopened, clipId);
    const reopenedVisual = readClipVisualSettings(reopened, clipId);

    assert.equal(reopenedAudio.pan, 0.2);
    assert.equal(reopenedAudio.fadeOutUs, 600_000);
    assert.equal(reopenedVisual.transform.positionX, 80);
    assert.equal(reopenedVisual.animationPresetId, "pan-left");
    assert.ok(reopened.effects.length >= 3);
    assert.ok(
      (await context.database.projects.countSnapshots(projectId)) >= before + 2,
    );
  } finally {
    await context.cleanup();
  }
});

test("rechaza mezcla y efectos cuando el proyecto está archivado", async () => {
  const context = await createContext();

  try {
    const { projectId, clipId } = await projectWithClip(context);
    await context.projects.setStatus({ projectId, status: "archived" });

    await assert.rejects(() =>
      context.timeline.updateClipAudioMix({
        projectId,
        clipId,
        gainDb: 0,
        pan: 0,
        muted: true,
        fadeInMs: 0,
        fadeOutMs: 0,
        normalize: false,
        normalizationTargetDb: -1,
      }),
    );

    await assert.rejects(() =>
      context.timeline.updateClipVisual({
        projectId,
        clipId,
        transform: {
          positionX: 0,
          positionY: 0,
          scaleX: 1,
          scaleY: 1,
          rotationDegrees: 0,
          opacity: 1,
          anchorX: 0.5,
          anchorY: 0.5,
        },
        stylePresetId: "warm",
        styleIntensity: 0.5,
        animationPresetId: "none",
        animationDurationMs: 0,
        animationEasing: "ease-in-out",
      }),
    );
  } finally {
    await context.cleanup();
  }
});
