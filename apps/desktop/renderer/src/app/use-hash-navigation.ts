/* =========================================================
Nombre completo: use-hash-navigation.ts
Ruta o ubicación: /apps/desktop/renderer/src/app/use-hash-navigation.ts

Función o funciones:
- Mantener sincronizada la pantalla activa con el hash de la ventana.
- Permitir navegación interna sin recargar Electron.
- Recuperar una ruta válida al abrir o actualizar la aplicación.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_ROUTE,
  hashForRoute,
  routeFromHash,
  type AppRoute,
} from "../../../shared/navigation-contracts";

interface HashNavigation {
  readonly currentRoute: AppRoute;
  readonly navigate: (route: AppRoute) => void;
}

function useHashNavigation(): HashNavigation {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    routeFromHash(window.location.hash),
  );

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", hashForRoute(DEFAULT_ROUTE));
    }

    const handleHashChange = (): void => {
      setCurrentRoute(routeFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const navigate = useCallback((route: AppRoute): void => {
    const nextHash = hashForRoute(route);

    if (window.location.hash === nextHash) {
      setCurrentRoute(route);
      return;
    }

    window.location.hash = nextHash;
  }, []);

  return { currentRoute, navigate };
}

export { useHashNavigation, type HashNavigation };
