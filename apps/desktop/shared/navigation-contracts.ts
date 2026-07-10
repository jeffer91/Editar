/* =========================================================
Nombre completo: navigation-contracts.ts
Ruta o ubicación: /apps/desktop/shared/navigation-contracts.ts

Función o funciones:
- Definir las rutas principales de la aplicación.
- Centralizar títulos, descripciones e iconos de navegación.
- Convertir rutas entre estado interno y hash de la ventana.
========================================================= */

const APP_ROUTES = [
  "home",
  "projects",
  "editor",
  "jobs",
  "library",
  "settings",
] as const;

type AppRoute = (typeof APP_ROUTES)[number];

type AppIconName =
  | "home"
  | "projects"
  | "editor"
  | "jobs"
  | "library"
  | "settings"
  | "menu"
  | "close"
  | "arrow"
  | "video"
  | "audio"
  | "transition"
  | "text"
  | "check"
  | "shield";

interface NavigationItem {
  readonly route: AppRoute;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly icon: AppIconName;
}

const DEFAULT_ROUTE: AppRoute = "home";

const NAVIGATION_ITEMS: readonly NavigationItem[] = Object.freeze([
  {
    route: "home",
    label: "Inicio",
    shortLabel: "Inicio",
    description: "Resumen general y accesos principales",
    icon: "home",
  },
  {
    route: "projects",
    label: "Proyectos",
    shortLabel: "Proyectos",
    description: "Organización de proyectos audiovisuales",
    icon: "projects",
  },
  {
    route: "editor",
    label: "Editor",
    shortLabel: "Editor",
    description: "Espacio de edición y línea de tiempo",
    icon: "editor",
  },
  {
    route: "jobs",
    label: "Trabajos",
    shortLabel: "Trabajos",
    description: "Cola, progreso y procesamiento en segundo plano",
    icon: "jobs",
  },
  {
    route: "library",
    label: "Biblioteca",
    shortLabel: "Biblioteca",
    description: "Recursos, efectos, sonidos y plantillas",
    icon: "library",
  },
  {
    route: "settings",
    label: "Ajustes",
    shortLabel: "Ajustes",
    description: "Preferencias, sistema y diagnóstico",
    icon: "settings",
  },
]);

function isAppRoute(value: string): value is AppRoute {
  return APP_ROUTES.includes(value as AppRoute);
}

function routeFromHash(hash: string): AppRoute {
  const normalized = hash
    .replace(/^#\/?/, "")
    .split(/[/?]/, 1)[0]
    ?.trim()
    .toLowerCase();

  return normalized && isAppRoute(normalized) ? normalized : DEFAULT_ROUTE;
}

function hashForRoute(route: AppRoute): string {
  return `#/${route}`;
}

function getNavigationItem(route: AppRoute): NavigationItem {
  return (
    NAVIGATION_ITEMS.find((item) => item.route === route) ??
    NAVIGATION_ITEMS[0]
  );
}

export {
  APP_ROUTES,
  DEFAULT_ROUTE,
  NAVIGATION_ITEMS,
  getNavigationItem,
  hashForRoute,
  isAppRoute,
  routeFromHash,
  type AppIconName,
  type AppRoute,
  type NavigationItem,
};
