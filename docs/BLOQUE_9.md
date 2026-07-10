<!-- =========================================================
Nombre completo: BLOQUE_9.md
Ruta o ubicación: /docs/BLOQUE_9.md

Función o funciones:
- Registrar el alcance técnico del Bloque 9.
- Documentar integración, seguridad y persistencia de FFprobe.
- Mantener trazabilidad para proxies y caché del siguiente bloque.
========================================================= -->

# Bloque 9 — Integración de FFmpeg y FFprobe

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Integrar una capa segura y reemplazable para localizar FFmpeg y FFprobe, ejecutar inspecciones técnicas fuera del renderer y persistir metadatos reales de videos, audios e imágenes.

## Alcance real

Este bloque incorpora:

- detección y diagnóstico de FFmpeg;
- detección y ejecución real de FFprobe;
- análisis automático después de importar;
- análisis manual desde el Editor;
- metadatos técnicos persistentes;
- errores y reintentos mediante la cola;
- diagnóstico visual en Ajustes;
- pruebas unitarias y de extremo a extremo.

FFmpeg todavía no genera proxies, miniaturas, formas de onda ni exportaciones. Esas operaciones pertenecen a bloques posteriores.

Los binarios grandes tampoco se incorporan todavía al repositorio. La aplicación admite ejecutables instalados, configurados o colocados en `resources/bin`.

## Arquitectura

```text
ProjectMediaPanel
└── window.editar.media.analyze({ projectId, mediaId })
    └── preload aislado
        └── IPC validado
            └── MediaAnalysisService
                ├── FfmpegBinaryService
                ├── SqliteMediaAssetRepository
                └── trabajo probe-media
                    └── JobQueueService
                        └── WorkerThreadJobExecutor
                            └── background-worker
                                └── FFprobe
                                    └── JSON
                                        └── ffprobe-parser
                                            └── MediaProbeJobHandler
                                                └── SQLite
```

La interfaz nunca recibe acceso a `spawn`, rutas arbitrarias, comandos del sistema ni la conexión SQLite.

## Resolución de binarios

`FfmpegBinaryService` busca cada herramienta en este orden:

1. variables `EDITAR_FFMPEG_PATH` y `EDITAR_FFPROBE_PATH`;
2. `process.resourcesPath/bin`;
3. `app.getAppPath()/resources/bin`;
4. `resources/bin` del espacio de trabajo;
5. `PATH` del sistema operativo.

Cada candidato se prueba con `-version`.

La comprobación:

- usa `spawn` con `shell: false`;
- oculta ventanas auxiliares en Windows;
- aplica un límite de tiempo;
- captura salida limitada;
- conserva versión, comando y origen;
- devuelve un estado controlado si no se encuentra el ejecutable.

## Contrato reemplazable

Los consumidores dependen de `MediaEngineProvider`, no de una implementación concreta.

```text
MediaEngineProvider
├── getStatus(force?)
└── getCommand(tool, force?)
```

Esto permite:

- cambiar la estrategia de empaquetado;
- usar ejecutables incluidos por el instalador;
- sustituir el proveedor durante pruebas;
- incorporar motores alternativos sin modificar el análisis.

## Ejecución de FFprobe

El Worker ejecuta FFprobe con argumentos estructurados:

```text
-v error
-print_format json
-show_format
-show_streams
-show_error
<ruta del medio>
```

No se construye una línea de comandos para shell.

Controles aplicados:

- salida estándar máxima de 8 MB;
- salida de error máxima de 1 MB;
- tiempo máximo de 60 segundos;
- cancelación cooperativa desde el proceso principal;
- terminación forzada del Worker si no responde;
- clasificación de errores conocidos;
- serialización explícita antes de cruzar el límite del Worker.

## Metadatos admitidos

### Video

- duración en microsegundos;
- ancho;
- alto;
- tasa de cuadros racional;
- códec de video;
- bitrate;
- stream principal de audio cuando existe.

### Audio

- duración en microsegundos;
- códec;
- canales;
- frecuencia de muestreo;
- bitrate cuando existe.

### Imagen

- ancho;
- alto;
- formato o códec de imagen.

## Selección de streams

El parser:

- separa streams de video y audio;
- evita usar una portada adjunta como video principal cuando existe un video real;
- utiliza `avg_frame_rate` y después `r_frame_rate`;
- conserva numerador y denominador del FPS;
- usa duración del contenedor y después del stream;
- rechaza duración, resolución, canales o códecs inválidos.

No se asignan valores ficticios cuando FFprobe no entrega información suficiente.

## Flujo después de importar

1. El selector nativo entrega las rutas al proceso principal.
2. La importación valida firma, extensión, tamaño y SHA-256.
3. El proyecto se guarda con un snapshot de importación.
4. Cada medio nuevo intenta crear un trabajo `probe-media`.
5. Si FFprobe está disponible, el trabajo entra a la cola.
6. Si no está disponible, la importación termina correctamente y el análisis queda diferido.
7. El Editor actualiza el proyecto mientras existan medios pendientes.
8. Cuando FFprobe termina, la fila multimedia cambia a `ready` o `failed`.

## Análisis manual

El Editor permite analizar medios pendientes o fallidos.

El renderer solo envía:

```text
projectId
mediaId
```

El proceso principal recupera de SQLite:

- ruta original;
- tipo esperado;
- proyecto relacionado.

Después resuelve FFprobe y crea el payload interno. El renderer no puede inyectar rutas, ejecutables ni argumentos.

## Prevención de duplicados

Antes de crear un trabajo, `MediaAnalysisService` busca otro `probe-media` para el mismo recurso con estado:

- `pending`;
- `preparing`;
- `running`;
- `paused`.

Si existe, devuelve el identificador del trabajo activo y no inserta otro.

## Persistencia especializada

`SqliteMediaAssetRepository` actualiza únicamente la fila de `media_assets`.

El análisis técnico:

- no guarda nuevamente el proyecto completo;
- no borra ni recrea entidades relacionadas;
- no genera snapshots;
- mantiene columnas normalizadas y `data_json` sincronizados;
- conserva hash, ruta, tamaño y fecha de importación.

## Aplicación de resultados

`MediaProbeJobHandler` se ejecuta antes de marcar el trabajo como completado.

### Éxito

- valida nuevamente los metadatos mediante el dominio;
- cambia inspección a `ready`;
- registra `inspectedAt`;
- conserva disponibilidad `online`;
- actualiza SQLite;
- después permite que la cola marque el trabajo `completed`.

### Fallo definitivo

- cambia inspección a `failed`;
- guarda una explicación visible;
- elimina metadatos parciales;
- marca disponibilidad `missing` si el original desapareció;
- mantiene el trabajo como `failed`.

### Reintento

- restablece inspección a `pending`;
- borra el error anterior;
- vuelve a ejecutar desde cero;
- conserva el control de intentos de la cola.

## Errores controlados

Entre los códigos incorporados están:

```text
FFPROBE_UNAVAILABLE
FFPROBE_START_ERROR
FFPROBE_TIMEOUT
FFPROBE_OUTPUT_LIMIT
FFPROBE_EXECUTION_ERROR
FFPROBE_INVALID_MEDIA
SOURCE_FILE_UNAVAILABLE
INVALID_JSON
DURATION_UNAVAILABLE
FRAME_RATE_UNAVAILABLE
VIDEO_STREAM_UNAVAILABLE
AUDIO_STREAM_UNAVAILABLE
IMAGE_STREAM_UNAVAILABLE
JOB_RESULT_APPLY_ERROR
```

Cada error indica si es razonable reintentar automáticamente.

## Interfaz

### Editor

El panel de medios muestra:

- nombre;
- extensión y tamaño cuando está pendiente;
- duración;
- resolución;
- FPS;
- códec de video o imagen;
- códec de audio;
- canales;
- frecuencia de muestreo;
- estado de inspección;
- error;
- botón de análisis manual.

El encabezado informa si FFprobe está disponible.

### Ajustes

El diagnóstico muestra para FFmpeg y FFprobe:

- disponible o no disponible;
- origen;
- versión;
- comando resuelto;
- fecha de comprobación;
- error;
- botón para comprobar nuevamente.

### Centro de trabajos

El tipo `probe-media` aparece como “Analizar medio” y utiliza los controles existentes de pausa, cancelación y reintento.

## Seguridad

- `spawn` solo se ejecuta en el Worker.
- Se usa `shell: false`.
- El renderer no entrega rutas.
- El renderer no entrega comandos.
- Los identificadores se validan por tipo.
- El recurso debe pertenecer al proyecto.
- Un proyecto archivado no admite análisis nuevos.
- El archivo debe estar disponible.
- Los resultados se validan antes de persistirlos.
- Un resultado que no puede guardarse impide completar el trabajo.
- El proceso hijo se termina durante cancelación o cierre.

## Binarios locales

Archivos esperados en Windows:

```text
resources/bin/ffmpeg.exe
resources/bin/ffprobe.exe
```

La carpeta incluye un README, pero no los ejecutables. Esto evita agregar binarios grandes sin una decisión de versión, licencia y estrategia de actualización.

## Pruebas incorporadas

### Parser

- video H.264 con audio AAC;
- duración en microsegundos;
- FPS `30000/1001`;
- audio FLAC;
- imagen PNG;
- portada adjunta;
- duración ausente;
- FPS inválido;
- JSON corrupto;
- error reportado por FFprobe.

### Resolución de binarios

- prioridad de variables de entorno;
- recursos del proyecto antes de `PATH`;
- fallback a `PATH`;
- estado no disponible;
- error al solicitar un comando ausente;
- caché y comprobación forzada.

### Extremo a extremo

La prueba real utiliza:

```text
MediaAnalysisService
→ JobQueueService
→ WorkerThreadJobExecutor
→ proceso hijo simulado
→ parser
→ MediaProbeJobHandler
→ SQLite
```

Comprueba:

- inserción de trabajo;
- prevención de duplicados;
- progreso y finalización;
- metadatos persistidos;
- documento reconstruido;
- ausencia de snapshots técnicos;
- clasificación de medio inválido;
- inspección fallida sin metadatos parciales.

## Verificación realizada

GitHub Actions confirmó:

1. Typecheck del renderer.
2. Typecheck de Electron.
3. Compilación del renderer.
4. Compilación del proceso principal y Worker.
5. Todas las pruebas anteriores.
6. Nuevas pruebas de FFmpeg y FFprobe.
7. Prueba de extremo a extremo con proceso hijo.
8. Compatibilidad con los bloques 1 al 8.

## Archivos creados

1. `/apps/desktop/shared/media-engine-contracts.ts`
2. `/apps/desktop/shared/persistence/media-asset-repository.ts`
3. `/apps/desktop/main/database/sqlite-media-asset-repository.ts`
4. `/apps/desktop/main/media/ffmpeg-binary-service.ts`
5. `/apps/desktop/main/media/ffprobe-parser.ts`
6. `/apps/desktop/main/media/media-analysis-service.ts`
7. `/apps/desktop/main/media/media-request-validation.ts`
8. `/apps/desktop/main/jobs/job-result-handler.ts`
9. `/apps/desktop/main/jobs/media-probe-job-handler.ts`
10. `/apps/desktop/renderer/src/app/use-media-engine-status.ts`
11. `/apps/desktop/renderer/src/app/use-media-analysis.ts`
12. `/apps/desktop/renderer/src/components/settings/MediaEngineStatusPanel.tsx`
13. `/apps/desktop/renderer/src/media-engine.css`
14. `/resources/bin/README.md`
15. `/tests/ffprobe-parser.test.mjs`
16. `/tests/ffmpeg-binary-service.test.mjs`
17. `/tests/media-analysis.test.mjs`
18. `/docs/BLOQUE_9.md`

## Archivos actualizados

1. `/apps/desktop/shared/domain/media.ts`
2. `/apps/desktop/shared/media-import-contracts.ts`
3. `/apps/desktop/shared/ipc-contracts.ts`
4. `/apps/desktop/main/database/database-service.ts`
5. `/apps/desktop/main/jobs/background-worker.ts`
6. `/apps/desktop/main/jobs/worker-thread-job-executor.ts`
7. `/apps/desktop/main/jobs/job-queue-service.ts`
8. `/apps/desktop/main/media/media-import-service.ts`
9. `/apps/desktop/main/ipc/register-media-ipc.ts`
10. `/apps/desktop/main/main.ts`
11. `/apps/desktop/preload/preload.cts`
12. `/apps/desktop/renderer/src/components/media/ProjectMediaPanel.tsx`
13. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
14. `/apps/desktop/renderer/src/screens/SettingsScreen.tsx`
15. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
16. `/apps/desktop/renderer/src/main.tsx`
17. `/package.json`
18. `/README.md`

## Próximo bloque

Bloque 10: proxies, miniaturas, formas de onda y caché multimedia.
