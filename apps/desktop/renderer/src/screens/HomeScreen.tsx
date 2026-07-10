/* =========================================================
Nombre completo: HomeScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/HomeScreen.tsx

Función o funciones:
- Mostrar el panel de inicio de la aplicación.
- Presentar accesos directos hacia los módulos principales.
- Informar edición funcional de clips y textos animados.
========================================================= */

import { DOMAIN_SCHEMA_VERSION } from "../../../shared/domain";
import type { RuntimeInfo } from "../../../shared/ipc-contracts";
import type { AppRoute } from "../../../shared/navigation-contracts";
import { AppIcon } from "../components/ui/AppIcon";

interface HomeScreenProps {
  readonly runtime: RuntimeInfo | null;
  readonly latencyMs: number | null;
  readonly onNavigate: (route: AppRoute) => void;
}

const moduleCards = [
  {
    route: "projects" as const,
    icon: "projects" as const,
    title: "Proyectos",
    description: "Crea, busca, duplica, archiva y abre proyectos.",
    status: "Gestión funcional",
  },
  {
    route: "editor" as const,
    icon: "editor" as const,
    title: "Editor",
    description: "Añade, mueve, recorta y divide clips y textos animados.",
    status: "Línea de tiempo funcional",
  },
  {
    route: "jobs" as const,
    icon: "jobs" as const,
    title: "Trabajos",
    description: "Supervisa FFprobe, FFmpeg, progreso y reintentos.",
    status: "Workers especializados",
  },
  {
    route: "library" as const,
    icon: "library" as const,
    title: "Biblioteca",
    description: "Recursos visuales, sonidos, textos y transiciones.",
    status: "Modelo listo",
  },
  {
    route: "settings" as const,
    icon: "settings" as const,
    title: "Ajustes",
    description: "SQLite, motores, respaldos y limpieza de caché.",
    status: "Diagnóstico completo",
  },
] as const;

function HomeScreen({
  runtime,
  latencyMs,
  onNavigate,
}: HomeScreenProps): React.JSX.Element {
  return (
    <div className="screen-stack">
      <section className="dashboard-hero">
        <div className="dashboard-hero__content">
          <span className="section-label">
            BLOQUES 13–14 · LÍNEA DE TIEMPO Y TEXTOS
          </span>
          <h2>El editor ya permite construir una secuencia real de clips</h2>
          <p>
            Los medios pueden añadirse, moverse, recortarse, dividirse y
            eliminarse sin modificar los originales. También existen títulos,
            subtítulos, rótulos y textos flotantes con animaciones editables.
          </p>
          <div className="dashboard-hero__actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => onNavigate("editor")}
            >
              Abrir línea de tiempo
              <AppIcon name="arrow" size={18} />
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onNavigate("projects")}
            >
              Elegir proyecto
            </button>
          </div>
        </div>

        <div className="dashboard-preview" aria-hidden="true">
          <div className="dashboard-preview__monitor">
            <span className="dashboard-preview__play">TÍTULO</span>
          </div>
          <div className="dashboard-preview__timeline">
            <span className="preview-track preview-track--video" />
            <span className="preview-track preview-track--audio" />
            <span className="preview-track preview-track--text" />
          </div>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Estado de la aplicación">
        <article className="metric-card">
          <span className="metric-card__icon">
            <AppIcon name="shield" />
          </span>
          <div>
            <small>Edición</small>
            <strong>No destructiva</strong>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon">
            <AppIcon name="check" />
          </span>
          <div>
            <small>Modelo del proyecto</small>
            <strong>Esquema v{DOMAIN_SCHEMA_VERSION}</strong>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon">
            <AppIcon name="editor" />
          </span>
          <div>
            <small>Operaciones</small>
            <strong>Mover · cortar · dividir</strong>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon">
            <AppIcon name="arrow" />
          </span>
          <div>
            <small>Entorno · latencia</small>
            <strong>
              {runtime?.platform ?? "Consultando"} ·{" "}
              {latencyMs === null ? "…" : `${latencyMs} ms`}
            </strong>
          </div>
        </article>
      </section>

      <section className="content-section">
        <div className="content-section__heading">
          <div>
            <span className="section-label">MÓDULOS PRINCIPALES</span>
            <h2>Estructura disponible</h2>
          </div>
          <p>Cada módulo tiene su propia pantalla y podrá crecer por separado.</p>
        </div>

        <div className="module-grid">
          {moduleCards.map((module) => (
            <button
              className="module-card"
              type="button"
              key={module.route}
              onClick={() => onNavigate(module.route)}
            >
              <span className="module-card__icon">
                <AppIcon name={module.icon} />
              </span>
              <span className="module-card__content">
                <strong>{module.title}</strong>
                <small>{module.description}</small>
                <span>{module.status}</span>
              </span>
              <AppIcon name="arrow" size={18} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export { HomeScreen, type HomeScreenProps };
