/* =========================================================
Nombre completo: use-media-engine-status.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-media-engine-status.ts

Función o funciones:
- Consultar el estado real de FFmpeg y FFprobe.
- Mantener carga, error y actualización manual.
- Reutilizar el diagnóstico en Editor y Ajustes.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import type { MediaEngineStatus } from "../../../shared/media-engine-contracts";

interface MediaEngineState {
  readonly status: MediaEngineStatus | null;
  readonly loading: boolean;
  readonly errorMessage: string;
  readonly refresh: () => Promise<void>;
}

function useMediaEngineStatus(): MediaEngineState {
  const [status, setStatus] = useState<MediaEngineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const result = await window.editar.media.getEngineStatus();

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      setStatus(result.data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible comprobar FFmpeg y FFprobe.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, errorMessage, refresh };
}

export { useMediaEngineStatus, type MediaEngineState };
