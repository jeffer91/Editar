/* =========================================================
Nombre completo: audio-processing-contracts.ts
Ruta o ubicación: /apps/desktop/shared/audio-processing-contracts.ts

Función o funciones:
- Definir solicitudes de análisis y reducción de silencios.
- Compartir resultados seguros entre main, preload y renderer.
- Mantener rutas, filtros y comandos fuera de React.
========================================================= */

import type {
  EntityId,
  SilenceReductionMode,
} from "./domain/index.js";
import type { IpcResult } from "./ipc-contracts.js";

interface AnalyzeAudioInput {
  readonly projectId: EntityId<"project">;
  readonly mediaId: EntityId<"media">;
  readonly thresholdDb?: number;
  readonly minSilenceMs?: number;
}

interface AudioAnalysisRequestResult {
  readonly queued: boolean;
  readonly reused: boolean;
  readonly jobId: EntityId<"job"> | null;
  readonly message: string;
}

interface ReduceSilenceInput {
  readonly projectId: EntityId<"project">;
  readonly mediaId: EntityId<"media">;
  readonly mode?: SilenceReductionMode;
  readonly targetSilenceMs?: number;
  readonly edgePaddingMs?: number;
}

interface SilenceReductionRequestResult {
  readonly queued: boolean;
  readonly reused: boolean;
  readonly jobId: EntityId<"job"> | null;
  readonly removedDurationMs: number;
  readonly outputDurationMs: number;
  readonly cutCount: number;
  readonly message: string;
}

interface AudioProcessingBridge {
  analyzeAudio(
    input: AnalyzeAudioInput,
  ): Promise<IpcResult<AudioAnalysisRequestResult>>;
  reduceSilence(
    input: ReduceSilenceInput,
  ): Promise<IpcResult<SilenceReductionRequestResult>>;
}

export {
  type AnalyzeAudioInput,
  type AudioAnalysisRequestResult,
  type AudioProcessingBridge,
  type ReduceSilenceInput,
  type SilenceReductionRequestResult,
};
