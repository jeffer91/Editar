/* =========================================================
Nombre completo: ProjectFormDialog.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/projects/ProjectFormDialog.tsx

Función o funciones:
- Crear formularios modales para crear, renombrar o duplicar.
- Validar el nombre antes de enviar la operación.
- Permitir seleccionar el formato inicial de proyectos nuevos.
========================================================= */

import { useEffect, useId, useState } from "react";
import type { ProjectCanvasPreset } from "../../../../shared/project-management-contracts";
import { AppIcon } from "../ui/AppIcon";

type ProjectFormMode = "create" | "rename" | "duplicate";

interface ProjectFormDialogProps {
  readonly open: boolean;
  readonly mode: ProjectFormMode;
  readonly initialName?: string;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (
    name: string,
    preset: ProjectCanvasPreset,
  ) => Promise<void>;
}

const presetOptions: readonly {
  readonly value: ProjectCanvasPreset;
  readonly label: string;
  readonly resolution: string;
  readonly ratio: string;
}[] = Object.freeze([
  {
    value: "horizontal",
    label: "Horizontal",
    resolution: "1920 × 1080",
    ratio: "16:9",
  },
  {
    value: "vertical",
    label: "Vertical",
    resolution: "1080 × 1920",
    ratio: "9:16",
  },
  {
    value: "square",
    label: "Cuadrado",
    resolution: "1080 × 1080",
    ratio: "1:1",
  },
  {
    value: "portrait",
    label: "Retrato",
    resolution: "1080 × 1350",
    ratio: "4:5",
  },
]);

const dialogLabels: Readonly<
  Record<
    ProjectFormMode,
    {
      readonly title: string;
      readonly description: string;
      readonly action: string;
    }
  >
> = Object.freeze({
  create: {
    title: "Crear proyecto",
    description: "Define un nombre y el formato inicial del lienzo.",
    action: "Crear proyecto",
  },
  rename: {
    title: "Renombrar proyecto",
    description: "El cambio se guardará y generará un snapshot.",
    action: "Guardar nombre",
  },
  duplicate: {
    title: "Duplicar proyecto",
    description: "Se copiará el contenido, pero no los trabajos de procesamiento.",
    action: "Crear copia",
  },
});

function ProjectFormDialog({
  open,
  mode,
  initialName = "",
  busy,
  onClose,
  onSubmit,
}: ProjectFormDialogProps): React.JSX.Element | null {
  const titleId = useId();
  const [name, setName] = useState(initialName);
  const [preset, setPreset] = useState<ProjectCanvasPreset>("horizontal");
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPreset("horizontal");
      setValidationMessage("");
    }
  }, [initialName, open]);

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

  const labels = dialogLabels[mode];

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const normalized = name.replace(/\s+/g, " ").trim();

    if (!normalized) {
      setValidationMessage("Escribe un nombre para el proyecto.");
      return;
    }

    if (normalized.length > 120) {
      setValidationMessage("El nombre no puede superar 120 caracteres.");
      return;
    }

    setValidationMessage("");
    await onSubmit(normalized, preset);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="project-dialog__header">
          <div>
            <span className="section-label">GESTIÓN DE PROYECTOS</span>
            <h2 id={titleId}>{labels.title}</h2>
            <p>{labels.description}</p>
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

        <form className="project-dialog__form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field-group">
            <span>Nombre del proyecto</span>
            <input
              autoFocus
              type="text"
              value={name}
              maxLength={120}
              placeholder="Ejemplo: Video institucional julio"
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
            <small>{name.length}/120 caracteres</small>
          </label>

          {mode === "create" ? (
            <fieldset className="preset-fieldset">
              <legend>Formato inicial</legend>
              <div className="preset-grid">
                {presetOptions.map((option) => (
                  <label
                    className={`preset-option ${
                      preset === option.value ? "preset-option--selected" : ""
                    }`}
                    key={option.value}
                  >
                    <input
                      type="radio"
                      name="project-preset"
                      value={option.value}
                      checked={preset === option.value}
                      onChange={() => setPreset(option.value)}
                      disabled={busy}
                    />
                    <span className={`preset-option__shape preset-option__shape--${option.value}`} />
                    <span>
                      <strong>{option.label}</strong>
                      <small>
                        {option.ratio} · {option.resolution}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {validationMessage ? (
            <p className="form-error" role="alert">
              {validationMessage}
            </p>
          ) : null}

          <footer className="project-dialog__actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Procesando..." : labels.action}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export { ProjectFormDialog, type ProjectFormDialogProps, type ProjectFormMode };
