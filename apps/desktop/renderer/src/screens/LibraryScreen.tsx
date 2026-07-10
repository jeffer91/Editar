/* =========================================================
Nombre completo: LibraryScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/LibraryScreen.tsx

Función o funciones:
- Definir la pantalla base de la biblioteca multimedia.
- Organizar categorías de recursos futuros.
- Preparar filtros y colecciones para efectos y plantillas.
========================================================= */

import { AppIcon } from "../components/ui/AppIcon";

const libraryCategories = [
  {
    icon: "video" as const,
    title: "Videos",
    description: "Clips, fondos y recursos visuales importados.",
    block: "Bloque 7",
  },
  {
    icon: "audio" as const,
    title: "Audio y sonidos",
    description: "Música, ambientes y efectos de sonido.",
    block: "Bloque 17",
  },
  {
    icon: "transition" as const,
    title: "Transiciones",
    description: "Fundidos, desplazamientos, zoom y efectos de cambio.",
    block: "Bloque 19",
  },
  {
    icon: "text" as const,
    title: "Textos y títulos",
    description: "Subtítulos, textos flotantes y estilos animados.",
    block: "Bloque 16",
  },
  {
    icon: "editor" as const,
    title: "Efectos de video",
    description: "Filtros, desenfoques, color, velocidad y zoom.",
    block: "Bloque 18",
  },
  {
    icon: "library" as const,
    title: "Plantillas",
    description: "Combinaciones reutilizables de diseño y movimiento.",
    block: "Futuro",
  },
] as const;

function LibraryScreen(): React.JSX.Element {
  return (
    <div className="screen-stack">
      <section className="screen-banner screen-banner--library">
        <div>
          <span className="section-label">RECURSOS CREATIVOS</span>
          <h2>Una biblioteca preparada para crecer</h2>
          <p>
            Cada categoría tendrá su propio registro, vista previa y motor de
            aplicación. La estructura visual ya separa recursos, efectos y
            plantillas para evitar mezclarlos con el editor.
          </p>
        </div>
        <span className="screen-banner__icon" aria-hidden="true">
          <AppIcon name="library" size={34} />
        </span>
      </section>

      <section className="content-section">
        <div className="content-section__heading">
          <div>
            <span className="section-label">CATEGORÍAS</span>
            <h2>Biblioteca modular</h2>
          </div>
          <span className="status-tag">6 categorías</span>
        </div>

        <div className="library-grid">
          {libraryCategories.map((category) => (
            <article className="library-card" key={category.title}>
              <span className="library-card__icon">
                <AppIcon name={category.icon} size={22} />
              </span>
              <div>
                <strong>{category.title}</strong>
                <p>{category.description}</p>
              </div>
              <span className="library-card__block">{category.block}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section content-section--compact">
        <div className="library-summary">
          <span className="library-summary__icon">
            <AppIcon name="check" />
          </span>
          <div>
            <strong>Separación por capacidades</strong>
            <p>
              Los recursos podrán registrarse por tipo sin cambiar la navegación
              ni el diseño general de la aplicación.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export { LibraryScreen };
