/* =========================================================
Nombre completo: App.tsx
Ruta o ubicación: /apps/desktop/renderer/src/App.tsx

Función o funciones:
- Mostrar la pantalla inicial del editor.
- Confirmar que React y el puente de Electron funcionan.
- Presentar el estado del Bloque 1 y la arquitectura prevista.
========================================================= */

interface StatusItem {
  readonly label: string;
  readonly value: string;
}

const foundations = [
  "Electron aislado de la interfaz",
  "React con TypeScript estricto",
  "Compilaciones separadas",
  "Base preparada para módulos",
] as const;

function App(): React.JSX.Element {
  const runtime = window.editar.runtime;

  const statusItems: readonly StatusItem[] = [
    { label: "Aplicación", value: "Editar 0.1.0" },
    { label: "Sistema", value: runtime.platform },
    { label: "Electron", value: runtime.versions.electron },
    { label: "Node interno", value: runtime.versions.node },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            E
          </div>
          <div>
            <strong>Editar</strong>
            <span>Video inteligente</span>
          </div>
        </div>

        <nav className="navigation">
          <button className="navigation-item navigation-item--active" type="button">
            Inicio
          </button>
          <button className="navigation-item" type="button" disabled>
            Proyectos
          </button>
          <button className="navigation-item" type="button" disabled>
            Editor
          </button>
          <button className="navigation-item" type="button" disabled>
            Ajustes
          </button>
        </nav>

        <div className="sidebar-note">
          <span className="status-dot" aria-hidden="true" />
          Bloque 1 en ejecución
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ARQUITECTURA BASE</p>
            <h1>Editor modular de video</h1>
          </div>
          <span className="version-chip">v0.1.0</span>
        </header>

        <section className="hero-card">
          <div className="hero-copy">
            <span className="hero-badge">Bloque 1</span>
            <h2>La base de la aplicación está conectada</h2>
            <p>
              Electron administra el escritorio y React renderiza la interfaz.
              El procesamiento multimedia se incorporará después mediante
              módulos y procesos separados.
            </p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="timeline-line timeline-line--one" />
            <div className="timeline-line timeline-line--two" />
            <div className="timeline-line timeline-line--three" />
            <div className="play-symbol">▶</div>
          </div>
        </section>

        <section className="section" aria-labelledby="runtime-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DIAGNÓSTICO INICIAL</p>
              <h2 id="runtime-title">Entorno de ejecución</h2>
            </div>
            <span className="health-pill">Conectado</span>
          </div>

          <div className="status-grid">
            {statusItems.map((item) => (
              <article className="status-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="foundation-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FUNDAMENTOS</p>
              <h2 id="foundation-title">Preparada para crecer</h2>
            </div>
          </div>

          <div className="foundation-grid">
            {foundations.map((foundation, index) => (
              <article className="foundation-card" key={foundation}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{foundation}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export { App };
