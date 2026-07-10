/* =========================================================
Nombre completo: HomeScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/HomeScreen.tsx

Función o funciones:
- Mostrar el panel de inicio de la aplicación.
- Presentar accesos directos hacia los módulos principales.
- Informar el estado de medios, derivados y caché multimedia.
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
    description: "Importa medios y genera proxies, miniaturas y ondas.",
    status: "Caché integrada",
  },
  {
    route: "jobs" as const,
    icon: "jobs" as const,
    title: "Trabajos",
    description: "Supervisa FFprobe, FFmpeg, progreso y reintentos.",
    status: "Procesamiento real",
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
          <span className="section-label">BLOQUE 10 · CACHÉ MULTIMEDIA</span>
          <h2>El editor ya crea archivos optimizados sin tocar los originales</h2>
          <p>
            FFmpeg genera proxies de edición, miniaturas y formas de onda dentro
            de Worker Threads. Los resultados se guardan en una caché local,
            aparecen en el Editor y pueden eliminarse y regenerarse con seguridad.
          </p>
          <div className="dashboard-hero__actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => onNavigate("editor")}
            >
              Abrir editor
              <AppIcon name="arrow" size={18} />
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onNavigate("settings")}
            >
              Revisar caché
            </button>
          </div>
        </div>

        <div className="dashboard-preview" aria-hidden="true">
          <div className="dashboard-preview__monitor">
            <span className="dashboard-preview__play">▶</span>
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
            <small>Arquitectura</small>
            <strong>Modular y segura</strong>
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
            <AppIcon name="video" />
          </span>
          <div>
            <small>Procesamiento</small>
            <strong>FFmpeg + caché</strong>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon">
            <AppIcon name="arrow" />
          </span>
          <div>
            <small>Entorno · latencia</small>
            <strong>
              {runtime?.platform ?? "Consultando"} · {latencyMs === null ? "…" : `${latencyMs} ms`}
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
