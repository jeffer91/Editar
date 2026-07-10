/* =========================================================
Nombre completo: use-audio-processing.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-audio-processing.ts

Función o funciones:
- Solicitar análisis acústico y reducción de silencios.
- Mantener operación activa, mensajes y errores.
- Enviar únicamente identificadores y parámetros limitados.
========================================================= */

import { useCallback, useState } from "react";
import type {
  EntityId,
  SilenceReductionMode,
} from "../../../shared/domain";
import type {
  AudioAnalysisRequestResult,
  SilenceReductionRequestResult,
} from "../../../shared/audio-processing-contracts";

type AudioOperation = "analysis" | "reduction";

interface AudioProcessingState {
  readonly activeMediaId: EntityId<"media"> | null;
  readonly operation: AudioOperation | null;
  readonly message: string;
  readonly errorMessage: string;
  readonly analyze: (
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
    thresholdDb?: number,
    minSilenceMs?: number,
  ) => Promise<AudioAnalysisRequestResult | null>;
  readonly reduce: (
    projectId: EntityId<"project">,
    mediaId: EntityId<"media">,
    mode: SilenceReductionMode,
    targetSilenceMs?: number,
    edgePaddingMs?: number,
  ) => Promise<SilenceReductionRequestResult | null>;
  readonly clearMessages: () => void;
}

function useAudioProcessing(): AudioProcessingState {
  const [activeMediaId, setActiveMediaId] =
    useState<EntityId<"media"> | null>(null);
  const [operation, setOperation] = useState<AudioOperation | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const analyze = useCallback(
    async (
      projectId: EntityId<"project">,
      mediaId: EntityId<"media">,
      thresholdDb = -35,
      minSilenceMs = 500,
    ): Promise<AudioAnalysisRequestResult | null> => {
      setActiveMediaId(mediaId);
      setOperation("analysis");
      setMessage("");
      setErrorMessage("");

      try {
        const result = await window.editar.media.analyzeAudio({
          projectId,
          mediaId,
          thresholdDb,
          minSilenceMs,
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
            : "No fue posible analizar los silencios del audio.",
        );
        return null;
      } finally {
        setActiveMediaId(null);
        setOperation(null);
      }
    },
    [],
  );

  const reduce = useCallback(
    async (
      projectId: EntityId<"project">,
      mediaId: EntityId<"media">,
      mode: SilenceReductionMode,
      targetSilenceMs = 300,
      edgePaddingMs = 80,
    ): Promise<SilenceReductionRequestResult | null> => {
      setActiveMediaId(mediaId);
      setOperation("reduction");
      setMessage("");
      setErrorMessage("");

      try {
        const result = await window.editar.media.reduceSilence({
          projectId,
          mediaId,
          mode,
          targetSilenceMs,
          edgePaddingMs,
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
            : "No fue posible crear la versión con silencios reducidos.",
        );
        return null;
      } finally {
        setActiveMediaId(null);
        setOperation(null);
      }
    },
    [],
  );

  return {
    activeMediaId,
    operation,
    message,
    errorMessage,
    analyze,
    reduce,
    clearMessages: () => {
      setMessage("");
      setErrorMessage("");
    },
  };
}

export {
  useAudioProcessing,
  type AudioOperation,
  type AudioProcessingState,
};
