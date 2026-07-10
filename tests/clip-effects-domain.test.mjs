/* =========================================================
Nombre completo: clip-effects-domain.test.mjs
Ruta o ubicación: /tests/clip-effects-domain.test.mjs

Función o funciones:
- Probar mezcla de audio, fundidos y restablecimiento de valores.
- Probar transformaciones, presets y animaciones visuales.
- Verificar relaciones entre clips y efectos serializables.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIO_MIX_EFFECT_TYPE,
  VIDEO_ANIMATION_EFFECT_TYPE,
  VIDEO_STYLE_EFFECT_TYPE,
  addMediaAssetsToProject,
  addMediaClip,
  createEmptyProjectDocument,
  createMediaAsset,
  readClipAudioMix,
  readClipVisualSettings,
  updateClipAudioMix,
  updateClipVisualProperties,
} from "../dist-electron/shared/domain/index.js";

function fixture() {
  const empty = createEmptyProjectDocument({
    name: "Efectos",
    now: "2026-07-10T12:00:00.000Z",
  });
  const media = createMediaAsset({
    projectId: empty.project.id,
    kind: "video",
    fileName: "entrevista.mp4",
    sourcePath: "/fixtures/entrevista.mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes: 120_000,
    contentHash: "c".repeat(64),
    inspection: {
      status: "ready",
      inspectedAt: "2026-07-10T12:00:00.000Z",
    },
    metadata: {
      kind: "video",
      durationUs: 15_000_000,
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      videoCodec: "h264",
      audio: { codec: "aac", channels: 2, sampleRate: 48_000 },
    },
  });
  const withMedia = addMediaAssetsToProject(empty, { assets: [media] });
  const videoTrack = withMedia.tracks.find((track) => track.kind === "video");
  const document = addMediaClip(withMedia, {
    mediaId: media.id,
    trackId: videoTrack.id,
    timelineStartUs: 0,
    sourceDurationUs: 10_000_000,
  });

  return { document, clip: document.clips[0] };
}

test("guarda mezcla de audio como efecto asociado al clip", () => {
  const { document, clip } = fixture();
  const updated = updateClipAudioMix(document, {
    clipId: clip.id,
    gainDb: -4.5,
    pan: -0.25,
    muted: false,
    fadeInUs: 500_000,
    fadeOutUs: 750_000,
    normalize: true,
    normalizationTargetDb: -2,
  });
  const settings = readClipAudioMix(updated, clip.id);
  const effect = updated.effects.find(
    (candidate) => candidate.effectType === AUDIO_MIX_EFFECT_TYPE,
  );

  assert.ok(effect);
  assert.equal(effect.ownerId, clip.id);
  assert.ok(updated.clips[0].effectIds.includes(effect.id));
  assert.equal(settings.gainDb, -4.5);
  assert.equal(settings.pan, -0.25);
  assert.equal(settings.fadeInUs, 500_000);
  assert.equal(settings.fadeOutUs, 750_000);
  assert.equal(settings.normalize, true);
  assert.equal(settings.normalizationTargetDb, -2);
});

test("restablecer mezcla elimina el efecto que ya no aporta cambios", () => {
  const { document, clip } = fixture();
  const mixed = updateClipAudioMix(document, {
    clipId: clip.id,
    gainDb: -6,
    pan: 0,
    muted: false,
    fadeInUs: 0,
    fadeOutUs: 0,
    normalize: false,
    normalizationTargetDb: -1,
  });
  const reset = updateClipAudioMix(mixed, {
    clipId: clip.id,
    gainDb: 0,
    pan: 0,
    muted: false,
    fadeInUs: 0,
    fadeOutUs: 0,
    normalize: false,
    normalizationTargetDb: -1,
  });

  assert.equal(reset.effects.length, 0);
  assert.equal(reset.clips[0].effectIds.length, 0);
});

test("rechaza fundidos cuya suma supera la duración del clip", () => {
  const { document, clip } = fixture();

  assert.throws(() =>
    updateClipAudioMix(document, {
      clipId: clip.id,
      gainDb: 0,
      pan: 0,
      muted: false,
      fadeInUs: 6_000_000,
      fadeOutUs: 5_000_000,
      normalize: false,
      normalizationTargetDb: -1,
    }),
  );
});

test("actualiza transformación, estilo y animación visual", () => {
  const { document, clip } = fixture();
  const updated = updateClipVisualProperties(document, {
    clipId: clip.id,
    transform: {
      positionX: 120,
      positionY: -40,
      scaleX: 1.2,
      scaleY: 1.2,
      rotationDegrees: 4,
      opacity: 0.85,
      anchorX: 0.5,
      anchorY: 0.5,
    },
    stylePresetId: "cinematic",
    styleIntensity: 0.7,
    animationPresetId: "zoom-in",
    animationDurationUs: 1_500_000,
    animationEasing: "ease-out",
  });
  const settings = readClipVisualSettings(updated, clip.id);
  const styleEffect = updated.effects.find(
    (candidate) => candidate.effectType === VIDEO_STYLE_EFFECT_TYPE,
  );
  const animationEffect = updated.effects.find(
    (candidate) => candidate.effectType === VIDEO_ANIMATION_EFFECT_TYPE,
  );

  assert.ok(styleEffect);
  assert.ok(animationEffect);
  assert.equal(settings.transform.positionX, 120);
  assert.equal(settings.transform.positionY, -40);
  assert.equal(settings.transform.scaleX, 1.2);
  assert.equal(settings.transform.rotationDegrees, 4);
  assert.equal(settings.transform.opacity, 0.85);
  assert.equal(settings.stylePresetId, "cinematic");
  assert.equal(settings.styleIntensity, 0.7);
  assert.equal(settings.animationPresetId, "zoom-in");
  assert.equal(settings.animationDurationUs, 1_500_000);
  assert.equal(settings.animationEasing, "ease-out");
  assert.ok(updated.clips[0].effectIds.includes(styleEffect.id));
  assert.ok(updated.clips[0].effectIds.includes(animationEffect.id));
});

test("eliminar presets conserva la transformación y limpia sus efectos", () => {
  const { document, clip } = fixture();
  const configured = updateClipVisualProperties(document, {
    clipId: clip.id,
    transform: { scaleX: 1.1, scaleY: 1.1 },
    stylePresetId: "warm",
    styleIntensity: 0.5,
    animationPresetId: "fade-in",
    animationDurationUs: 600_000,
    animationEasing: "ease-in",
  });
  const reset = updateClipVisualProperties(configured, {
    clipId: clip.id,
    transform: { scaleX: 1.1, scaleY: 1.1 },
    stylePresetId: "none",
    styleIntensity: 1,
    animationPresetId: "none",
    animationDurationUs: 0,
    animationEasing: "ease-in-out",
  });

  assert.equal(reset.effects.length, 0);
  assert.equal(reset.clips[0].effectIds.length, 0);
  assert.equal(reset.clips[0].transform.scaleX, 1.1);
});
