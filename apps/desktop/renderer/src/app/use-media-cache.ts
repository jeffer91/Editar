/* =========================================================
Nombre completo: use-media-cache.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-media-cache.ts

Función o funciones:
- Consultar y limpiar la caché multimedia.
- Solicitar derivados por identificadores seguros.
- Mantener mensajes, errores y operaciones activas.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import type { EntityId } from "../../../shared/domain";
import type {
  MediaCacheClearResult,
  MediaCacheStatus,
  MediaDerivativeRequestResult,
} from "../../../shared/media-cache-contracts";

interface MediaCacheState {
  readonly status: MediaCacheStatus | null;
  readonly loading: boolean;
  readonly clearing: boolean;
  readonly activeMediaId: EntityId<"media"> | null;
  readonly message: string;
  readonly errorMessage: string;
  readonly lastClearResult: MediaCacheClearResult | null;
  readonly refresh: () => Promise<void>;
  readonly generate: (
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
  ) => Promise<MediaDerivativeRequestResult | null>;
  readonly clear: () => Promise<boolean>;
  readonly clearMessages: () => void;
}

function useMediaCache(loadOnMount = true): MediaCacheState {
  const [status, setStatus] = useState<MediaCacheStatus | null>(null);
  const [loading, setLoading] = useState(loadOnMount);
  const [clearing, setClearing] = useState(false);
  const [activeMediaId, setActiveMediaId] =
    useState<EntityId<"media"> | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastClearResult, setLastClearResult] =
    useState<MediaCacheClearResult | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const result = await window.editar.media.getCacheStatus();

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      setStatus(result.data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible consultar la caché multimedia.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadOnMount) {
      void refresh();
    }
  }, [loadOnMount, refresh]);

  const generate = useCallback(
    async (
      projectId: EntityId<"project">,
      mediaId: EntityId<"media">,
    ): Promise<MediaDerivativeRequestResult | null> => {
      setActiveMediaId(mediaId);
      setMessage("");
      setErrorMessage("");

      try {
        const result = await window.editar.media.generateDerivatives({
          projectId,
          mediaId,
        });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        setMessage(result.data.message);
        return result.data;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No fue posible generar los archivos optimizados.",
        );
        return null;
      } finally {
        setActiveMediaId(null);
      }
    },
    [],
  );

  const clear = useCallback(async (): Promise<boolean> => {
    setClearing(true);
    setMessage("");
    setErrorMessage("");

    try {
      const result = await window.editar.media.clearCache();

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      setStatus(result.data.status);
      setLastClearResult(result.data);
      setMessage(
        `${result.data.removedFiles} archivo${result.data.removedFiles === 1 ? "" : "s"} eliminado${result.data.removedFiles === 1 ? "" : "s"} de la caché.`,
      );
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible limpiar la caché multimedia.",
      );
      return false;
    } finally {
      setClearing(false);
    }
  }, []);

  return {
    status,
    loading,
    clearing,
    activeMediaId,
    message,
    errorMessage,
    lastClearResult,
    refresh,
    generate,
    clear,
    clearMessages: () => {
      setMessage("");
      setErrorMessage("");
    },
  };
}

export { useMediaCache, type MediaCacheState };
