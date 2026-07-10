/* =========================================================
Nombre completo: job-executor.ts
Ruta o ubicación: /apps/desktop/main/jobs/job-executor.ts

Función o funciones:
- Definir el contrato de ejecución fuera del scheduler.
- Separar la cola de la tecnología concreta del trabajador.
- Permitir incorporar FFmpeg, Whisper u otros motores después.
========================================================= */

import type {
  JobKind,
  JobRecord,
  JsonValue,
} from "../../shared/domain/index.js";

interface JobExecutionResult {
  readonly result?: Readonly<Record<string, JsonValue>>;
}

type JobProgressReporter = (progress: number) => Promise<void> | void;

interface JobExecutor {
  readonly online: boolean;
  supports(kind: JobKind): boolean;
  execute(
    job: JobRecord,
    reportProgress: JobProgressReporter,
    signal: AbortSignal,
  ): Promise<JobExecutionResult>;
  close(): Promise<void>;
}

export {
  type JobExecutionResult,
  type JobExecutor,
  type JobProgressReporter,
};
