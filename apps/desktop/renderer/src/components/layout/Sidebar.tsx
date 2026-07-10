/* =========================================================
Nombre completo: Sidebar.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/layout/Sidebar.tsx

Función o funciones:
- Mostrar la navegación principal de la aplicación.
- Marcar la pantalla activa y permitir cambio de ruta.
- Adaptarse a escritorio y menú lateral móvil.
========================================================= */

import {
  NAVIGATION_ITEMS,
  type AppRoute,
} from "../../../../shared/navigation-contracts";
import type { ConnectionState } from "../../app/use-system-status";
import { AppIcon } from "../ui/AppIcon";

interface SidebarProps {
  readonly currentRoute: AppRoute;
  readonly isOpen: boolean;
  readonly connectionState: ConnectionState;
  readonly onNavigate: (route: AppRoute) => void;
  readonly onClose: () => void;
}

function Sidebar({
  currentRoute,
  isOpen,
  connectionState,
  onNavigate,
  onClose,
}: SidebarProps): React.JSX.Element {
  const connectionLabel =
    connectionState === "connected"
      ? "Sistema conectado"
      : connectionState === "error"
        ? "Revisar conexión"
        : "Comprobando sistema";

  return (
    <>
      <aside
        className={`app-sidebar${isOpen ? " app-sidebar--open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="app-sidebar__header">
          <button
            className="brand-button"
            type="button"
            onClick={() => onNavigate("home")}
            aria-label="Ir al inicio"
          >
            <span className="brand-button__mark" aria-hidden="true">
              E
            </span>
            <span className="brand-button__text">
              <strong>Editar</strong>
              <small>Video inteligente</small>
            </span>
          </button>

          <button
            className="icon-button app-sidebar__close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <AppIcon name="close" />
          </button>
        </div>

        <nav className="app-navigation" aria-label="Secciones de la aplicación">
          {NAVIGATION_ITEMS.map((item) => {
            const isActive = currentRoute === item.route;

            return (
              <button
                className={`app-navigation__item${
                  isActive ? " app-navigation__item--active" : ""
                }`}
                type="button"
                key={item.route}
                onClick={() => onNavigate(item.route)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="app-navigation__icon">
                  <AppIcon name={item.icon} />
                </span>
                <span className="app-navigation__text">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="app-sidebar__footer">
          <div
            className={`system-indicator system-indicator--${connectionState}`}
          >
            <span className="system-indicator__dot" aria-hidden="true" />
            <span>
              <strong>{connectionLabel}</strong>
              <small>Bloque 3 · Interfaz base</small>
            </span>
          </div>
        </div>
      </aside>

      {isOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú lateral"
        />
      ) : null}
    </>
  );
}

export { Sidebar, type SidebarProps };
