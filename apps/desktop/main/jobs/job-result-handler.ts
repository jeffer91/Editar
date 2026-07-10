/* =========================================================
Nombre completo: job-result-handler.ts
Ruta o ubicación: /apps/desktop/main/jobs/job-result-handler.ts

Función o funciones:
- Definir cómo aplicar resultados persistentes de trabajos.
- Separar la ejecución del Worker de las actualizaciones SQLite.
- Permitir preparar reintentos y registrar fallos definitivos.
========================================================= */

import type {
  JobErrorInfo,
  JobRecord,
  JsonValue,
} from "../../shared/domain/index.js";

interface JobResultHandler {
  complete(
    job: JobRecord,
    result: Readonly<Record<string, JsonValue>> | undefined,
  ): Promise<void>;
  fail(job: JobRecord, error: JobErrorInfo): Promise<void>;
  prepareRetry(job: JobRecord): Promise<void>;
}

class NoopJobResultHandler implements JobResultHandler {
  async complete(): Promise<void> {}
  async fail(): Promise<void> {}
  async prepareRetry(): Promise<void> {}
}

export {
  NoopJobResultHandler,
  type JobResultHandler,
};
