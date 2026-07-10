/* =========================================================
Nombre completo: AppShell.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/layout/AppShell.tsx

Función o funciones:
- Organizar barra lateral, encabezado y contenido principal.
- Controlar apertura y cierre del menú móvil.
- Mantener una estructura visual común para todas las pantallas.
========================================================= */

import { useEffect, useState, type ReactNode } from "react";
import {
  getNavigationItem,
  type AppRoute,
} from "../../../../shared/navigation-contracts";
import type { ConnectionState } from "../../app/use-system-status";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  readonly currentRoute: AppRoute;
  readonly connectionState: ConnectionState;
  readonly onNavigate: (route: AppRoute) => void;
  readonly children: ReactNode;
}

function AppShell({
  currentRoute,
  connectionState,
  onNavigate,
  children,
}: AppShellProps): React.JSX.Element {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const page = getNavigationItem(currentRoute);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const navigate = (route: AppRoute): void => {
    onNavigate(route);
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentRoute={currentRoute}
        connectionState={connectionState}
        isOpen={isSidebarOpen}
        onNavigate={navigate}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="app-workspace">
        <Topbar
          page={page}
          connectionState={connectionState}
          onOpenMenu={() => setIsSidebarOpen(true)}
        />

        <main className="app-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell, type AppShellProps };
