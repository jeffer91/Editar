/* =========================================================
Nombre completo: Topbar.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/layout/Topbar.tsx

Función o funciones:
- Mostrar el título y descripción de la pantalla activa.
- Exponer el botón del menú móvil.
- Presentar el estado general del sistema.
========================================================= */

import type { NavigationItem } from "../../../../shared/navigation-contracts";
import type { ConnectionState } from "../../app/use-system-status";
import { AppIcon } from "../ui/AppIcon";

interface TopbarProps {
  readonly page: NavigationItem;
  readonly connectionState: ConnectionState;
  readonly onOpenMenu: () => void;
}

function Topbar({
  page,
  connectionState,
  onOpenMenu,
}: TopbarProps): React.JSX.Element {
  const statusLabel =
    connectionState === "connected"
      ? "Conectado"
      : connectionState === "error"
        ? "Con error"
        : "Verificando";

  return (
    <header className="app-topbar">
      <div className="app-topbar__identity">
        <button
          className="icon-button app-topbar__menu"
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
        >
          <AppIcon name="menu" />
        </button>

        <div>
          <p className="page-kicker">EDITAR · APLICACIÓN DE ESCRITORIO</p>
          <h1>{page.label}</h1>
          <p className="app-topbar__description">{page.description}</p>
        </div>
      </div>

      <div className="app-topbar__actions">
        <span
          className={`connection-chip connection-chip--${connectionState}`}
          aria-live="polite"
        >
          <span className="connection-chip__dot" aria-hidden="true" />
          {statusLabel}
        </span>
        <span className="version-badge">v0.1.0</span>
      </div>
    </header>
  );
}

export { Topbar, type TopbarProps };
