/* =========================================================
Nombre completo: media-cache-protocol.ts
Ruta o ubicación: /apps/desktop/main/media/media-cache-protocol.ts

Función o funciones:
- Registrar un protocolo interno para miniaturas, ondas y proxies.
- Resolver identificadores contra SQLite sin aceptar rutas del renderer.
- Servir únicamente archivos existentes dentro de la caché administrada.
========================================================= */

import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";
import {
  DomainValidationError,
  parseEntityId,
} from "../../shared/domain/index.js";
import type { MediaAssetRepository } from "../../shared/persistence/media-asset-repository.js";
import { MediaCachePaths } from "./media-cache-paths.js";

const MEDIA_CACHE_SCHEME = "editar-cache";

function registerMediaCacheScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_CACHE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: false,
      },
    },
  ]);
}

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function registerMediaCacheProtocol(options: {
  readonly media: MediaAssetRepository;
  readonly paths: MediaCachePaths;
}): Promise<void> {
  try {
    protocol.unhandle(MEDIA_CACHE_SCHEME);
  } catch {
    // No existe un manejador anterior.
  }

  protocol.handle(MEDIA_CACHE_SCHEME, async (request) => {
    let url: URL;

    try {
      url = new URL(request.url);
    } catch {
      return textResponse(400, "Solicitud de caché inválida.");
    }

    if (url.hostname !== "derivative") {
      return textResponse(404, "Recurso no encontrado.");
    }

    const rawId = decodeURIComponent(url.pathname.replace(/^\//, ""));
    let derivativeId;

    try {
      derivativeId = parseEntityId(rawId, "derivative");
    } catch (error) {
      if (error instanceof DomainValidationError) {
        return textResponse(400, "Identificador de derivado inválido.");
      }

      throw error;
    }

    const assets = await options.media.listAll();
    const derivative = assets
      .flatMap((asset) => asset.derivatives)
      .find((candidate) => candidate.id === derivativeId);

    if (
      !derivative ||
      !options.paths.isManagedPath(derivative.path) ||
      !(await options.paths.exists(derivative.path))
    ) {
      return textResponse(404, "El archivo derivado no está disponible.");
    }

    return net.fetch(pathToFileURL(options.paths.assertManagedPath(derivative.path)).href);
  });
}

export {
  MEDIA_CACHE_SCHEME,
  registerMediaCacheProtocol,
  registerMediaCacheScheme,
};
