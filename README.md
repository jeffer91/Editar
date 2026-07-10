<!-- =========================================================
Nombre completo: README.md
Ruta o ubicación: /README.md

Función o funciones:
- Documentar la finalidad y arquitectura actual del proyecto.
- Explicar motores, derivados, caché y verificación.
- Registrar los bloques completados y el siguiente bloque.
========================================================= -->

# Editar

Aplicación de escritorio modular para edición de video, eliminación de silencios, animaciones, efectos visuales, efectos de sonido, textos flotantes, transiciones y automatización futura.

## Estado actual

- **Bloque 1:** Electron, React, TypeScript y Vite.
- **Bloque 2:** seguridad, contratos IPC y comunicación tipada.
- **Bloque 3:** diseño visual y navegación.
- **Bloque 4:** núcleo y modelos del dominio.
- **Bloque 5:** SQLite, migraciones y respaldos.
- **Bloque 6:** gestión funcional de proyectos.
- **Bloque 7:** importación y registro de medios.
- **Bloque 8:** cola persistente y Worker Threads.
- **Bloque 9:** integración de FFmpeg y FFprobe.
- **Bloque 10:** proxies, miniaturas, formas de onda y caché multimedia.

La aplicación ya analiza medios con FFprobe y genera archivos optimizados con FFmpeg sin modificar los originales. Los derivados se guardan bajo `userData`, se registran en SQLite y se muestran mediante un protocolo interno validado.

## Requisitos

- Node.js 22.16 o superior.
- npm 10 o superior.
- Windows 10 u 11 como plataforma inicial.
- FFmpeg y FFprobe disponibles mediante configuración, recursos locales o `PATH`.

## Instalación

```powershell
npm install
```

## Configuración de FFmpeg y FFprobe

La aplicación busca cada herramienta en este orden:

1. `EDITAR_FFMPEG_PATH` y `EDITAR_FFPROBE_PATH`.
2. Recursos empaquetados.
3. `resources/bin` de la aplicación.
4. `resources/bin` del proyecto.
5. `PATH` del sistema.

Archivos esperados en Windows:

```text
resources/bin/ffmpeg.exe
resources/bin/ffprobe.exe
```

Configuración temporal desde PowerShell:

```powershell
$env:EDITAR_FFMPEG_PATH = "C:\ffmpeg\bin\ffmpeg.exe"
$env:EDITAR_FFPROBE_PATH = "C:\ffmpeg\bin\ffprobe.exe"
npm run dev
```

Los binarios grandes no están versionados todavía. El instalador final deberá incorporar versiones verificadas y compatibles con su licencia.

## Desarrollo

```powershell
npm run dev
```

## Verificación

```powershell
npm run verify
```

La verificación incluye:

1. Typecheck del renderer y Electron.
2. Compilación de React, preload, proceso principal y Workers.
3. Pruebas de seguridad, IPC, navegación y dominio.
4. Pruebas de SQLite, proyectos e importación.
5. Pruebas de cola, cancelación, reintentos y recuperación.
6. Pruebas de FFprobe y resolución de motores.
7. Pruebas de operaciones y rutas de derivados.
8. Prueba completa de cola → Worker → FFmpeg simulado → archivo → SQLite.
9. Reutilización de caché y ausencia de snapshots técnicos.
10. Reconciliación, eliminación de temporales, huérfanos y limpieza completa.

Pruebas específicas:

```powershell
npm run test:engines
npm run test:cache
```

## Ejecución compilada

```powershell
npm start
```

## Derivados multimedia

Después de un análisis correcto, el sistema planifica automáticamente:

| Medio | Derivados |
|---|---|
| Video con audio | Proxy, miniatura y forma de onda |
| Video sin audio | Proxy y miniatura |
| Audio | Forma de onda |
| Imagen | Miniatura |

### Proxy

- MP4.
- H.264 mediante `libx264`.
- Escala máxima de 1280 × 720.
- Relación de aspecto conservada.
- Audio AAC a 128 kbps cuando existe.
- `faststart` para lectura rápida.

### Miniatura

- JPG.
- Escala máxima de 640 × 360.
- En video se toma aproximadamente el 10 % de la duración, con máximo de cinco segundos.
- En imagen se utiliza el primer cuadro disponible.

### Forma de onda

- PNG de 1200 × 240.
- Audio convertido a mono para visualización.
- Generada con `showwavespic`.

## Flujo de procesamiento

```text
Importación
└── probe-media
    └── metadatos FFprobe
        ├── generate-proxy
        ├── generate-thumbnails
        └── generate-waveform
            └── archivo parcial
                └── validación
                    └── reemplazo atómico
                        └── SQLite
```

Los trabajos derivados dependen del análisis técnico cuando se crean automáticamente. También pueden solicitarse desde el Editor para recursos analizados que todavía no tienen todos sus archivos optimizados.

## Caché multimedia

La caché vive dentro de:

```text
<userData>/cache/media
```

Características:

- nombres deterministas derivados de SHA-256;
- carpetas segmentadas por proyecto y medio;
- claves dependientes del original, metadatos, versión del generador y versión de FFmpeg;
- reutilización de archivos válidos;
- archivos parciales mientras FFmpeg trabaja;
- reemplazo final mediante `rename`;
- reconciliación al iniciar;
- eliminación de temporales y huérfanos;
- limpieza manual desde Ajustes;
- bloqueo de limpieza cuando existen trabajos de caché activos.

Limpiar la caché no elimina:

- archivos originales;
- proyectos;
- pistas o clips;
- metadatos de FFprobe;
- respaldos.

## Protocolo interno

Las previsualizaciones se sirven mediante:

```text
editar-cache://derivative/<derivativeId>
```

El renderer solo conoce el identificador. El proceso principal:

1. valida el ID;
2. busca el derivado en SQLite;
3. confirma que la ruta pertenece a la caché;
4. comprueba que el archivo existe;
5. sirve el contenido.

React no recibe rutas físicas ni acceso general al sistema de archivos.

## Cola de trabajos

Ya tienen ejecución real:

- `diagnostic-worker`;
- `probe-media`;
- `generate-proxy`;
- `generate-thumbnails`;
- `generate-waveform`.

Cada trabajo mantiene prioridad, progreso, intentos, cancelación, errores y recuperación después de una interrupción.

## Seguridad

- Los originales nunca se modifican.
- FFmpeg y FFprobe se ejecutan con `shell: false`.
- El renderer solo envía identificadores tipados.
- Las rutas y comandos se resuelven en el proceso principal.
- Toda salida debe permanecer dentro de la caché administrada.
- Se rechaza traversal y cualquier ruta externa.
- Los archivos se validan antes de registrarse.
- Un resultado no persistido impide completar el trabajo.
- La limpieza no se ejecuta durante trabajos activos.

## Estructura actual

```text
Editar/
├── apps/desktop/
│   ├── main/
│   │   ├── database/
│   │   ├── ipc/
│   │   ├── jobs/
│   │   ├── media/
│   │   ├── projects/
│   │   └── security/
│   ├── preload/
│   ├── renderer/src/
│   │   ├── app/
│   │   ├── components/
│   │   └── screens/
│   └── shared/
│       ├── domain/
│       └── persistence/
├── docs/
├── resources/bin/
├── scripts/
├── tests/
└── package.json
```

## Principios del proyecto

- Todo IPC debe declararse, tiparse y validarse.
- Los procesos pesados se ejecutan fuera del renderer.
- Los archivos técnicos son regenerables y están separados de los originales.
- Los resultados se validan antes de persistirse.
- Progreso, análisis y derivados no crean snapshots innecesarios.
- Cada bloque debe compilar y superar pruebas antes de fusionarse.

## Siguiente bloque

**Bloque 11 — Análisis de audio y detección de silencios.**
