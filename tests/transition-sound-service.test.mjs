/* =========================================================
Nombre completo: transition-sound-service.test.mjs
Ruta o ubicación: /tests/transition-sound-service.test.mjs

Función o funciones:
- Probar transiciones y sonidos mediante el servicio persistente.
- Verificar reapertura, snapshots y limpieza tras mover clips.
- Confirmar bloqueo de proyectos archivados.
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
  listSoundEffectCues,
} from "../dist-electron/shared/domain/index.js";

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-transition-sound-"));
  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "transition-sound.sqlite3"),
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

async function projectWithTwoClips(context) {
  const summary = await context.projects.create({
    name: "Transiciones persistentes",
    preset: "horizontal",
  });
  const document = await context.projects.open(summary.id);
  const media = createMediaAsset({
    projectId: summary.id,
    kind: "video",
    fileName: "escena.mp4",
    sourcePath: "/fixtures/escena.mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes: 500_000,
    contentHash: "f".repeat(64),
    inspection: {
      status: "ready",
      inspectedAt: "2026-07-10T13:00:00.000Z",
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
  await context.database.projects.save(
    addMediaAssetsToProject(document, { assets: [media] }),
  );
  const first = await context.timeline.addMediaClip({
    projectId: summary.id,
    mediaId: media.id,
    sourceStartMs: 0,
    sourceDurationMs: 5_000,
  });
  const second = await context.timeline.addMediaClip({
    projectId: summary.id,
    mediaId: media.id,
    sourceStartMs: 5_000,
    sourceDurationMs: 5_000,
  });

  return {
    projectId: summary.id,
    sequenceId: second.project.mainSequenceId,
    firstClipId: first.clips[0].id,
    secondClipId: second.clips[1].id,
    trackId: second.clips[1].trackId,
  };
}

test("persiste transición y efecto de sonido con snapshots", async () => {
  const context = await createContext();
  try {
    const fixture = await projectWithTwoClips(context);
    const before = await context.database.projects.countSnapshots(fixture.projectId);

    await context.timeline.setTransition({
      projectId: fixture.projectId,
      fromClipId: fixture.firstClipId,
      toClipId: fixture.secondClipId,
      presetId: "crossfade",
      durationMs: 700,
      alignment: "center",
    });
    await context.timeline.addSoundEffect({
      projectId: fixture.projectId,
      sequenceId: fixture.sequenceId,
      presetId: "notification",
      startMs: 1_000,
      durationMs: 650,
      gainDb: -2,
      pan: 0.1,
      fadeInMs: 50,
      fadeOutMs: 100,
    });

    const reopened = await context.projects.open(fixture.projectId);
    assert.equal(reopened.transitions.length, 1);
    assert.equal(reopened.transitions[0].transitionType, "crossfade");
    const cues = listSoundEffectCues(reopened);
    assert.equal(cues.length, 1);
    assert.equal(cues[0].presetId, "notification");
    assert.equal(cues[0].gainDb, -2);
    assert.ok(
      (await context.database.projects.countSnapshots(fixture.projectId)) >= before + 2,
    );
  } finally {
    await context.cleanup();
  }
});

test("mover un clip elimina la transición que quedó inválida", async () => {
  const context = await createContext();
  try {
    const fixture = await projectWithTwoClips(context);
    await context.timeline.setTransition({
      projectId: fixture.projectId,
      fromClipId: fixture.firstClipId,
      toClipId: fixture.secondClipId,
      presetId: "blur",
      durationMs: 400,
      alignment: "center",
    });
    const moved = await context.timeline.moveClip({
      projectId: fixture.projectId,
      clipId: fixture.secondClipId,
      trackId: fixture.trackId,
      timelineStartMs: 6_000,
    });

    assert.equal(moved.transitions.length, 0);
  } finally {
    await context.cleanup();
  }
});

test("rechaza transiciones y sonidos en proyectos archivados", async () => {
  const context = await createContext();
  try {
    const fixture = await projectWithTwoClips(context);
    await context.projects.setStatus({
      projectId: fixture.projectId,
      status: "archived",
    });

    await assert.rejects(() =>
      context.timeline.setTransition({
        projectId: fixture.projectId,
        fromClipId: fixture.firstClipId,
        toClipId: fixture.secondClipId,
        presetId: "crossfade",
        durationMs: 500,
        alignment: "center",
      }),
    );
    await assert.rejects(() =>
      context.timeline.addSoundEffect({
        projectId: fixture.projectId,
        sequenceId: fixture.sequenceId,
        presetId: "click",
        startMs: 0,
        durationMs: 180,
        gainDb: 0,
        pan: 0,
        fadeInMs: 0,
        fadeOutMs: 0,
      }),
    );
  } finally {
    await context.cleanup();
  }
});
