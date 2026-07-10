/* =========================================================
Nombre completo: ConfirmProjectDialog.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/projects/ConfirmProjectDialog.tsx

Función o funciones:
- Solicitar confirmación antes de operaciones destructivas.
- Mostrar claramente el proyecto afectado.
- Evitar eliminaciones accidentales durante una operación activa.
========================================================= */

import { useEffect, useId } from "react";
import { AppIcon } from "../ui/AppIcon";

interface ConfirmProjectDialogProps {
  readonly open: boolean;
  readonly projectName: string;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => Promise<void>;
}

function ConfirmProjectDialog({
  open,
  projectName,
  busy,
  onClose,
  onConfirm,
}: ConfirmProjectDialogProps): React.JSX.Element | null {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-dialog project-dialog--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="project-dialog__header">
          <div>
            <span className="section-label">ACCIÓN IRREVERSIBLE</span>
            <h2 id={titleId}>Eliminar proyecto</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={busy}
          >
            <AppIcon name="close" />
          </button>
        </header>

        <div className="confirm-dialog__body">
          <span className="confirm-dialog__icon">
            <AppIcon name="projects" size={28} />
          </span>
          <p>
            Se eliminarán <strong>{projectName}</strong>, sus clips, recursos,
            efectos, trabajos y snapshots. Los videos originales no se borrarán.
          </p>
        </div>

        <footer className="project-dialog__actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Conservar proyecto
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? "Eliminando..." : "Eliminar definitivamente"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export { ConfirmProjectDialog, type ConfirmProjectDialogProps };
