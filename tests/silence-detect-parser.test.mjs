/* =========================================================
Nombre completo: silence-detect-parser.test.mjs
Ruta o ubicación: /tests/silence-detect-parser.test.mjs

Función o funciones:
- Probar eventos normales de silencedetect.
- Cerrar silencios abiertos al inicio y al final.
- Ignorar líneas ajenas y rechazar duraciones inválidas.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SilenceDetectionParseError,
  parseSilenceDetection,
  parseSilenceSegments,
  secondsToMicroseconds,
} from "../dist-electron/main/media/silence-detect-parser.js";

const normalLog = `
[silencedetect @ 0x1] silence_start: 1.25
[silencedetect @ 0x1] silence_end: 3.5 | silence_duration: 2.25
frame=100
[silencedetect @ 0x1] silence_start: 7
[silencedetect @ 0x1] silence_end: 9.125 | silence_duration: 2.125
`;

test("interpreta pares silence_start y silence_end", () => {
  const segments = parseSilenceSegments(normalLog, 10_000_000);

  assert.deepEqual(segments, [
    { startUs: 1_250_000, endUs: 3_500_000 },
    { startUs: 7_000_000, endUs: 9_125_000 },
  ]);
});

test("cierra silencio sin inicio desde cero", () => {
  const segments = parseSilenceSegments(
    "[silencedetect] silence_end: 2.5 | silence_duration: 2.5",
    5_000_000,
  );

  assert.deepEqual(segments, [{ startUs: 0, endUs: 2_500_000 }]);
});

test("cierra silencio abierto al final del recurso", () => {
  const segments = parseSilenceSegments(
    "[silencedetect] silence_start: 4.25",
    6_000_000,
  );

  assert.deepEqual(segments, [{ startUs: 4_250_000, endUs: 6_000_000 }]);
});

test("construye un análisis completo con métricas", () => {
  const analysis = parseSilenceDetection({
    stderr: normalLog,
    durationUs: 10_000_000,
    thresholdDb: -35,
    minSilenceUs: 500_000,
    sourceKey: "d".repeat(64),
    analyzedAt: "2026-07-10T10:00:00.000Z",
  });

  assert.equal(analysis.segments.length, 2);
  assert.equal(analysis.silenceDurationUs, 4_375_000);
  assert.equal(analysis.audibleDurationUs, 5_625_000);
  assert.equal(analysis.thresholdDb, -35);
});

test("ignora líneas malformadas y limita eventos a la duración", () => {
  const segments = parseSilenceSegments(
    `
      silence_start: texto
      silence_end: -1
      silence_start: 8
      silence_end: 99
    `,
    10_000_000,
  );

  assert.deepEqual(segments, [{ startUs: 8_000_000, endUs: 10_000_000 }]);
  assert.equal(secondsToMicroseconds("1.234567"), 1_234_567);
  assert.equal(secondsToMicroseconds("texto"), null);
});

test("rechaza duración inválida", () => {
  assert.throws(
    () => parseSilenceSegments(normalLog, 0),
    (error) =>
      error instanceof SilenceDetectionParseError &&
      error.code === "INVALID_DURATION",
  );
});
