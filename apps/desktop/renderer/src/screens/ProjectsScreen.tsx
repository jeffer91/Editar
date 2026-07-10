/* =========================================================
Nombre completo: ProjectsScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/ProjectsScreen.tsx

Función o funciones:
- Definir la pantalla base para gestionar proyectos.
- Mostrar la futura organización de proyectos recientes.
- Preparar el acceso al módulo de gestión del Bloque 6.
========================================================= */

import type { AppRoute } from "../../../shared/navigation-contracts";
import { AppIcon } from "../components/ui/AppIcon";

interface ProjectsScreenProps {
  readonly onNavigate: (route: AppRoute) => void;
}

const projectCapabilities = [
  "Crear y nombrar proyectos",
  "Guardar videos y recursos asociados",
  "Duplicar, archivar y recuperar versiones",
  "Abrir el proyecto directamente en el editor",
] as const;

function ProjectsScreen({
  onNavigate,
}: ProjectsScreenProps): React.JSX.Element {
  return (
    <div className="screen-stack">
      <section className="screen-banner screen-banner--projects">
        <div>
          <span className="section-label">GESTIÓN DE TRABAJO</span>
          <h2>Todos los proyectos en un solo lugar</h2>
          <p>
            Esta pantalla ya forma parte de la navegación principal. La creación,
            persistencia y recuperación de proyectos se habilitará en el Bloque 6.
          </p>
        </div>
        <span className="screen-banner__icon" aria-hidden="true">
          <AppIcon name="projects" size={34} />
        </span>
      </section>

      <section className="content-section">
        <div className="content-section__heading">
          <div>
            <span className="section-label">ESTRUCTURA PREPARADA</span>
            <h2>Panel de proyectos</h2>
          </div>
          <span className="status-tag">Bloque 6</span>
        </div>

        <div className="projects-layout">
          <div className="projects-layout__main">
            <div className="empty-state">
              <span className="empty-state__icon">
                <AppIcon name="projects" size={30} />
              </span>
              <h3>Aún no existen proyectos</h3>
              <p>
                La base visual está lista. Cuando se incorpore la base de datos,
                aquí aparecerán miniaturas, fechas, duración y estado de cada
                proyecto.
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => onNavigate("editor")}
              >
                Ver estructura del editor
                <AppIcon name="arrow" size={18} />
              </button>
            </div>
          </div>

          <aside className="projects-layout__aside">
            <span className="section-label">FUNCIONES PLANIFICADAS</span>
            <ul className="check-list">
              {projectCapabilities.map((capability) => (
                <li key={capability}>
                  <span>
                    <AppIcon name="check" size={16} />
                  </span>
                  {capability}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}

export { ProjectsScreen, type ProjectsScreenProps };
