<!-- =========================================================
Nombre completo: README.md
Ruta o ubicación: /README.md

Función o funciones:
- Documentar la finalidad y arquitectura actual del proyecto.
- Explicar análisis acústico, reducción de silencios y verificación.
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
- **Bloque 10:** proxies, miniaturas, formas de onda y caché.
- **Bloque 11:** análisis de audio y detección de silencios.
- **Bloque 12:** corte y reducción automática de silencios.

La aplicación puede analizar videos y audios, identificar pausas mediante FFmpeg y producir una versión nueva con los silencios acortados o eliminados. Los originales nunca se modifican.

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

## Desarrollo

```powershell
npm run dev
```

## Verificación

```powershell
npm run verify
```

Pruebas específicas de los Bloques 11 y 12:

```powershell
npm run test:audio
```

La verificación incluye:

1. Typecheck del renderer y Electron.
2. Compilación de React, preload, proceso principal y Workers.
3. Pruebas de seguridad, IPC, navegación y dominio.
4. Pruebas de SQLite, proyectos, importación y caché.
5. Parser de eventos `silence_start` y `silence_end`.
6. Métricas de silencio, segmentos superpuestos y proporciones.
7. Planes de acortado y eliminación con márgenes de seguridad.
8. Ejecución real de Worker Thread con FFmpeg simulado.
9. Persistencia de análisis y versión reducida en SQLite.
10. Archivos temporales, reemplazo atómico, reutilización y snapshots.

## Ejecución compilada

```powershell
npm start
```

## Análisis acústico

Después de que FFprobe confirma que el recurso contiene audio, la aplicación puede ejecutar `silencedetect`.

Configuración predeterminada:

```text
Umbral: -35 dB
Duración mínima: 500 ms
```

El análisis registra:

- fecha de análisis;
- clave SHA-256 de la configuración y el original;
- duración total;
- umbral;
- duración mínima;
- segmentos de silencio;
- tiempo silencioso;
- tiempo audible;
- porcentaje de silencio.

Los segmentos superpuestos se fusionan antes de calcular las métricas. El análisis anterior se conserva hasta que una nueva ejecución termine correctamente.

## Modos de reducción

### Acortar silencios

Conserva por defecto hasta 300 ms de cada pausa detectada, además de respetar márgenes de seguridad alrededor del audio audible.

### Eliminar silencios

Retira la mayor parte de cada pausa, pero conserva por defecto 80 ms en cada borde para reducir cortes bruscos de palabras o respiraciones.

Los dos modos producen una versión nueva. El original continúa siendo la fuente principal del proyecto.

## Plan de corte

Antes de ejecutar FFmpeg, el dominio genera un plan validado con:

- rangos originales que deben conservarse;
- duración original;
- duración esperada de salida;
- duración eliminada;
- silencio retenido;
- modo y márgenes aplicados;
- clave del análisis acústico utilizado.

Controles aplicados:

- no puede eliminarse todo el contenido;
- máximo de 500 rangos conservados;
- tiempos enteros en microsegundos;
- los rangos deben estar dentro de la duración original;
- la duración calculada debe coincidir con la suma de los rangos.

## Render de la versión reducida

FFmpeg utiliza filtros por cada rango conservado:

```text
Video: trim + atrim + setpts + asetpts + concat
Audio: atrim + asetpts + concat
```

Salida para video:

- MP4;
- H.264 mediante `libx264`;
- audio AAC;
- `faststart`;
- píxeles `yuv420p`.

Salida para audio:

- M4A;
- audio AAC a 192 kbps.

## Flujo completo

```text
Importación
└── FFprobe
    ├── derivados de caché
    └── detect-silence
        └── AudioAnalysis en SQLite
            └── reduce-silence
                ├── plan validado
                ├── filter script temporal
                ├── salida parcial
                ├── validación
                ├── rename atómico
                └── derivado silence-reduced en SQLite
```

## Worker dedicado de audio

Los trabajos:

- `detect-silence`;
- `reduce-silence`;

se ejecutan en `audio-background-worker.ts`, separado del Worker general de FFprobe, proxies y miniaturas.

El Worker dedicado:

- ejecuta FFmpeg sin shell;
- reporta progreso;
- limita la salida capturada;
- aplica tiempo máximo;
- responde a cancelación;
- termina el proceso hijo;
- elimina temporales y scripts auxiliares.

## Caché y seguridad

La versión reducida vive dentro de:

```text
<userData>/cache/media
```

Características:

- nombre determinista basado en SHA-256;
- `.mp4` para video y `.m4a` para audio;
- escritura a archivo `.partial-*`;
- filtro temporal `.aux-*`;
- validación de ruta administrada;
- eliminación de temporales al iniciar;
- bloqueo de limpieza mientras exista un trabajo de reducción activo.

La interfaz accede al resultado mediante:

```text
editar-cache://derivative/<derivativeId>
```

React no recibe rutas físicas, comandos de FFmpeg ni filtros complejos.

## Persistencia

`MediaAsset` puede contener:

```text
audioAnalysis
silenceReduction
derivatives[]
```

El plan se guarda junto con el derivado `silence-reduced`. Si el análisis técnico cambia, se eliminan el análisis acústico, el plan y la versión reducida obsoleta.

No se generan snapshots por:

- progreso;
- detección de silencios;
- reducción de silencios;
- reemplazo de un derivado;
- reintentos.

## Interfaz

### Editor

Cada medio con audio puede mostrar:

- número de silencios;
- duración silenciosa;
- porcentaje del audio;
- duración reducida;
- botón `Analizar audio` o `Reanalizar audio`;
- botón `Acortar`;
- botón `Eliminar`;
- indicador `Sin silencios ✓` cuando existe una versión procesada.

### Centro de trabajos

Muestra:

- Detectar silencios;
- Reducir silencios;
- progreso;
- pausas;
- cancelación;
- reintentos;
- errores controlados.

## Trabajos con ejecución real

- `diagnostic-worker`;
- `probe-media`;
- `generate-proxy`;
- `generate-thumbnails`;
- `generate-waveform`;
- `detect-silence`;
- `reduce-silence`.

## Principios de seguridad

- Los originales nunca se modifican.
- El renderer solo envía IDs y parámetros limitados.
- Las rutas se recuperan desde SQLite.
- Los comandos se resuelven en el proceso principal.
- FFmpeg se ejecuta con `shell: false`.
- Los filtros se generan internamente.
- Todo archivo debe permanecer dentro de la caché.
- Un resultado no persistido impide completar el trabajo.
- El análisis anterior se conserva ante un fallo.
- La salida anterior se conserva hasta validar su reemplazo.

## Siguiente bloque

**Bloque 13 — Línea de tiempo y edición funcional de clips.**
