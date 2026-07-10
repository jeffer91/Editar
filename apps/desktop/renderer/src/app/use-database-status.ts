/* =========================================================
Nombre completo: use-database-status.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-database-status.ts

Función o funciones:
- Consultar el estado público de SQLite mediante IPC.
- Ejecutar comprobaciones completas de integridad.
- Crear respaldos manuales y refrescar la información.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import type {
  DatabaseBackupInfo,
  DatabaseStatus,
} from "../../../shared/database-contracts";

type DatabaseOperationState =
  | "checking"
  | "ready"
  | "backing-up"
  | "error";

interface DatabaseStatusState {
  readonly status: DatabaseStatus | null;
  readonly lastCreatedBackup: DatabaseBackupInfo | null;
  readonly operationState: DatabaseOperationState;
  readonly errorMessage: string;
  readonly refresh: (fullIntegrityCheck?: boolean) => Promise<void>;
  readonly createBackup: () => Promise<void>;
}

function useDatabaseStatus(): DatabaseStatusState {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [lastCreatedBackup, setLastCreatedBackup] =
    useState<DatabaseBackupInfo | null>(null);
  const [operationState, setOperationState] =
    useState<DatabaseOperationState>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(
    async (fullIntegrityCheck = false): Promise<void> => {
      setOperationState("checking");
      setErrorMessage("");

      try {
        const result = fullIntegrityCheck
          ? await window.editar.database.checkIntegrity()
          : await window.editar.database.getStatus();

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        setStatus(result.data);
        setOperationState("ready");
      } catch (error) {
        setOperationState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No fue posible consultar la base de datos.",
        );
      }
    },
    [],
  );

  const createBackup = useCallback(async (): Promise<void> => {
    setOperationState("backing-up");
    setErrorMessage("");

    try {
      const result = await window.editar.database.createBackup();

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      setLastCreatedBackup(result.data);
      const statusResult = await window.editar.database.getStatus();

      if (!statusResult.ok) {
        throw new Error(statusResult.error.message);
      }

      setStatus(statusResult.data);
      setOperationState("ready");
    } catch (error) {
      setOperationState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible crear el respaldo.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return {
    status,
    lastCreatedBackup,
    operationState,
    errorMessage,
    refresh,
    createBackup,
  };
}

export {
  useDatabaseStatus,
  type DatabaseOperationState,
  type DatabaseStatusState,
};
