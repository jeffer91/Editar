/* =========================================================
Nombre completo: timeline-domain.test.mjs
Ruta o ubicación: /tests/timeline-domain.test.mjs

Función o funciones:
- Probar inserción, movimiento, recorte, división y eliminación.
- Verificar colisiones, bloqueos y duración de secuencia.
- Probar plantillas y actualización de textos animados.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  addMediaAssetsToProject,
  addMediaClip,
  addTextClip,
  createEmptyProjectDocument,
  createMediaAsset,
  moveClip,
  removeClip,
  splitClip,
  trimClip,
  updateTextLayerForClip,
  updateTrackState,
} from "../dist-electron/shared/domain/index.js";

function readyVideo(projectId) {
  return createMediaAsset({
    projectId,
    kind: "video",
    fileName: "entrevista.mp4",
    sourcePath: "/fixtures/entrevista.mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes: 50_000,
    contentHash: "a".repeat(64),
    inspection: {
      status: "ready",
      inspectedAt: "2026-07-10T10:00:00.000Z",
    },
    metadata: {
      kind: "video",
      durationUs: 12_000_000,
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      videoCodec: "h264",
      audio: { codec: "aac", channels: 2, sampleRate: 48_000 },
    },
    importedAt: "2026-07-10T10:00:00.000Z",
  });
}

function fixture() {
  const empty = createEmptyProjectDocument({
    name: "Timeline",
    now: "2026-07-10T10:00:00.000Z",
  });
  const media = readyVideo(empty.project.id);
  const document = addMediaAssetsToProject(empty, {
    assets: [media],
    now: "2026-07-10T10:01:00.000Z",
  });
  const videoTrack = document.tracks.find((track) => track.kind === "video");
  const textTrack = document.tracks.find((track) => track.kind === "text");
  return { document, media, videoTrack, textTrack };
}

test("inserta, mueve y recorta clips actualizando la secuencia", () => {
  const { document, media, videoTrack } = fixture();
  const first = addMediaClip(document, {
    mediaId: media.id,
    trackId: videoTrack.id,
    timelineStartUs: 0,
    sourceDurationUs: 6_000_000,
  });
  const firstClip = first.clips[0];

  assert.equal(first.clips.length, 1);
  assert.equal(first.sequences[0].durationUs, 6_000_000);
  assert.deepEqual(first.tracks.find((track) => track.id === videoTrack.id).clipIds, [firstClip.id]);

  const trimmed = trimClip(first, {
    clipId: firstClip.id,
    timelineStartUs: 1_000_000,
    durationUs: 4_000_000,
    sourceStartUs: 2_000_000,
  });
  assert.equal(trimmed.clips[0].timelineStartUs, 1_000_000);
  assert.equal(trimmed.clips[0].durationUs, 4_000_000);
  assert.equal(trimmed.clips[0].source.sourceStartUs, 2_000_000);
  assert.equal(trimmed.sequences[0].durationUs, 5_000_000);

  const moved = moveClip(trimmed, {
    clipId: firstClip.id,
    trackId: videoTrack.id,
    timelineStartUs: 3_000_000,
  });
  assert.equal(moved.clips[0].timelineStartUs, 3_000_000);
  assert.equal(moved.sequences[0].durationUs, 7_000_000);
});

test("rechaza colisiones y pistas bloqueadas", () => {
  const { document, media, videoTrack } = fixture();
  const first = addMediaClip(document, {
    mediaId: media.id,
    trackId: videoTrack.id,
    timelineStartUs: 0,
    sourceDurationUs: 5_000_000,
  });

  assert.throws(() =>
    addMediaClip(first, {
      mediaId: media.id,
      trackId: videoTrack.id,
      timelineStartUs: 4_000_000,
      sourceStartUs: 5_000_000,
      sourceDurationUs: 2_000_000,
    }),
  );

  const locked = updateTrackState(first, {
    trackId: videoTrack.id,
    locked: true,
  });
  assert.throws(() =>
    trimClip(locked, {
      clipId: locked.clips[0].id,
      timelineStartUs: 0,
      durationUs: 3_000_000,
    }),
  );
});

test("divide un clip de medios manteniendo los puntos de origen", () => {
  const { document, media, videoTrack } = fixture();
  const withClip = addMediaClip(document, {
    mediaId: media.id,
    trackId: videoTrack.id,
    timelineStartUs: 2_000_000,
    sourceStartUs: 1_000_000,
    sourceDurationUs: 8_000_000,
  });
  const original = withClip.clips[0];
  const divided = splitClip(withClip, {
    clipId: original.id,
    splitAtUs: 6_000_000,
  });
  const [left, right] = divided.clips;

  assert.equal(divided.clips.length, 2);
  assert.equal(left.durationUs, 4_000_000);
  assert.equal(left.source.sourceDurationUs, 4_000_000);
  assert.equal(right.timelineStartUs, 6_000_000);
  assert.equal(right.source.sourceStartUs, 5_000_000);
  assert.equal(right.source.sourceDurationUs, 4_000_000);
  assert.equal(divided.sequences[0].durationUs, 10_000_000);
});

test("crea y actualiza un título animado", () => {
  const { document, textTrack } = fixture();
  const withText = addTextClip(document, {
    trackId: textTrack.id,
    templateId: "title",
    content: "Mi documental",
    timelineStartUs: 0,
    durationUs: 4_000_000,
  });
  const clip = withText.clips[0];
  const layer = withText.textLayers[0];

  assert.equal(clip.kind, "text");
  assert.equal(layer.content, "Mi documental");
  assert.equal(layer.entranceAnimation.presetId, "scale-in");
  assert.equal(layer.style.fontSizePx, 76);

  const updated = updateTextLayerForClip(withText, {
    clipId: clip.id,
    content: "Nuevo título",
    style: { color: "#FFCC00", fontSizePx: 88 },
    entranceAnimation: { presetId: "typewriter", durationMs: 900 },
    exitAnimation: null,
  });

  assert.equal(updated.textLayers[0].content, "Nuevo título");
  assert.equal(updated.textLayers[0].style.color, "#FFCC00");
  assert.equal(updated.textLayers[0].style.fontSizePx, 88);
  assert.equal(updated.textLayers[0].entranceAnimation.presetId, "typewriter");
  assert.equal(updated.textLayers[0].exitAnimation, undefined);
});

test("elimina el clip de texto y limpia su capa huérfana", () => {
  const { document, textTrack } = fixture();
  const withText = addTextClip(document, {
    trackId: textTrack.id,
    templateId: "subtitle",
    content: "Subtítulo",
    timelineStartUs: 2_000_000,
    durationUs: 3_000_000,
  });
  const removed = removeClip(withText, withText.clips[0].id);

  assert.equal(removed.clips.length, 0);
  assert.equal(removed.textLayers.length, 0);
  assert.equal(removed.sequences[0].durationUs, 0);
  assert.equal(removed.tracks.find((track) => track.id === textTrack.id).clipIds.length, 0);
});
