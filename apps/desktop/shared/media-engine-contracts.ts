/* =========================================================
Nombre completo: media-engine-contracts.ts
Ruta o ubicación: /apps/desktop/shared/media-engine-contracts.ts

Función o funciones:
- Definir el estado público de FFmpeg y FFprobe.
- Modelar solicitudes de análisis técnico de medios.
- Compartir resultados seguros entre main, preload y renderer.
========================================================= */

import type { EntityId } from "./domain/index.js";

type MediaToolName = "ffmpeg" | "ffprobe";
type MediaToolSource =
  | "environment"
  | "packaged"
  | "application"
  | "workspace"
  | "path"
  | "unavailable";

interface MediaToolStatus {
  readonly name: MediaToolName;
  readonly available: boolean;
  readonly command: string | null;
  readonly source: MediaToolSource;
  readonly version: string | null;
  readonly error: string | null;
  readonly checkedAt: string;
}

interface MediaEngineStatus {
  readonly ready: boolean;
  readonly ffmpeg: MediaToolStatus;
  readonly ffprobe: MediaToolStatus;
  readonly checkedAt: string;
}

interface AnalyzeMediaInput {
  readonly projectId: EntityId<"project">;
  readonly mediaId: EntityId<"media">;
}

interface MediaAnalysisRequestResult {
  readonly queued: boolean;
  readonly jobId: EntityId<"job"> | null;
  readonly message: string;
}

export {
  type AnalyzeMediaInput,
  type MediaAnalysisRequestResult,
  type MediaEngineStatus,
  type MediaToolName,
  type MediaToolSource,
  type MediaToolStatus,
};
