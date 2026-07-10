<!-- =========================================================
Nombre completo: BLOQUE_10.md
Ruta o ubicación: /docs/BLOQUE_10.md

Función o funciones:
- Registrar el alcance técnico del Bloque 10.
- Documentar generación, persistencia y limpieza de derivados.
- Mantener trazabilidad para el análisis de audio del siguiente bloque.
========================================================= -->

# Bloque 10 — Proxies, miniaturas, formas de onda y caché multimedia

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Generar archivos optimizados y regenerables mediante FFmpeg, almacenarlos fuera de los originales y proporcionar una caché local segura para acelerar el Editor y preparar el análisis automático de audio.

## Alcance

Este bloque incorpora:

- proxies MP4 para video;
- miniaturas JPG para videos e imágenes;
- formas de onda PNG para videos con audio y archivos de audio;
- planificación automática después de FFprobe;
- generación manual desde el Editor cuando faltan derivados;
- trabajos persistentes con progreso, pausa, cancelación y reintento;
- escritura temporal y reemplazo atómico;
- claves de caché deterministas;
- persistencia especializada en SQLite;
- reconciliación al iniciar;
- eliminación de temporales y archivos huérfanos;
- limpieza manual desde Ajustes;
- protocolo interno para servir previsualizaciones;
- pruebas unitarias y de extremo a extremo.

## Arquitectura

```text
Medio analizado
└── MediaDerivativeService
    ├── decide derivados necesarios
    ├── calcula cacheKey
    ├── reutiliza archivo válido
    └── crea trabajo persistente
        └── JobQueueService
            └── WorkerThreadJobExecutor
                └── background-worker
                    └── FFmpeg
                        ├── archivo parcial
                        ├── validación de tamaño
                        ├── rename atómico
                        └── SHA-256 final
                            └── MediaDerivativeJobHandler
                                ├── valida ruta e ID
                                ├── actualiza media_assets
                                └── elimina versión anterior
```

La caché está desacoplada del proyecto completo. Ninguna generación técnica reescribe pistas, clips, secuencias o textos.

## Planificación por tipo de medio

| Tipo | Proxy | Miniatura | Forma de onda |
|---|---:|---:|---:|
| Video con audio | Sí | Sí | Sí |
| Video sin audio | Sí | Sí | No |
| Audio | No | No | Sí |
| Imagen | No | Sí | No |

Un recurso debe estar:

- disponible en su ruta original;
- asociado al proyecto solicitado;
- analizado correctamente por FFprobe;
- dentro de un proyecto no archivado.

## Generación automática

Después de aplicar un resultado válido de `probe-media`, `MediaProbeJobHandler` intenta planificar los derivados del recurso.

Los nuevos trabajos incluyen como dependencia el trabajo de FFprobe. Por eso no pueden iniciar hasta que el análisis esté marcado como completado.

La falta de FFmpeg no invalida el resultado de FFprobe. En ese caso:

- el medio conserva sus metadatos;
- la inspección queda `ready`;
- los derivados quedan pendientes;
- el usuario puede solicitarlos después desde el Editor.

## Generación manual

El renderer envía únicamente:

```text
projectId
mediaId
```

El proceso principal recupera:

- ruta original;
- tipo de medio;
- metadatos;
- hash;
- derivados existentes;
- proyecto relacionado;
- ejecutable y versión de FFmpeg.

React no puede definir rutas de salida, comandos, filtros ni argumentos.

## Proxy de video

Formato final:

```text
MP4
H.264 / libx264
AAC opcional
```

Parámetros principales:

- dimensión máxima de 1280 × 720;
- relación de aspecto conservada;
- dimensiones divisibles para codificación;
- preset `veryfast`;
- CRF 28;
- píxeles `yuv420p`;
- audio AAC a 128 kbps cuando existe;
- `+faststart`.

El proxy está diseñado para edición y previsualización, no para sustituir la exportación final.

## Miniatura

Formato final:

```text
JPG
máximo 640 × 360
```

Para videos:

- se busca aproximadamente el 10 % de la duración;
- el tiempo se limita a cinco segundos;
- se extrae un solo cuadro.

Para imágenes:

- se procesa el primer cuadro disponible;
- se conserva la relación de aspecto.

## Forma de onda

Formato final:

```text
PNG
1200 × 240
```

El audio se normaliza a una disposición mono para representación visual y se procesa mediante `showwavespic`.

La forma de onda es una previsualización. No reemplaza el audio original ni contiene una copia reproducible del sonido.

## Progreso de FFmpeg

FFmpeg se ejecuta con:

```text
-progress pipe:1
-nostats
-loglevel error
```

El Worker interpreta pares `clave=valor`, principalmente:

```text
out_time_us=<microsegundos>
progress=continue
progress=end
```

El progreso calculado se limita antes del 100 %. La cola solo establece 100 % después de validar y persistir el resultado.

## Escritura atómica

Cada trabajo utiliza:

```text
archivo-final.ext
archivo-final.partial-<hash-del-job>.ext
```

Flujo:

1. Se elimina cualquier temporal anterior del mismo trabajo.
2. FFmpeg escribe únicamente en el temporal.
3. Se valida que el archivo exista y tenga contenido.
4. Se elimina una salida final obsoleta.
5. Se ejecuta `rename` dentro del mismo directorio.
6. Se calcula SHA-256 y tamaño.
7. Se envía el resultado al proceso principal.
8. SQLite registra el derivado.

Si FFmpeg falla o el usuario cancela:

- se mata el proceso hijo;
- se elimina el temporal;
- no se registra un derivado incompleto;
- la versión anterior permanece disponible hasta que exista un reemplazo válido.

## Claves de caché

Cada `cacheKey` utiliza SHA-256 sobre:

- versión del generador;
- tipo de derivado;
- hash del original o huella de ruta/tamaño/fecha;
- metadatos técnicos;
- versión de FFmpeg.

Esto permite invalidar automáticamente un derivado cuando cambia:

- el original;
- su análisis;
- el algoritmo de generación;
- el motor multimedia.

## Rutas

La caché se almacena en:

```text
<userData>/cache/media
```

La estructura no utiliza nombres proporcionados por el usuario:

```text
media/
└── <hash-proyecto>/
    └── <hash-medio>/
        ├── proxy-<cacheKey>.mp4
        ├── thumbnail-<cacheKey>.jpg
        └── waveform-<cacheKey>.png
```

Los segmentos se derivan mediante SHA-256. Se valida toda ruta con `resolve` y `relative` antes de crear, leer o borrar archivos.

## Protección contra traversal

`MediaCachePaths` rechaza:

- rutas fuera del directorio raíz;
- `..` que escape de la caché;
- el propio directorio raíz como archivo;
- derivados registrados fuera de la ubicación administrada.

Las operaciones de borrado solo aceptan rutas confirmadas por `assertManagedPath`.

## Persistencia

`SqliteMediaAssetRepository` puede listar todos los recursos y actualizar uno individualmente.

Cada derivado almacena:

```text
id
type
path
cacheKey
createdAt
```

Al completar un trabajo:

1. se valida el resultado;
2. se comprueba la ruta esperada;
3. se confirma que el archivo existe y no está vacío;
4. se reemplaza el derivado del mismo tipo en SQLite;
5. después se elimina el archivo anterior.

No se crean snapshots por progreso, generación, reemplazo o limpieza.

## Reutilización

Antes de crear un trabajo, el servicio comprueba:

- tipo solicitado;
- `cacheKey` correspondiente;
- existencia y tamaño del archivo;
- trabajos activos para el mismo medio y tipo.

Resultados posibles:

- `queuedCount`: trabajos nuevos;
- `reusedCount`: derivados válidos reutilizados;
- `skippedCount`: trabajos que ya estaban activos.

## Reconciliación

Al iniciar Electron, antes de recuperar la cola:

1. se crea el directorio raíz;
2. se eliminan archivos parciales;
3. se recorren los derivados registrados;
4. se eliminan de SQLite referencias inexistentes o externas;
5. se identifican archivos no referenciados;
6. se eliminan huérfanos;
7. se calcula el estado final.

Esto corrige cierres inesperados sin reconstruir toda la base de datos.

## Limpieza manual

Ajustes muestra:

- tamaño total;
- cantidad de archivos;
- derivados registrados;
- temporales;
- huérfanos;
- ubicación administrada.

La limpieza:

- requiere confirmación;
- se bloquea si existen trabajos de proxy, miniatura u onda en estado activo;
- elimina el árbol de caché;
- vuelve a crear el directorio;
- borra referencias de derivados en SQLite;
- conserva originales, proyectos y metadatos.

## Protocolo interno

Las previsualizaciones utilizan:

```text
editar-cache://derivative/<derivativeId>
```

El protocolo:

1. valida estructura y host;
2. valida el ID tipado;
3. busca el derivado en SQLite;
4. confirma la ruta administrada;
5. confirma existencia del archivo;
6. sirve el contenido mediante `net.fetch`.

No acepta rutas ni parámetros de archivo desde el renderer.

La CSP permite `editar-cache:` únicamente para imágenes y medios.

## Interfaz

### Editor

Cada tarjeta puede mostrar:

- miniatura del video o imagen;
- forma de onda del audio;
- chip de proxy;
- chip de miniatura;
- chip de onda;
- estado pendiente o listo;
- botón `Optimizar` cuando faltan derivados.

El proyecto se refresca solo mientras existen análisis o trabajos derivados activos.

### Centro de trabajos

Se muestran como operaciones reales:

- Generar proxy;
- Generar miniatura;
- Generar forma de onda.

Mantienen controles de pausa, cancelación y reintento.

### Ajustes

Incluye un panel completo de caché con actualización y limpieza.

## Errores controlados

Entre los códigos incorporados están:

```text
FFMPEG_UNAVAILABLE
FFMPEG_START_ERROR
FFMPEG_TIMEOUT
FFMPEG_EMPTY_OUTPUT
FFMPEG_EXECUTION_ERROR
FFMPEG_ENCODER_UNAVAILABLE
FFMPEG_STREAM_UNAVAILABLE
SOURCE_FILE_UNAVAILABLE
JOB_RESULT_APPLY_ERROR
```

Errores de formato, stream ausente o codificador no disponible no se reintentan automáticamente. Errores transitorios pueden usar el segundo intento de la cola.

## Límites

- El proxy depende de que FFmpeg incluya `libx264` y AAC.
- Este bloque no usa aceleración por GPU.
- Todavía no existe selector de calidad de proxy.
- Se genera una miniatura principal, no una tira de fotogramas.
- La forma de onda es una imagen, no datos de amplitud interactivos.
- El protocolo busca derivados en SQLite; una futura optimización puede incorporar un índice en memoria.
- Los binarios de FFmpeg y FFprobe no están incluidos todavía en GitHub.

## Pruebas

### Dominio

- agregar un derivado;
- reemplazar solo el mismo tipo;
- conservar los demás tipos;
- eliminar por ID;
- retener por predicado;
- limpiar todos;
- conservar original y metadatos.

### Rutas

- rutas deterministas;
- extensión correcta;
- temporal con extensión final;
- ruta administrada;
- rechazo de rutas externas;
- rechazo del directorio raíz;
- escaneo recursivo;
- suma de tamaños;
- limpieza de temporales.

### Extremo a extremo

La prueba ejecuta:

```text
MediaDerivativeService
→ JobQueueService
→ WorkerThreadJobExecutor
→ proceso FFmpeg simulado
→ archivos parciales
→ rename final
→ MediaDerivativeJobHandler
→ SQLite
```

Comprueba:

- creación de tres trabajos;
- proxy, miniatura y onda;
- progreso y finalización;
- archivos no vacíos;
- ausencia de `.partial-` al terminar;
- persistencia de tres derivados;
- reutilización sin crear nuevos trabajos;
- ausencia de snapshots;
- estado de caché;
- detección de huérfanos y temporales;
- reconciliación;
- limpieza física y lógica.

## Verificación realizada

GitHub Actions confirmó:

1. Typecheck del renderer.
2. Typecheck de Electron.
3. Compilación del renderer.
4. Compilación del proceso principal, preload y Workers.
5. Pruebas de los bloques anteriores.
6. Pruebas de operaciones de derivados.
7. Pruebas de rutas y traversal.
8. Pruebas de FFmpeg simulado dentro de Worker Threads.
9. Persistencia y reutilización en SQLite.
10. Reconciliación y limpieza de caché.

## Archivos creados

1. `/apps/desktop/shared/domain/media-derivative-operations.ts`
2. `/apps/desktop/shared/media-cache-contracts.ts`
3. `/apps/desktop/main/media/media-cache-paths.ts`
4. `/apps/desktop/main/media/media-cache-service.ts`
5. `/apps/desktop/main/media/media-derivative-service.ts`
6. `/apps/desktop/main/media/media-cache-protocol.ts`
7. `/apps/desktop/main/jobs/composite-job-result-handler.ts`
8. `/apps/desktop/main/jobs/media-derivative-job-handler.ts`
9. `/apps/desktop/renderer/src/app/use-media-cache.ts`
10. `/apps/desktop/renderer/src/components/settings/MediaCacheStatusPanel.tsx`
11. `/apps/desktop/renderer/src/media-cache.css`
12. `/tests/media-derivative-operations.test.mjs`
13. `/tests/media-cache-paths.test.mjs`
14. `/tests/media-derivatives.test.mjs`
15. `/docs/BLOQUE_10.md`

## Archivos actualizados

1. `/apps/desktop/shared/domain/index.ts`
2. `/apps/desktop/shared/persistence/media-asset-repository.ts`
3. `/apps/desktop/shared/media-import-contracts.ts`
4. `/apps/desktop/shared/ipc-contracts.ts`
5. `/apps/desktop/main/database/sqlite-media-asset-repository.ts`
6. `/apps/desktop/main/jobs/media-probe-job-handler.ts`
7. `/apps/desktop/main/jobs/background-worker.ts`
8. `/apps/desktop/main/jobs/worker-thread-job-executor.ts`
9. `/apps/desktop/main/media/media-request-validation.ts`
10. `/apps/desktop/main/ipc/register-media-ipc.ts`
11. `/apps/desktop/main/main.ts`
12. `/apps/desktop/preload/preload.cts`
13. `/apps/desktop/renderer/index.html`
14. `/apps/desktop/renderer/src/components/media/ProjectMediaPanel.tsx`
15. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
16. `/apps/desktop/renderer/src/screens/SettingsScreen.tsx`
17. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
18. `/apps/desktop/renderer/src/screens/JobsScreen.tsx`
19. `/apps/desktop/renderer/src/main.tsx`
20. `/package.json`
21. `/README.md`

## Próximo bloque

Bloque 11: análisis de audio y detección de silencios.
