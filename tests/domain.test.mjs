/* =========================================================
Nombre completo: domain.test.mjs
Ruta o ubicación: /tests/domain.test.mjs

Función o funciones:
- Probar primitivas, proyectos, medios y línea de tiempo.
- Probar efectos, transiciones y estados de trabajos.
- Comprobar la integridad completa de un documento de proyecto.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DOMAIN_SCHEMA_VERSION,
  DomainValidationError,
  areJobDependenciesCompleted,
  calculateMediaClipDuration,
  clipsOverlap,
  collectProjectDocumentIssues,
  createClip,
  createEffect,
  createEmptyProjectDocument,
  createEntityId,
  createJob,
  createMediaAsset,
  createProject,
  createTextLayer,
  createTrack,
  createTransition,
  getClipEndUs,
  secondsToMicroseconds,
  toMicroseconds,
  updateJobState,
} from "../dist-electron/shared/domain/index.js";

test("crea un documento vacío consistente", () => {
  const document = createEmptyProjectDocument({
    name: "  Proyecto   inicial  ",
    now: "2026-07-10T10:00:00.000Z",
  });

  assert.equal(document.project.name, "Proyecto inicial");
  assert.equal(document.project.schemaVersion, DOMAIN_SCHEMA_VERSION);
  assert.equal(document.sequences.length, 1);
  assert.equal(document.tracks.length, 4);
  assert.equal(document.project.mainSequenceId, document.sequences[0].id);
  assert.deepEqual(collectProjectDocumentIssues(document), []);
});

test("rechaza tiempos negativos y fraccionarios", () => {
  assert.throws(
    () => toMicroseconds(-1),
    (error) =>
      error instanceof DomainValidationError && error.code === "OUT_OF_RANGE",
  );
  assert.throws(
    () => toMicroseconds(1.5),
    (error) =>
      error instanceof DomainValidationError && error.code === "INVALID_FORMAT",
  );
  assert.equal(secondsToMicroseconds(1.25), 1_250_000);
});

test("valida resolución, color y preferencias del proyecto", () => {
  const project = createProject({
    name: "Vertical",
    canvas: {
      width: 1080,
      height: 1920,
      fps: 60,
      aspectRatio: "9:16",
      backgroundColor: "#112233",
    },
  });

  assert.equal(project.canvas.width, 1080);
  assert.equal(project.canvas.aspectRatio, "9:16");

  assert.throws(
    () =>
      createProject({
        name: "Color inválido",
        canvas: { backgroundColor: "negro" },
      }),
    (error) =>
      error instanceof DomainValidationError &&
      error.field === "canvas.backgroundColor",
  );
});

test("crea y valida un recurso de video", () => {
  const projectId = createEntityId("project", "media-test-0001");
  const media = createMediaAsset({
    projectId,
    fileName: "video.mp4",
    sourcePath: "C:/Videos/video.mp4",
    sizeBytes: 10_000,
    contentHash: "a".repeat(64),
    metadata: {
      kind: "video",
      durationUs: secondsToMicroseconds(10),
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30_000, denominator: 1_001 },
      videoCodec: "H264",
      audio: {
        codec: "AAC",
        channels: 2,
        sampleRate: 48_000,
      },
    },
  });

  assert.equal(media.kind, "video");
  assert.equal(media.metadata.kind, "video");
  assert.equal(media.contentHash, "a".repeat(64));
});

test("calcula duración y final de clips usando microsegundos", () => {
  const trackId = createEntityId("track", "timeline-test-01");
  const mediaId = createEntityId("media", "timeline-test-01");
  const clip = createClip({
    kind: "media",
    trackId,
    mediaId,
    name: "Clip rápido",
    timelineStartUs: secondsToMicroseconds(2),
    sourceDurationUs: secondsToMicroseconds(8),
    playbackRate: 2,
  });

  assert.equal(clip.durationUs, secondsToMicroseconds(4));
  assert.equal(getClipEndUs(clip), secondsToMicroseconds(6));
  assert.equal(
    calculateMediaClipDuration(secondsToMicroseconds(8), 2),
    secondsToMicroseconds(4),
  );
});

test("detecta colisiones solo dentro de la misma pista", () => {
  const trackId = createEntityId("track", "overlap-track-01");
  const anotherTrackId = createEntityId("track", "overlap-track-02");
  const mediaId = createEntityId("media", "overlap-media-01");
  const first = createClip({
    kind: "media",
    trackId,
    mediaId,
    name: "Primero",
    timelineStartUs: toMicroseconds(0),
    sourceDurationUs: secondsToMicroseconds(5),
  });
  const second = createClip({
    kind: "media",
    trackId,
    mediaId,
    name: "Segundo",
    timelineStartUs: secondsToMicroseconds(4),
    sourceDurationUs: secondsToMicroseconds(2),
  });
  const otherTrack = createClip({
    kind: "media",
    trackId: anotherTrackId,
    mediaId,
    name: "Otra pista",
    timelineStartUs: secondsToMicroseconds(4),
    sourceDurationUs: secondsToMicroseconds(2),
  });

  assert.equal(clipsOverlap(first, second), true);
  assert.equal(clipsOverlap(first, otherTrack), false);
});

test("crea capas de texto, efectos y transiciones versionadas", () => {
  const projectId = createEntityId("project", "effects-project-01");
  const trackId = createEntityId("track", "effects-track-001");
  const textLayer = createTextLayer({
    projectId,
    name: "Título",
    content: "Texto principal",
    style: { color: "#ffcc00", fontSizePx: 72 },
  });
  const clipA = createClip({
    kind: "text",
    trackId,
    textLayerId: textLayer.id,
    name: "Título A",
    timelineStartUs: toMicroseconds(0),
    durationUs: secondsToMicroseconds(3),
  });
  const clipB = createClip({
    kind: "text",
    trackId,
    textLayerId: textLayer.id,
    name: "Título B",
    timelineStartUs: secondsToMicroseconds(3),
    durationUs: secondsToMicroseconds(3),
  });
  const effect = createEffect({
    ownerType: "clip",
    ownerId: clipA.id,
    effectType: "zoom-in",
    parameters: { intensity: 0.4 },
  });
  const transition = createTransition({
    fromClipId: clipA.id,
    toClipId: clipB.id,
    transitionType: "fade",
    durationUs: secondsToMicroseconds(0.5),
  });

  assert.equal(textLayer.style.color, "#FFCC00");
  assert.equal(effect.version, 1);
  assert.equal(transition.alignment, "center");
});

test("controla transiciones de estado de trabajos", () => {
  const projectId = createEntityId("project", "jobs-project-001");
  const first = createJob({ projectId, kind: "probe-media" });
  const dependent = createJob({
    projectId,
    kind: "generate-proxy",
    dependencyIds: [first.id],
  });
  const preparing = updateJobState(first, {
    status: "preparing",
    now: "2026-07-10T10:00:00.000Z",
  });
  const running = updateJobState(preparing, {
    status: "running",
    progress: 50,
    attempt: 1,
    now: "2026-07-10T10:00:01.000Z",
  });
  const completed = updateJobState(running, {
    status: "completed",
    progress: 100,
    result: { durationUs: 10_000_000 },
    now: "2026-07-10T10:00:02.000Z",
  });

  assert.equal(areJobDependenciesCompleted(dependent, [completed, dependent]), true);
  assert.throws(
    () => updateJobState(completed, { status: "running" }),
    (error) =>
      error instanceof DomainValidationError &&
      error.code === "INVALID_RELATION",
  );
});

test("detecta referencias rotas dentro del proyecto", () => {
  const document = createEmptyProjectDocument({ name: "Proyecto roto" });
  const videoTrack = document.tracks.find((track) => track.kind === "video");
  assert.ok(videoTrack);

  const missingMediaClip = createClip({
    kind: "media",
    trackId: videoTrack.id,
    mediaId: createEntityId("media", "missing-media-01"),
    name: "Sin medio",
    timelineStartUs: toMicroseconds(0),
    sourceDurationUs: secondsToMicroseconds(1),
  });
  const updatedTrack = createTrack({
    ...videoTrack,
    clipIds: [missingMediaClip.id],
  });
  const brokenDocument = {
    ...document,
    tracks: document.tracks.map((track) =>
      track.id === updatedTrack.id ? updatedTrack : track,
    ),
    clips: [missingMediaClip],
  };
  const issues = collectProjectDocumentIssues(brokenDocument);

  assert.ok(
    issues.some((issue) =>
      issue.field.endsWith("source.mediaId"),
    ),
  );
});
