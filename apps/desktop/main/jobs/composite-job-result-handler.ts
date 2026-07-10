/* =========================================================
Nombre completo: composite-job-result-handler.ts
Ruta o ubicación: /apps/desktop/main/jobs/composite-job-result-handler.ts

Función o funciones:
- Ejecutar varios manejadores para un mismo trabajo.
- Permitir registrar módulos antes de iniciar la cola.
- Mantener la cola independiente de medios y caché.
========================================================= */

import type {
  JobErrorInfo,
  JobRecord,
  JsonValue,
} from "../../shared/domain/index.js";
import type { JobResultHandler } from "./job-result-handler.js";

class CompositeJobResultHandler implements JobResultHandler {
  private readonly handlers: JobResultHandler[] = [];

  add(...handlers: readonly JobResultHandler[]): this {
    this.handlers.push(...handlers);
    return this;
  }

  async complete(
    job: JobRecord,
    result: Readonly<Record<string, JsonValue>> | undefined,
  ): Promise<void> {
    for (const handler of this.handlers) {
      await handler.complete(job, result);
    }
  }

  async fail(job: JobRecord, error: JobErrorInfo): Promise<void> {
    for (const handler of this.handlers) {
      await handler.fail(job, error);
    }
  }

  async prepareRetry(job: JobRecord): Promise<void> {
    for (const handler of this.handlers) {
      await handler.prepareRetry(job);
    }
  }
}

export { CompositeJobResultHandler };
