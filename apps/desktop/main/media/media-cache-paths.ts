/* =========================================================
Nombre completo: media-cache-paths.ts
Ruta o ubicación: /apps/desktop/main/media/media-cache-paths.ts

Función o funciones:
- Resolver rutas deterministas dentro de la caché multimedia.
- Impedir traversal y borrados fuera del directorio administrado.
- Crear salidas, temporales y archivos auxiliares seguros.
========================================================= */

import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import {
  mkdir,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import {
  dirname,
  extname,
  join,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
import type {
  EntityId,
} from "../../shared/domain/index.js";
import type { ManagedDerivativeType } from "../../shared/media-cache-contracts.js";

interface CacheFileEntry {
  readonly path: string;
  readonly sizeBytes: number;
  readonly temporary: boolean;
  readonly modifiedAtMs: number;
}

interface CacheScanResult {
  readonly files: readonly CacheFileEntry[];
  readonly totalBytes: number;
  readonly temporaryFileCount: number;
}

const EXTENSIONS: Readonly<Record<ManagedDerivativeType, string>> = Object.freeze({
  proxy: "mp4",
  thumbnail: "jpg",
  waveform: "png",
  "silence-reduced": "mp4",
});

const SAFE_EXTENSION_PATTERN = /^[a-z0-9]{1,8}$/i;

function hashSegment(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function isTemporaryCacheFile(path: string): boolean {
  const name = parse(path).name;
  return name.includes(".partial-") || name.includes(".aux-");
}

class MediaCachePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaCachePathError";
  }
}

class MediaCachePaths {
  readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
  }

  resolveDerivativePath(
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
    type: ManagedDerivativeType,
    cacheKey: string,
    extensionOverride?: string,
  ): string {
    const extension = (extensionOverride ?? EXTENSIONS[type]).replace(/^\./, "");

    if (!SAFE_EXTENSION_PATTERN.test(extension)) {
      throw new MediaCachePathError(
        "La extensión solicitada para la caché no está permitida.",
      );
    }

    const projectSegment = hashSegment(projectId);
    const mediaSegment = hashSegment(mediaId);
    const fileName = `${type}-${cacheKey.slice(0, 40)}.${extension.toLowerCase()}`;
    const path = resolve(this.rootPath, projectSegment, mediaSegment, fileName);

    return this.assertManagedPath(path);
  }

  resolveTemporaryPath(
    outputPath: string,
    jobId: EntityId<"job">,
  ): string {
    const managedOutput = this.assertManagedPath(outputPath);
    const extension = extname(managedOutput);
    const base = managedOutput.slice(0, -extension.length);
    const temporaryPath = `${base}.partial-${hashSegment(jobId)}${extension}`;

    return this.assertManagedPath(temporaryPath);
  }

  resolveAuxiliaryPath(
    outputPath: string,
    jobId: EntityId<"job">,
    extension = "txt",
  ): string {
    const managedOutput = this.assertManagedPath(outputPath);
    const normalizedExtension = extension.replace(/^\./, "").toLowerCase();

    if (!SAFE_EXTENSION_PATTERN.test(normalizedExtension)) {
      throw new MediaCachePathError(
        "La extensión del archivo auxiliar no está permitida.",
      );
    }

    return this.assertManagedPath(
      `${managedOutput}.aux-${hashSegment(jobId)}.${normalizedExtension}`,
    );
  }

  async prepareOutput(path: string): Promise<void> {
    const managedPath = this.assertManagedPath(path);
    await mkdir(dirname(managedPath), { recursive: true });
  }

  isManagedPath(path: string): boolean {
    const candidate = resolve(path);
    const relation = relative(this.rootPath, candidate);

    return (
      relation === "" ||
      (!relation.startsWith(`..${sep}`) && relation !== ".." && !relation.startsWith(sep))
    );
  }

  assertManagedPath(path: string): string {
    const candidate = resolve(path);

    if (!this.isManagedPath(candidate) || candidate === this.rootPath) {
      throw new MediaCachePathError(
        "La ruta solicitada está fuera de la caché multimedia administrada.",
      );
    }

    return candidate;
  }

  async exists(path: string): Promise<boolean> {
    try {
      const information = await stat(this.assertManagedPath(path));
      return information.isFile() && information.size > 0;
    } catch {
      return false;
    }
  }

  async removeFile(path: string): Promise<void> {
    await rm(this.assertManagedPath(path), { force: true });
  }

  async clear(): Promise<void> {
    await rm(this.rootPath, { recursive: true, force: true });
    await this.ensureRoot();
  }

  async scan(): Promise<CacheScanResult> {
    await this.ensureRoot();
    const files: CacheFileEntry[] = [];

    await this.scanDirectory(this.rootPath, files);

    return Object.freeze({
      files: Object.freeze(files),
      totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
      temporaryFileCount: files.filter((file) => file.temporary).length,
    });
  }

  async removeTemporaryFiles(): Promise<number> {
    const scan = await this.scan();
    const temporaryFiles = scan.files.filter((file) => file.temporary);

    await Promise.allSettled(
      temporaryFiles.map((file) => this.removeFile(file.path)),
    );

    return temporaryFiles.length;
  }

  private async scanDirectory(
    directory: string,
    output: CacheFileEntry[],
  ): Promise<void> {
    let entries: Dirent[];

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirectory(path, output);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      try {
        const information = await stat(path);
        output.push(
          Object.freeze({
            path: this.assertManagedPath(path),
            sizeBytes: information.size,
            temporary: isTemporaryCacheFile(path),
            modifiedAtMs: information.mtimeMs,
          }),
        );
      } catch {
        // El archivo pudo desaparecer durante el escaneo.
      }
    }
  }
}

export {
  EXTENSIONS,
  MediaCachePathError,
  MediaCachePaths,
  SAFE_EXTENSION_PATTERN,
  hashSegment,
  isTemporaryCacheFile,
  type CacheFileEntry,
  type CacheScanResult,
};
