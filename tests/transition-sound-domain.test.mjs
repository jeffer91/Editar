/* =========================================================
Nombre completo: transition-sound-domain.test.mjs
Ruta o ubicación: /tests/transition-sound-domain.test.mjs

Función o funciones:
- Probar creación, actualización y eliminación de transiciones.
- Probar eventos temporales de efectos de sonido.
- Verificar limpieza de uniones inválidas y límites de fundidos.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  addMediaAssetsToProject,
  addMediaClip,
  addSoundEffectCue,
  createEmptyProjectDocument,
  createMediaAsset,
  listSoundEffectCues,
  moveClip,
  pruneInvalidTransitions,
  removeSoundEffectCue,
  removeTransition,
  setTransition,
  updateSoundEffectCue,
} from "../dist-electron/shared/domain/index.js";

function fixture() {
  const empty = createEmptyProjectDocument({
    name: "Transiciones",
    now: "2026-07-10T13:00:00.000Z",
  });
  const media = createMediaAsset({
    projectId: empty.project.id,
    kind: "video",
    fileName: "escena.mp4",
    sourcePath: "/fixtures/escena.mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes: 500_000,
    contentHash: "e".repeat(64),
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
  const withMedia = addMediaAssetsToProject(empty, { assets: [media] });
  const track = withMedia.tracks.find((candidate) => candidate.kind === "video");
  const first = addMediaClip(withMedia, {
    mediaId: media.id,
    trackId: track.id,
    timelineStartUs: 0,
    sourceStartUs: 0,
    sourceDurationUs: 5_000_000,
  });
  const document = addMediaClip(first, {
    mediaId: media.id,
    trackId: track.id,
    timelineStartUs: 5_000_000,
    sourceStartUs: 5_000_000,
    sourceDurationUs: 5_000_000,
  });
  return {
    document,
    firstClip: document.clips[0],
    secondClip: document.clips[1],
    track,
  };
}

test("crea, actualiza y elimina una transición entre clips unidos", () => {
  const { document, firstClip, secondClip } = fixture();
  const created = setTransition(document, {
    fromClipId: firstClip.id,
    toClipId: secondClip.id,
    presetId: "crossfade",
    durationUs: 600_000,
    alignment: "center",
  });

  assert.equal(created.transitions.length, 1);
  assert.equal(created.transitions[0].transitionType, "crossfade");
  assert.equal(created.transitions[0].durationUs, 600_000);

  const updated = setTransition(created, {
    fromClipId: firstClip.id,
    toClipId: secondClip.id,
    presetId: "dip-black",
    durationUs: 900_000,
    alignment: "end",
  });

  assert.equal(updated.transitions.length, 1);
  assert.equal(updated.transitions[0].transitionType, "dip-black");
  assert.equal(updated.transitions[0].alignment, "end");

  const removed = removeTransition(updated, updated.transitions[0].id);
  assert.equal(removed.transitions.length, 0);
});

test("rechaza transiciones entre clips que no están unidos", () => {
  const { document, firstClip, secondClip, track } = fixture();
  const moved = moveClip(document, {
    clipId: secondClip.id,
    trackId: track.id,
    timelineStartUs: 6_000_000,
  });

  assert.throws(() =>
    setTransition(moved, {
      fromClipId: firstClip.id,
      toClipId: secondClip.id,
      presetId: "crossfade",
      durationUs: 500_000,
      alignment: "center",
    }),
  );
});

test("limpia una transición cuando una edición rompe la continuidad", () => {
  const { document, firstClip, secondClip, track } = fixture();
  const withTransition = setTransition(document, {
    fromClipId: firstClip.id,
    toClipId: secondClip.id,
    presetId: "blur",
    durationUs: 500_000,
    alignment: "center",
  });
  const moved = moveClip(withTransition, {
    clipId: secondClip.id,
    trackId: track.id,
    timelineStartUs: 6_000_000,
  });
  const cleaned = pruneInvalidTransitions(moved);

  assert.equal(cleaned.transitions.length, 0);
});

test("añade, actualiza, lista y elimina efectos de sonido", () => {
  const { document } = fixture();
  const sequenceId = document.project.mainSequenceId;
  const added = addSoundEffectCue(document, {
    sequenceId,
    presetId: "whoosh",
    startOffsetUs: 1_500_000,
    durationUs: 900_000,
    gainDb: -3,
    pan: -0.2,
    fadeInUs: 100_000,
    fadeOutUs: 150_000,
  });
  const firstCue = listSoundEffectCues(added)[0];

  assert.equal(firstCue.presetId, "whoosh");
  assert.equal(firstCue.startOffsetUs, 1_500_000);
  assert.equal(firstCue.gainDb, -3);

  const updated = updateSoundEffectCue(added, {
    effectId: firstCue.id,
    sequenceId,
    presetId: "impact",
    startOffsetUs: 2_000_000,
    durationUs: 1_100_000,
    gainDb: 2,
    pan: 0.25,
    fadeInUs: 0,
    fadeOutUs: 300_000,
  });
  const updatedCue = listSoundEffectCues(updated)[0];

  assert.equal(updatedCue.presetId, "impact");
  assert.equal(updatedCue.startOffsetUs, 2_000_000);
  assert.equal(updatedCue.pan, 0.25);

  const removed = removeSoundEffectCue(updated, updatedCue.id);
  assert.equal(listSoundEffectCues(removed).length, 0);
});

test("rechaza fundidos de sonido mayores que su duración", () => {
  const { document } = fixture();

  assert.throws(() =>
    addSoundEffectCue(document, {
      sequenceId: document.project.mainSequenceId,
      presetId: "click",
      startOffsetUs: 0,
      durationUs: 200_000,
      fadeInUs: 150_000,
      fadeOutUs: 100_000,
    }),
  );
});
