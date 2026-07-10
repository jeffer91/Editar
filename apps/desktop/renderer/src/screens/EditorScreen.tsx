/* =========================================================
Nombre completo: EditorScreen.tsx
Ruta o ubicación: /apps/desktop/renderer/src/screens/EditorScreen.tsx

Función o funciones:
- Definir la distribución visual del editor.
- Reservar áreas para medios, monitor, propiedades y timeline.
- Preparar la pantalla para los bloques de reproducción y edición.
========================================================= */

import { AppIcon } from "../components/ui/AppIcon";

function EditorScreen(): React.JSX.Element {
  return (
    <div className="screen-stack screen-stack--editor">
      <section className="editor-notice">
        <span className="editor-notice__icon">
          <AppIcon name="editor" />
        </span>
        <div>
          <strong>Estructura del editor preparada</strong>
          <small>
            Los controles multimedia se habilitarán desde los bloques 7 al 13.
          </small>
        </div>
        <span className="status-tag">Vista estructural</span>
      </section>

      <section className="editor-workbench" aria-label="Estructura del editor">
        <aside className="editor-panel editor-panel--media">
          <div className="editor-panel__heading">
            <div>
              <span className="section-label">RECURSOS</span>
              <h2>Medios</h2>
            </div>
            <span className="panel-count">0</span>
          </div>

          <div className="editor-tool-list">
            <div className="editor-tool-item">
              <AppIcon name="video" size={18} />
              Videos
            </div>
            <div className="editor-tool-item">
              <AppIcon name="audio" size={18} />
              Audio
            </div>
            <div className="editor-tool-item">
              <AppIcon name="text" size={18} />
              Textos
            </div>
            <div className="editor-tool-item">
              <AppIcon name="transition" size={18} />
              Transiciones
            </div>
          </div>

          <div className="editor-panel__placeholder">
            Los archivos importados aparecerán aquí.
          </div>
        </aside>

        <div className="editor-center">
          <div className="editor-monitor">
            <div className="editor-monitor__canvas">
              <span className="editor-monitor__play">▶</span>
              <small>Monitor de vista previa</small>
            </div>
            <div className="editor-monitor__controls">
              <span>00:00:00:00</span>
              <div className="editor-monitor__transport">
                <span>◀</span>
                <span>▶</span>
                <span>▶▶</span>
              </div>
              <span>100%</span>
            </div>
          </div>

          <div className="editor-timeline">
            <div className="editor-timeline__toolbar">
              <div>
                <span className="section-label">LÍNEA DE TIEMPO</span>
                <strong>Secuencia principal</strong>
              </div>
              <span className="status-tag">Bloque 12</span>
            </div>

            <div className="timeline-ruler">
              <span>00:00</span>
              <span>00:05</span>
              <span>00:10</span>
              <span>00:15</span>
              <span>00:20</span>
            </div>

            <div className="timeline-tracks">
              <div className="timeline-track-row">
                <span className="timeline-track-row__label">V1</span>
                <span className="timeline-track-row__lane">
                  <i className="timeline-placeholder timeline-placeholder--video" />
                </span>
              </div>
              <div className="timeline-track-row">
                <span className="timeline-track-row__label">T1</span>
                <span className="timeline-track-row__lane">
                  <i className="timeline-placeholder timeline-placeholder--text" />
                </span>
              </div>
              <div className="timeline-track-row">
                <span className="timeline-track-row__label">A1</span>
                <span className="timeline-track-row__lane">
                  <i className="timeline-placeholder timeline-placeholder--audio" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <aside className="editor-panel editor-panel--properties">
          <div className="editor-panel__heading">
            <div>
              <span className="section-label">INSPECTOR</span>
              <h2>Propiedades</h2>
            </div>
          </div>

          <div className="property-group">
            <strong>Transformación</strong>
            <div className="property-row">
              <span>Posición</span>
              <small>X 0 · Y 0</small>
            </div>
            <div className="property-row">
              <span>Escala</span>
              <small>100%</small>
            </div>
            <div className="property-row">
              <span>Rotación</span>
              <small>0°</small>
            </div>
          </div>

          <div className="property-group">
            <strong>Video</strong>
            <div className="property-row">
              <span>Opacidad</span>
              <small>100%</small>
            </div>
            <div className="property-row">
              <span>Velocidad</span>
              <small>1.0x</small>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

export { EditorScreen };
