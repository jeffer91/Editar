/* =========================================================
Nombre completo: ffmpeg-binary-service.test.mjs
Ruta o ubicación: /tests/ffmpeg-binary-service.test.mjs

Función o funciones:
- Probar prioridad de variables de entorno y recursos locales.
- Verificar fallback a PATH y caché del diagnóstico.
- Confirmar estado controlado cuando no existen ejecutables.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FfmpegBinaryService,
  MediaToolUnavailableError,
} from "../dist-electron/main/media/ffmpeg-binary-service.js";

function createOptions(versionRunner, environment = {}) {
  return {
    applicationPath: "/app",
    resourcesPath: "/packaged",
    workspacePath: "/workspace",
    environment,
    platform: "linux",
    timeoutMs: 1_000,
    versionRunner,
  };
}

test("prioriza rutas configuradas por variables de entorno", async () => {
  const calls = [];
  const service = new FfmpegBinaryService(
    createOptions(
      async (candidate) => {
        calls.push(candidate.command);
        return candidate.command.startsWith("/custom/")
          ? { ok: true, version: `${candidate.command} version 7.1` }
          : { ok: false, error: "no encontrado" };
      },
      {
        EDITAR_FFMPEG_PATH: "/custom/ffmpeg",
        EDITAR_FFPROBE_PATH: "/custom/ffprobe",
      },
    ),
  );

  const status = await service.getStatus();
  const probe = await service.getCommand("ffprobe");

  assert.equal(status.ready, true);
  assert.equal(status.ffmpeg.source, "environment");
  assert.equal(status.ffprobe.source, "environment");
  assert.equal(probe.command, "/custom/ffprobe");
  assert.deepEqual(probe.argumentsPrefix, []);
  assert.ok(calls.includes("/custom/ffmpeg"));
  assert.ok(calls.includes("/custom/ffprobe"));
});

test("usa recursos del proyecto antes de PATH", async () => {
  const service = new FfmpegBinaryService(
    createOptions(async (candidate) => {
      if (candidate.command.startsWith("/workspace/resources/bin/")) {
        return { ok: true, version: `${candidate.command} version 6.1` };
      }

      return { ok: false, error: "ausente" };
    }),
  );

  const status = await service.getStatus();

  assert.equal(status.ffmpeg.source, "workspace");
  assert.equal(status.ffprobe.source, "workspace");
  assert.equal(status.ffmpeg.command, "/workspace/resources/bin/ffmpeg");
});

test("recurre a PATH cuando no existen rutas locales", async () => {
  const service = new FfmpegBinaryService(
    createOptions(async (candidate) =>
      candidate.source === "path"
        ? { ok: true, version: `${candidate.command} version path` }
        : { ok: false, error: "ausente" },
    ),
  );

  const status = await service.getStatus();

  assert.equal(status.ready, true);
  assert.equal(status.ffmpeg.source, "path");
  assert.equal(status.ffprobe.source, "path");
  assert.equal((await service.getCommand("ffmpeg")).command, "ffmpeg");
});

test("informa herramientas no disponibles sin lanzar durante el diagnóstico", async () => {
  const service = new FfmpegBinaryService(
    createOptions(async () => ({ ok: false, error: "ENOENT" })),
  );

  const status = await service.getStatus();

  assert.equal(status.ready, false);
  assert.equal(status.ffmpeg.available, false);
  assert.equal(status.ffprobe.source, "unavailable");
  assert.match(status.ffprobe.error, /ENOENT/);
  await assert.rejects(
    service.getCommand("ffprobe"),
    (error) =>
      error instanceof MediaToolUnavailableError && error.tool === "ffprobe",
  );
});

test("reutiliza el diagnóstico salvo que se solicite una comprobación forzada", async () => {
  let calls = 0;
  const service = new FfmpegBinaryService(
    createOptions(async (candidate) => {
      calls += 1;
      return candidate.source === "path"
        ? { ok: true, version: "version 1" }
        : { ok: false, error: "ausente" };
    }),
  );

  const first = await service.getStatus();
  const callsAfterFirst = calls;
  const second = await service.getStatus();

  assert.equal(first, second);
  assert.equal(calls, callsAfterFirst);

  const forced = await service.getStatus(true);
  assert.notEqual(forced, first);
  assert.ok(calls > callsAfterFirst);
});
