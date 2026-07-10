/* =========================================================
Nombre completo: media-cache-paths.test.mjs
Ruta o ubicación: /tests/media-cache-paths.test.mjs

Función o funciones:
- Probar rutas deterministas y temporales de la caché.
- Rechazar traversal y rutas externas.
- Verificar escaneo, tamaños y limpieza de temporales.
========================================================= */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  createEntityId,
} from "../dist-electron/shared/domain/index.js";
import {
  MediaCachePathError,
  MediaCachePaths,
  isTemporaryCacheFile,
} from "../dist-electron/main/media/media-cache-paths.js";

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-cache-paths-"));
  const cache = new MediaCachePaths(join(root, "cache", "media"));
  await cache.ensureRoot();

  return {
    root,
    cache,
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("genera rutas deterministas dentro del directorio administrado", async () => {
  const context = await createContext();

  try {
    const projectId = createEntityId("project");
    const mediaId = createEntityId("media");
    const cacheKey = "a".repeat(64);
    const first = context.cache.resolveDerivativePath(
      projectId,
      mediaId,
      "proxy",
      cacheKey,
    );
    const second = context.cache.resolveDerivativePath(
      projectId,
      mediaId,
      "proxy",
      cacheKey,
    );
    const temporary = context.cache.resolveTemporaryPath(
      first,
      createEntityId("job"),
    );

    assert.equal(first, second);
    assert.equal(context.cache.isManagedPath(first), true);
    assert.equal(first.endsWith(".mp4"), true);
    assert.equal(temporary.endsWith(".mp4"), true);
    assert.equal(isTemporaryCacheFile(temporary), true);
  } finally {
    await context.cleanup();
  }
});

test("rechaza rutas externas y el directorio raíz", async () => {
  const context = await createContext();

  try {
    assert.throws(
      () => context.cache.assertManagedPath(join(context.root, "fuera.mp4")),
      (error) => error instanceof MediaCachePathError,
    );
    assert.throws(
      () => context.cache.assertManagedPath(context.cache.rootPath),
      (error) => error instanceof MediaCachePathError,
    );
  } finally {
    await context.cleanup();
  }
});

test("escanea archivos, suma tamaños y elimina temporales", async () => {
  const context = await createContext();

  try {
    const output = context.cache.resolveDerivativePath(
      createEntityId("project"),
      createEntityId("media"),
      "thumbnail",
      "b".repeat(64),
    );
    const temporary = context.cache.resolveTemporaryPath(
      output,
      createEntityId("job"),
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, Buffer.alloc(25, 1));
    await writeFile(temporary, Buffer.alloc(10, 2));

    const before = await context.cache.scan();

    assert.equal(before.files.length, 2);
    assert.equal(before.totalBytes, 35);
    assert.equal(before.temporaryFileCount, 1);
    assert.equal(await context.cache.removeTemporaryFiles(), 1);

    const after = await context.cache.scan();
    assert.equal(after.files.length, 1);
    assert.equal(after.totalBytes, 25);
    assert.equal(await context.cache.exists(output), true);
  } finally {
    await context.cleanup();
  }
});
