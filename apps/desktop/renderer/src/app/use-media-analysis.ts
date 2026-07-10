/* =========================================================
Nombre completo: use-media-analysis.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-media-analysis.ts

Función o funciones:
- Solicitar análisis técnico por identificadores seguros.
- Mantener el recurso activo, mensajes y errores.
- Compartir el estado de FFmpeg/FFprobe con el editor.
========================================================= */

import { useCallback, useState } from "react";
import type { EntityId } from "../../../shared/domain";
import { useMediaEngineStatus } from "./use-media-engine-status";

interface MediaAnalysisState {
  readonly engine: ReturnType<typeof useMediaEngineStatus>;
  readonly activeMediaId: EntityId<"media"> | null;
  readonly message: string;
  readonly errorMessage: string;
  readonly analyze: (
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
  ) => Promise<boolean>;
  readonly clearMessages: () => void;
}

function useMediaAnalysis(): MediaAnalysisState {
  const engine = useMediaEngineStatus();
  const [activeMediaId, setActiveMediaId] =
    useState<EntityId<"media"> | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const analyze = useCallback(
    async (
      projectId: EntityId<"project">,
      mediaId: EntityId<"media">,
    ): Promise<boolean> => {
      setActiveMediaId(mediaId);
      setMessage("");
      setErrorMessage("");

      try {
        const result = await window.editar.media.analyze({ projectId, mediaId });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        setMessage(result.data.message);
        return result.data.queued || result.data.jobId !== null;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No fue posible agregar el análisis a la cola.",
        );
        return false;
      } finally {
        setActiveMediaId(null);
      }
    },
    [],
  );

  return {
    engine,
    activeMediaId,
    message,
    errorMessage,
    analyze,
    clearMessages: () => {
      setMessage("");
      setErrorMessage("");
    },
  };
}

export { useMediaAnalysis, type MediaAnalysisState };
