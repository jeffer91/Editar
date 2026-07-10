/* =========================================================
Nombre completo: use-media-import.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-media-import.ts

Función o funciones:
- Abrir el selector nativo mediante el bridge seguro.
- Mantener estado de importación, error y último resultado.
- Actualizar el proyecto activo después de guardar medios.
========================================================= */

import { useCallback, useState } from "react";
import type { EntityId, ProjectDocument } from "../../../shared/domain";
import type { MediaImportResult } from "../../../shared/media-import-contracts";

interface MediaImportState {
  readonly importing: boolean;
  readonly errorMessage: string;
  readonly lastResult: MediaImportResult | null;
  readonly chooseAndImport: (
    projectId: EntityId<"project">,
  ) => Promise<ProjectDocument | null>;
  readonly clearResult: () => void;
  readonly clearError: () => void;
}

function useMediaImport(): MediaImportState {
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastResult, setLastResult] = useState<MediaImportResult | null>(null);

  const chooseAndImport = useCallback(
    async (
      projectId: EntityId<"project">,
    ): Promise<ProjectDocument | null> => {
      setImporting(true);
      setErrorMessage("");

      try {
        const result = await window.editar.media.chooseAndImport({ projectId });

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        setLastResult(result.data);
        return result.data.summary.canceled ? null : result.data.project;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No fue posible importar los archivos seleccionados.";
        setErrorMessage(message);
        return null;
      } finally {
        setImporting(false);
      }
    },
    [],
  );

  return {
    importing,
    errorMessage,
    lastResult,
    chooseAndImport,
    clearResult: () => setLastResult(null),
    clearError: () => setErrorMessage(""),
  };
}

export { useMediaImport, type MediaImportState };
