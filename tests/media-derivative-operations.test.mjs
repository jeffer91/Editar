/* =========================================================
Nombre completo: media-derivative-operations.test.mjs
Ruta o ubicación: /tests/media-derivative-operations.test.mjs

Función o funciones:
- Probar inserción y reemplazo de derivados por tipo.
- Verificar eliminación, retención y limpieza completa.
- Confirmar que originales y metadatos permanecen intactos.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  clearMediaDerivatives,
  createEntityId,
  createMediaAsset,
  removeMediaDerivative,
  retainMediaDerivatives,
  upsertMediaDerivative,
} from "../dist-electron/shared/domain/index.js";

function createAsset() {
  return createMediaAsset({
    projectId: createEntityId("project"),
    kind: "video",
    fileName: "original.mp4",
    sourcePath: "/media/original.mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    sizeBytes: 1234,
    contentHash: "a".repeat(64),
    inspection: {
      status: "ready",
      inspectedAt: "2026-07-10T10:00:00.000Z",
    },
    metadata: {
      kind: "video",
      durationUs: 10_000_000,
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
    importedAt: "2026-07-10T09:00:00.000Z",
  });
}

function derivative(type, suffix) {
  return Object.freeze({
    id: createEntityId("derivative"),
    type,
    path: `/cache/${type}-${suffix}`,
    cacheKey: `${type}-${suffix}-cache-key`,
    createdAt: "2026-07-10T10:10:00.000Z",
  });
}

test("agrega derivados sin modificar el original", () => {
  const asset = createAsset();
  const thumbnail = derivative("thumbnail", "uno.jpg");
  const updated = upsertMediaDerivative(asset, thumbnail);

  assert.equal(updated.derivatives.length, 1);
  assert.equal(updated.derivatives[0].id, thumbnail.id);
  assert.equal(updated.sourcePath, asset.sourcePath);
  assert.equal(updated.contentHash, asset.contentHash);
  assert.deepEqual(updated.metadata, asset.metadata);
});

test("reemplaza solo el derivado del mismo tipo", () => {
  const asset = createAsset();
  const thumbnailOne = derivative("thumbnail", "uno.jpg");
  const waveform = derivative("waveform", "onda.png");
  const thumbnailTwo = derivative("thumbnail", "dos.jpg");
  const withTwo = upsertMediaDerivative(
    upsertMediaDerivative(asset, thumbnailOne),
    waveform,
  );
  const replaced = upsertMediaDerivative(withTwo, thumbnailTwo);

  assert.equal(replaced.derivatives.length, 2);
  assert.equal(
    replaced.derivatives.find((item) => item.type === "thumbnail").id,
    thumbnailTwo.id,
  );
  assert.equal(
    replaced.derivatives.find((item) => item.type === "waveform").id,
    waveform.id,
  );
});

test("elimina, retiene y limpia derivados", () => {
  const asset = createAsset();
  const proxy = derivative("proxy", "proxy.mp4");
  const thumbnail = derivative("thumbnail", "thumb.jpg");
  const waveform = derivative("waveform", "wave.png");
  const populated = [proxy, thumbnail, waveform].reduce(
    (current, item) => upsertMediaDerivative(current, item),
    asset,
  );
  const removed = removeMediaDerivative(populated, thumbnail.id);
  const retained = retainMediaDerivatives(
    removed,
    (item) => item.type === "waveform",
  );
  const cleared = clearMediaDerivatives(retained);

  assert.deepEqual(
    removed.derivatives.map((item) => item.type).sort(),
    ["proxy", "waveform"],
  );
  assert.deepEqual(retained.derivatives.map((item) => item.type), ["waveform"]);
  assert.equal(cleared.derivatives.length, 0);
  assert.equal(clearMediaDerivatives(cleared), cleared);
});
