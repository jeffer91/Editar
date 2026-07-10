/* =========================================================
Nombre completo: use-system-status.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-system-status.ts

Función o funciones:
- Consultar información del entorno mediante IPC.
- Medir la conectividad entre renderer y Electron.
- Exponer estado, latencia, error y acción de reintento.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import type { RuntimeInfo } from "../../../shared/ipc-contracts";

type ConnectionState = "checking" | "connected" | "error";

interface SystemStatus {
  readonly runtime: RuntimeInfo | null;
  readonly connectionState: ConnectionState;
  readonly latencyMs: number | null;
  readonly errorMessage: string;
  readonly checkConnection: () => Promise<void>;
}

function useSystemStatus(): SystemStatus {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const checkConnection = useCallback(async (): Promise<void> => {
    setConnectionState("checking");
    setErrorMessage("");

    const startedAt = performance.now();

    try {
      const [runtimeResult, pingResult] = await Promise.all([
        window.editar.system.getRuntimeInfo(),
        window.editar.system.ping(),
      ]);

      if (!runtimeResult.ok) {
        throw new Error(runtimeResult.error.message);
      }

      if (!pingResult.ok) {
        throw new Error(pingResult.error.message);
      }

      setRuntime(runtimeResult.data);
      setLatencyMs(Math.max(0, Math.round(performance.now() - startedAt)));
      setConnectionState("connected");
    } catch (error) {
      setRuntime(null);
      setLatencyMs(null);
      setConnectionState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible verificar la comunicación interna.",
      );
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  return {
    runtime,
    connectionState,
    latencyMs,
    errorMessage,
    checkConnection,
  };
}

export {
  useSystemStatus,
  type ConnectionState,
  type SystemStatus,
};
