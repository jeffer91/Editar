/* =========================================================
Nombre completo: use-job-queue.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-job-queue.ts

Función o funciones:
- Consultar periódicamente la cola persistente.
- Ejecutar acciones de diagnóstico, pausa, reanudación y cancelación.
- Mantener estados de carga, error y acción activa.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import type { EntityId } from "../../../shared/domain";
import type { JobQueueSnapshot } from "../../../shared/job-queue-contracts";

type QueueAction = "pause" | "resume" | "cancel" | "retry";

interface JobQueueState {
  readonly snapshot: JobQueueSnapshot | null;
  readonly loading: boolean;
  readonly errorMessage: string;
  readonly activeJobId: EntityId<"job"> | null;
  readonly refresh: () => Promise<void>;
  readonly enqueueDiagnostic: (
    projectId: EntityId<"project">,
  ) => Promise<boolean>;
  readonly runAction: (
    action: QueueAction,
    jobId: EntityId<"job">,
  ) => Promise<boolean>;
}

function useJobQueue(): JobQueueState {
  const [snapshot, setSnapshot] = useState<JobQueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeJobId, setActiveJobId] =
    useState<EntityId<"job"> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await window.editar.jobs.getSnapshot();

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      setSnapshot(result.data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible consultar la cola de trabajos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 750);

    return () => window.clearInterval(timer);
  }, [refresh]);

  const enqueueDiagnostic = useCallback(
    async (projectId: EntityId<"project">): Promise<boolean> => {
      try {
        setErrorMessage("");
        const result = await window.editar.jobs.enqueueDiagnostic({ projectId });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        setSnapshot(result.data.snapshot);
        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No fue posible crear el diagnóstico.",
        );
        return false;
      }
    },
    [],
  );

  const runAction = useCallback(
    async (
      action: QueueAction,
      jobId: EntityId<"job">,
    ): Promise<boolean> => {
      setActiveJobId(jobId);
      setErrorMessage("");

      try {
        const result = await window.editar.jobs[action]({ jobId });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        setSnapshot(result.data.snapshot);
        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No fue posible modificar el trabajo.",
        );
        return false;
      } finally {
        setActiveJobId(null);
      }
    },
    [],
  );

  return {
    snapshot,
    loading,
    errorMessage,
    activeJobId,
    refresh,
    enqueueDiagnostic,
    runAction,
  };
}

export {
  useJobQueue,
  type JobQueueState,
  type QueueAction,
};
