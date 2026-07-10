<!-- =========================================================
Nombre completo: README.md
Ruta o ubicación: /README.md

Función o funciones:
- Documentar la finalidad y arquitectura actual del proyecto.
- Explicar instalación, motores multimedia y verificación.
- Registrar los bloques completados y el siguiente bloque.
========================================================= -->

# Editar

Aplicación de escritorio modular para edición de video, eliminación de silencios, animaciones, efectos visuales, efectos de sonido, textos flotantes, transiciones y automatización futura.

## Estado actual

- **Bloque 1:** inicialización de Electron, React, TypeScript y Vite.
- **Bloque 2:** seguridad, contratos IPC y comunicación tipada.
- **Bloque 3:** diseño visual, navegación y estructura de pantallas.
- **Bloque 4:** núcleo y modelos del dominio.
- **Bloque 5:** SQLite, migraciones, repositorios y respaldos.
- **Bloque 6:** gestión funcional de proyectos.
- **Bloque 7:** importación y registro de medios.
- **Bloque 8:** cola persistente y procesamiento en segundo plano.
- **Bloque 9:** integración de FFmpeg y FFprobe.

La aplicación ya puede localizar motores multimedia, verificar sus versiones, analizar videos, audios e imágenes mediante FFprobe dentro de Worker Threads y guardar los metadatos técnicos directamente en SQLite.

## Requisitos

- Node.js 22.16 o superior.
- npm 10 o superior.
- Windows 10 u 11 como plataforma inicial objetivo.
- FFprobe disponible mediante una ruta configurada, recursos locales o `PATH` para ejecutar análisis reales.

## Instalación

```powershell
npm install
```

## Configuración de FFmpeg y FFprobe

La aplicación busca cada herramienta en este orden:

1. `EDITAR_FFMPEG_PATH` y `EDITAR_FFPROBE_PATH`.
2. Carpeta `bin` de los recursos empaquetados.
3. Carpeta `resources/bin` de la aplicación.
4. Carpeta `resources/bin` del proyecto.
5. `PATH` del sistema operativo.

En Windows se pueden colocar los ejecutables aquí:

```text
resources/bin/ffmpeg.exe
resources/bin/ffprobe.exe
```

También pueden señalarse temporalmente desde PowerShell:

```powershell
$env:EDITAR_FFMPEG_PATH = "C:\ffmpeg\bin\ffmpeg.exe"
$env:EDITAR_FFPROBE_PATH = "C:\ffmpeg\bin\ffprobe.exe"
npm run dev
```

Los binarios grandes no se versionan todavía en GitHub. El instalador final deberá incorporar versiones verificadas y compatibles con su licencia.

## Desarrollo

```powershell
npm run dev
```

Este comando inicia Vite, compila Electron y abre la aplicación.

## Verificación

```powershell
npm run verify
```

La verificación incluye:

1. Typecheck del renderer y Electron.
2. Compilación de React, proceso principal, preload y Worker Threads.
3. Pruebas de seguridad, IPC y navegación.
4. Pruebas del dominio, SQLite, proyectos e importación.
5. Pruebas de la cola, cancelación y recuperación.
6. Pruebas del parser JSON de FFprobe.
7. Pruebas de prioridad y fallback de binarios.
8. Prueba completa de cola → Worker Thread → FFprobe simulado → SQLite.
9. Pruebas de metadatos de video, audio e imagen.
10. Confirmación de que el análisis técnico no genera snapshots adicionales.

Para ejecutar solo las pruebas de motores:

```powershell
npm run test:engines
```

## Ejecución compilada

```powershell
npm start
```

## Pantallas disponibles

- Inicio.
- Proyectos.
- Editor con importación y metadatos técnicos.
- Centro de trabajos.
- Biblioteca.
- Ajustes con diagnóstico de SQLite, FFmpeg y FFprobe.

## Integración de FFmpeg y FFprobe

### Detección segura

La resolución de ejecutables:

- se realiza únicamente en el proceso principal;
- no acepta rutas provenientes del renderer;
- ejecuta comandos con `shell: false`;
- aplica tiempo límite;
- comprueba `-version`;
- informa origen, versión, comando resuelto y error.

### Análisis técnico

Después de importar un medio, la aplicación intenta crear un trabajo `probe-media`.

FFprobe obtiene:

- duración;
- ancho y alto;
- tasa de cuadros racional;
- códec de video o imagen;
- bitrate cuando está disponible;
- códec de audio;
- canales;
- frecuencia de muestreo;
- bitrate de audio cuando está disponible.

El parser rechaza respuestas incompletas. No se inventan valores ausentes.

### Procesamiento

El análisis se ejecuta dentro de un Worker Thread y usa la cola persistente del Bloque 8.

```text
Editor
└── IPC por projectId + mediaId
    └── MediaAnalysisService
        └── trabajo probe-media
            └── WorkerThreadJobExecutor
                └── FFprobe
                    └── JSON validado
                        └── media_assets.data_json
```

La aplicación limita la salida de FFprobe, aplica un tiempo máximo de 60 segundos y permite cancelar el proceso hijo.

### Persistencia

Los metadatos actualizan únicamente la fila del recurso multimedia. El análisis técnico:

- no reescribe todo el proyecto;
- no modifica clips o pistas;
- no genera snapshots;
- conserva la ruta y hash del archivo original;
- registra estado `pending`, `ready` o `failed`.

### Importación sin motores

La ausencia de FFprobe no invalida la importación. El recurso permanece registrado como pendiente y puede analizarse posteriormente desde el Editor cuando el motor esté disponible.

## Cola de trabajos

La cola persistente registra estado, prioridad, progreso, dependencias, intentos, resultado y error. Permite pausar, reanudar, cancelar, reintentar y recuperar trabajos interrumpidos.

En este bloque ya tienen ejecutor real:

- `diagnostic-worker`;
- `probe-media`.

Los demás tipos se incorporarán gradualmente.

## Importación de medios

Formatos registrados inicialmente:

- video: MP4, M4V, MOV, MKV, WEBM y AVI;
- audio: MP3, WAV, M4A, AAC, FLAC, OGG y OPUS;
- imagen: PNG, JPG, JPEG, WEBP, GIF y BMP.

Antes de guardar cada recurso, la aplicación valida ruta, tamaño, extensión y firma binaria, calcula SHA-256 por streaming y busca duplicados. Los originales no se copian, renombran ni modifican.

## Persistencia local

SQLite utiliza:

- tablas separadas por entidad;
- claves foráneas y borrado en cascada;
- modo WAL;
- migraciones con checksum;
- esquema versión 3;
- snapshots de recuperación;
- repositorios especializados para trabajos y medios;
- respaldos externos con SHA-256;
- retención automática.

## Seguridad

- React no accede a Node.js, SQLite ni Worker Threads.
- El renderer solo envía identificadores tipados.
- Las rutas de archivos provienen del selector nativo o de SQLite.
- Los comandos de motores se resuelven en el proceso principal.
- FFprobe se ejecuta sin shell.
- Los originales nunca se modifican.
- Los resultados se validan antes de marcar el trabajo como completado.

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

- Los originales nunca se modificarán.
- Todo IPC debe declararse, tiparse y validarse.
- Los procesos pesados se ejecutan fuera del renderer.
- Los resultados técnicos se validan antes de persistirse.
- Los avances y metadatos no deben crear snapshots innecesarios.
- Los motores deben ser reemplazables mediante contratos.
- Cada bloque debe compilar y superar pruebas antes de fusionarse.

## Siguiente bloque

**Bloque 10 — Proxies, miniaturas, formas de onda y caché multimedia.**
