/* =========================================================
Nombre completo: audio-analysis-domain.test.mjs
Ruta o ubicación: /tests/audio-analysis-domain.test.mjs

Función o funciones:
- Probar normalización y métricas de silencios.
- Verificar planes de acortado y eliminación con márgenes.
- Impedir planes inválidos o que eliminen todo el contenido.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createAudioAnalysis,
  createSilenceReductionPlan,
  validateSilenceReductionPlan,
} from "../dist-electron/shared/domain/index.js";

function analysisFixture() {
  return createAudioAnalysis({
    analyzedAt: "2026-07-10T10:00:00.000Z",
    sourceKey: "a".repeat(64),
    durationUs: 10_000_000,
    thresholdDb: -35,
    minSilenceUs: 500_000,
    segments: [
      { startUs: 1_000_000, endUs: 3_000_000 },
      { startUs: 2_500_000, endUs: 4_000_000 },
      { startUs: 8_000_000, endUs: 10_000_000 },
    ],
  });
}

test("fusiona silencios superpuestos y calcula métricas", () => {
  const analysis = analysisFixture();

  assert.equal(analysis.segments.length, 2);
  assert.deepEqual(
    analysis.segments.map((segment) => [segment.startUs, segment.endUs]),
    [
      [1_000_000, 4_000_000],
      [8_000_000, 10_000_000],
    ],
  );
  assert.equal(analysis.silenceDurationUs, 5_000_000);
  assert.equal(analysis.audibleDurationUs, 5_000_000);
  assert.equal(analysis.silenceRatio, 0.5);
});

test("acorta cada silencio conservando 300 ms", () => {
  const plan = createSilenceReductionPlan({
    analysis: analysisFixture(),
    settings: {
      mode: "shorten",
      targetSilenceUs: 300_000,
      edgePaddingUs: 80_000,
    },
  });

  assert.equal(plan.mode, "shorten");
  assert.equal(plan.removedDurationUs, 4_400_000);
  assert.equal(plan.outputDurationUs, 5_600_000);
  assert.equal(plan.retainedSilenceUs, 600_000);
  assert.ok(plan.keepRanges.length >= 2);
  assert.deepEqual(validateSilenceReductionPlan(plan), plan);
});

test("elimina silencios conservando únicamente márgenes de seguridad", () => {
  const plan = createSilenceReductionPlan({
    analysis: analysisFixture(),
    settings: {
      mode: "remove",
      targetSilenceUs: 0,
      edgePaddingUs: 80_000,
    },
  });

  assert.equal(plan.mode, "remove");
  assert.equal(plan.retainedSilenceUs, 320_000);
  assert.equal(plan.removedDurationUs, 4_680_000);
  assert.equal(plan.outputDurationUs, 5_320_000);
});

test("un archivo completamente silencioso conserva contenido mínimo", () => {
  const analysis = createAudioAnalysis({
    sourceKey: "b".repeat(64),
    durationUs: 5_000_000,
    thresholdDb: -40,
    minSilenceUs: 200_000,
    segments: [{ startUs: 0, endUs: 5_000_000 }],
  });
  const plan = createSilenceReductionPlan({
    analysis,
    settings: {
      mode: "remove",
      targetSilenceUs: 0,
      edgePaddingUs: 100_000,
    },
  });

  assert.equal(plan.outputDurationUs, 200_000);
  assert.equal(plan.keepRanges.length, 2);
  assert.ok(plan.keepRanges.every((range) => range.durationUs === 100_000));
});

test("rechaza configuración y segmentos fuera de rango", () => {
  assert.throws(() =>
    createAudioAnalysis({
      sourceKey: "c".repeat(64),
      durationUs: 2_000_000,
      thresholdDb: -35,
      minSilenceUs: 500_000,
      segments: [{ startUs: 1_000_000, endUs: 3_000_000 }],
    }),
  );
  assert.throws(() =>
    createSilenceReductionPlan({
      analysis: analysisFixture(),
      settings: {
        mode: "shorten",
        targetSilenceUs: 0,
        edgePaddingUs: 80_000,
      },
    }),
  );
});
