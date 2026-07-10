/* =========================================================
Nombre completo: ffprobe-parser.test.mjs
Ruta o ubicación: /tests/ffprobe-parser.test.mjs

Función o funciones:
- Probar metadatos de video, audio e imagen.
- Verificar tasas racionales y duración en microsegundos.
- Rechazar respuestas incompletas o inválidas.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FfprobeParseError,
  parseFfprobeMetadata,
  parseFrameRate,
} from "../dist-electron/main/media/ffprobe-parser.js";

const videoProbe = {
  streams: [
    {
      index: 0,
      codec_name: "h264",
      codec_type: "video",
      width: 1920,
      height: 1080,
      avg_frame_rate: "30000/1001",
      r_frame_rate: "30000/1001",
      bit_rate: "5200000",
      disposition: { attached_pic: 0 },
    },
    {
      index: 1,
      codec_name: "aac",
      codec_type: "audio",
      sample_rate: "48000",
      channels: 2,
      bit_rate: "192000",
    },
  ],
  format: {
    duration: "12.345",
    bit_rate: "5400000",
  },
};

const audioProbe = {
  streams: [
    {
      codec_name: "flac",
      codec_type: "audio",
      sample_rate: "44100",
      channels: 2,
      duration: "7.5",
    },
  ],
  format: { duration: "7.5" },
};

const imageProbe = {
  streams: [
    {
      codec_name: "png",
      codec_type: "video",
      width: 1600,
      height: 900,
      disposition: { attached_pic: 0 },
    },
  ],
  format: {},
};

test("interpreta video con audio y FPS racional", () => {
  const metadata = parseFfprobeMetadata(videoProbe, "video");

  assert.equal(metadata.kind, "video");
  assert.equal(metadata.durationUs, 12_345_000);
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  assert.deepEqual(metadata.frameRate, {
    numerator: 30_000,
    denominator: 1_001,
  });
  assert.equal(metadata.videoCodec, "h264");
  assert.equal(metadata.bitRate, 5_200_000);
  assert.equal(metadata.audio.codec, "aac");
  assert.equal(metadata.audio.sampleRate, 48_000);
  assert.equal(metadata.audio.channels, 2);
});

test("interpreta un archivo de audio", () => {
  const metadata = parseFfprobeMetadata(JSON.stringify(audioProbe), "audio");

  assert.equal(metadata.kind, "audio");
  assert.equal(metadata.durationUs, 7_500_000);
  assert.equal(metadata.audio.codec, "flac");
  assert.equal(metadata.audio.sampleRate, 44_100);
});

test("interpreta una imagen sin exigir duración", () => {
  const metadata = parseFfprobeMetadata(imageProbe, "image");

  assert.deepEqual(metadata, {
    kind: "image",
    width: 1600,
    height: 900,
    imageCodec: "png",
  });
});

test("prefiere video real sobre portada adjunta", () => {
  const metadata = parseFfprobeMetadata(
    {
      streams: [
        {
          codec_name: "mjpeg",
          codec_type: "video",
          width: 400,
          height: 400,
          disposition: { attached_pic: 1 },
        },
        ...videoProbe.streams,
      ],
      format: videoProbe.format,
    },
    "video",
  );

  assert.equal(metadata.width, 1920);
  assert.equal(metadata.videoCodec, "h264");
});

test("rechaza video sin duración", () => {
  assert.throws(
    () =>
      parseFfprobeMetadata(
        {
          streams: [videoProbe.streams[0]],
          format: {},
        },
        "video",
      ),
    (error) =>
      error instanceof FfprobeParseError &&
      error.code === "DURATION_UNAVAILABLE",
  );
});

test("rechaza una tasa de cuadros inválida", () => {
  assert.equal(parseFrameRate("0/0"), null);
  assert.throws(
    () =>
      parseFfprobeMetadata(
        {
          streams: [
            {
              ...videoProbe.streams[0],
              avg_frame_rate: "0/0",
              r_frame_rate: "N/A",
            },
          ],
          format: videoProbe.format,
        },
        "video",
      ),
    (error) =>
      error instanceof FfprobeParseError &&
      error.code === "FRAME_RATE_UNAVAILABLE",
  );
});

test("rechaza JSON corrupto y errores reportados", () => {
  assert.throws(
    () => parseFfprobeMetadata("{", "video"),
    (error) =>
      error instanceof FfprobeParseError && error.code === "INVALID_JSON",
  );
  assert.throws(
    () =>
      parseFfprobeMetadata(
        { error: { string: "Invalid data found when processing input" } },
        "video",
      ),
    (error) =>
      error instanceof FfprobeParseError &&
      error.code === "FFPROBE_REPORTED_ERROR",
  );
});
