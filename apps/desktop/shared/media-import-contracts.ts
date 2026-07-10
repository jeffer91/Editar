/* =========================================================
Nombre completo: media-import-contracts.ts
Ruta o ubicación: /apps/desktop/shared/media-import-contracts.ts

Función o funciones:
- Definir contratos públicos para importar archivos multimedia.
- Compartir resultados entre main, preload y renderer.
- Mantener rutas y procesamiento fuera de la interfaz React.
========================================================= */

import type {
  EntityId,
  MediaAsset,
  MediaKind,
  ProjectDocument,
} from "./domain/index.js";
import type { IpcResult } from "./ipc-contracts.js";

interface ImportMediaInput {
  readonly projectId: EntityId<"project">;
}

interface MediaImportDuplicate {
  readonly fileName: string;
  readonly sourcePath: string;
  readonly existingMediaId: EntityId<"media">;
  readonly contentHash: string;
}

interface MediaImportRejection {
  readonly fileName: string;
  readonly sourcePath: string;
  readonly code:
    | "UNSUPPORTED_EXTENSION"
    | "INVALID_SIGNATURE"
    | "NOT_A_FILE"
    | "EMPTY_FILE"
    | "FILE_UNAVAILABLE"
    | "TOO_MANY_FILES"
    | "READ_ERROR";
  readonly message: string;
}

interface MediaImportSummary {
  readonly canceled: boolean;
  readonly selectedCount: number;
  readonly importedCount: number;
  readonly duplicateCount: number;
  readonly rejectedCount: number;
  readonly importedByKind: Readonly<Record<MediaKind, number>>;
}

interface MediaImportResult {
  readonly project: ProjectDocument;
  readonly imported: readonly MediaAsset[];
  readonly duplicates: readonly MediaImportDuplicate[];
  readonly rejected: readonly MediaImportRejection[];
  readonly summary: MediaImportSummary;
}

interface MediaImportBridge {
  chooseAndImport(input: ImportMediaInput): Promise<IpcResult<MediaImportResult>>;
}

export {
  type ImportMediaInput,
  type MediaImportBridge,
  type MediaImportDuplicate,
  type MediaImportRejection,
  type MediaImportResult,
  type MediaImportSummary,
};
