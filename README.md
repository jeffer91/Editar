<!-- =========================================================
Nombre completo: README.md
Ruta o ubicación: /README.md

Función o funciones:
- Documentar la finalidad y arquitectura actual del proyecto.
- Explicar línea de tiempo, mezcla de audio y efectos visuales.
- Registrar los bloques completados y el siguiente bloque.
========================================================= -->

# Editar

Aplicación de escritorio modular para edición de video, tratamiento de audio, textos animados, efectos, transiciones y automatización futura.

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
- **Bloque 13:** línea de tiempo y edición funcional de clips.
- **Bloque 14:** textos, títulos y subtítulos animados.
- **Bloque 15:** edición y mezcla de audio por clip.
- **Bloque 16:** efectos y animaciones de video.

La aplicación ya puede importar y analizar medios, detectar silencios, construir una secuencia, editar clips, crear textos, configurar mezcla de audio y aplicar propiedades visuales. Los originales nunca se modifican.

## Requisitos

- Node.js 22.16 o superior.
- npm 10 o superior.
- Windows 10 u 11 como plataforma inicial.
- FFmpeg y FFprobe disponibles mediante configuración, recursos locales o `PATH`.

## Instalación

```powershell
npm install
```

## Desarrollo

```powershell
npm run dev
```

## Verificación completa

```powershell
npm run verify
```

Pruebas específicas:

```powershell
npm run test:audio
npm run test:cache
npm run test:effects
npm run test:timeline
```

La verificación ejecuta:

1. TypeScript del renderer y Electron.
2. Compilación de React, preload, main y Workers.
3. Seguridad, IPC y navegación.
4. SQLite, migraciones, respaldos y proyectos.
5. Importación, FFprobe, FFmpeg y caché.
6. Cola, cancelación, reintentos y recuperación.
7. Detección y reducción de silencios.
8. Inserción, movimiento, recorte, división y eliminación de clips.
9. Plantillas, estilos y animaciones de texto.
10. Ganancia, paneo, fundidos y normalización por clip.
11. Transformaciones, filtros y animaciones visuales.
12. Persistencia, reapertura y snapshots.

## Configuración de FFmpeg y FFprobe

Orden de búsqueda:

1. `EDITAR_FFMPEG_PATH` y `EDITAR_FFPROBE_PATH`.
2. Recursos empaquetados.
3. `resources/bin` de la aplicación.
4. `resources/bin` del proyecto.
5. `PATH` del sistema.

En Windows:

```text
resources/bin/ffmpeg.exe
resources/bin/ffprobe.exe
```

Configuración temporal:

```powershell
$env:EDITAR_FFMPEG_PATH = "C:\ffmpeg\bin\ffmpeg.exe"
$env:EDITAR_FFPROBE_PATH = "C:\ffmpeg\bin\ffprobe.exe"
npm run dev
```

## Arquitectura

```text
Renderer React
└── preload con ContextBridge
    └── IPC tipado y validado
        └── servicios del proceso principal
            ├── SQLite
            ├── cola persistente
            ├── Worker Threads
            ├── FFprobe
            ├── FFmpeg
            ├── caché multimedia
            └── dominio no destructivo
```

Principios:

- el renderer no accede directamente a Node.js;
- toda operación IPC está declarada y validada;
- los originales no se modifican;
- las rutas físicas permanecen en el proceso principal;
- los trabajos pesados se ejecutan fuera del renderer;
- las ediciones funcionales crean snapshots recuperables;
- los resultados técnicos regenerables no crean snapshots innecesarios;
- los efectos se almacenan como parámetros serializables y versionados.

## Línea de tiempo funcional

Operaciones disponibles:

- añadir medios al final de la pista compatible;
- seleccionar clips;
- moverlos mediante el inspector;
- cambiar inicio y duración;
- cambiar el punto de entrada del original;
- dividir un clip;
- eliminarlo;
- silenciar, ocultar o bloquear pistas;
- ajustar el zoom temporal.

Los clips guardan tiempos enteros en microsegundos. La duración de cada secuencia se recalcula a partir del final más lejano.

### Compatibilidad

| Contenido | Pistas |
|---|---|
| Video | Video, superposición y audio cuando posee stream de audio |
| Audio | Audio |
| Imagen | Video o superposición |
| Texto | Texto o superposición |
| Generador | Video o superposición |
| Ajuste | Ajuste |

Las pistas principales de video y audio rechazan superposiciones. Las pistas de texto y superposición permiten elementos simultáneos.

### Snapshots

Cada operación funcional conserva hasta 50 estados recientes del proyecto.

```text
clip añadido
clip movido
clip recortado
clip dividido
clip eliminado
estado de pista actualizado
texto añadido
texto actualizado
mezcla de audio actualizada
efectos visuales actualizados
```

## Mezcla de audio

Los clips de audio y los videos con stream de audio admiten:

- ganancia entre -60 dB y +12 dB;
- paneo estéreo entre izquierda y derecha;
- silencio individual;
- fundido de entrada;
- fundido de salida;
- normalización opcional;
- pico objetivo de normalización.

La configuración se guarda como un efecto no destructivo:

```text
audio-mix
```

Parámetros:

```text
gainDb
pan
muted
fadeInUs
fadeOutUs
normalize
normalizationTargetDb
```

Los fundidos no pueden superar la duración del clip ni sumar más que su duración total.

Cuando todos los valores regresan a sus valores predeterminados, el efecto se elimina para evitar datos que no cambian el resultado.

La aplicación persiste la intención de mezcla. Su reproducción exacta y aplicación sobre el archivo exportado se incorporarán con el compilador de render.

## Efectos y animaciones de video

Propiedades editables:

- posición X e Y;
- escala X e Y;
- rotación;
- opacidad;
- punto de anclaje.

Presets visuales:

```text
cinematic
monochrome
warm
cool
vivid
soft-blur
sharpen
vignette
```

Animaciones:

```text
fade-in
fade-out
zoom-in
zoom-out
pan-left
pan-right
```

Curvas:

```text
linear
ease-in
ease-out
ease-in-out
```

Los presets se guardan como efectos separados:

```text
video-style
video-animation
```

Seleccionar `none` elimina el efecto correspondiente, pero conserva la transformación del clip.

La vista previa usa CSS para mostrar una aproximación interactiva. El render exacto fotograma por fotograma todavía no está compilado a FFmpeg o a un compositor dedicado.

## Textos animados

Plantillas:

- Título.
- Subtítulo.
- Rótulo inferior.
- Texto flotante.

Estilo persistente:

- tipografía;
- tamaño y peso;
- color;
- fondo y opacidad;
- alineación;
- interlineado;
- espaciado;
- ancho máximo.

Animaciones permitidas:

```text
fade
slide-up
slide-left
scale-in
typewriter
```

El monitor del Editor previsualiza el texto seleccionado y su animación. La composición final se incorporará en la fase de render y exportación.

## Audio y silencios

Configuración predeterminada de detección:

```text
Umbral: -35 dB
Duración mínima: 500 ms
```

Modos de reducción:

- **Acortar:** conserva aproximadamente 300 ms de cada pausa.
- **Eliminar:** conserva márgenes de seguridad de 80 ms por lado.

La versión resultante se guarda como derivado dentro de la caché. El original y el análisis anterior permanecen intactos.

## Caché multimedia

Ruta:

```text
<userData>/cache/media
```

Derivados actuales:

- proxy;
- miniatura;
- forma de onda;
- versión con silencios reducidos.

Características:

- claves SHA-256;
- archivos parciales;
- reemplazo atómico;
- reconciliación al iniciar;
- eliminación de temporales y huérfanos;
- protocolo interno `editar-cache://`;
- limpieza bloqueada durante trabajos activos.

## Trabajos con ejecución real

```text
diagnostic-worker
probe-media
generate-proxy
generate-thumbnails
generate-waveform
detect-silence
reduce-silence
```

Cada trabajo mantiene prioridad, progreso, intentos, dependencias, pausa, cancelación, error y recuperación.

## Persistencia

SQLite guarda:

- proyectos;
- secuencias;
- pistas;
- clips y transformaciones;
- capas de texto;
- efectos y parámetros;
- medios y metadatos;
- análisis acústicos;
- planes de reducción;
- derivados;
- trabajos;
- snapshots.

Los proyectos archivados son de solo lectura hasta restaurarse.

## Seguridad

- `nodeIntegration: false`;
- `contextIsolation: true`;
- `sandbox: true`;
- navegación externa bloqueada;
- IPC limitado por canales;
- remitentes verificados;
- payloads validados;
- FFmpeg y FFprobe con `shell: false`;
- rutas de salida confinadas a la caché;
- texto tratado como contenido, no como HTML;
- audio limitado a parámetros numéricos;
- efectos y animaciones restringidos a presets conocidos;
- no se aceptan comandos, shaders ni filtros arbitrarios desde el renderer.

## Estructura

```text
Editar/
├── apps/desktop/
│   ├── main/
│   │   ├── database/
│   │   ├── ipc/
│   │   ├── jobs/
│   │   ├── media/
│   │   ├── projects/
│   │   ├── security/
│   │   └── timeline/
│   ├── preload/
│   ├── renderer/src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── media/
│   │   │   └── timeline/
│   │   └── screens/
│   └── shared/
│       ├── domain/
│       └── persistence/
├── docs/
├── resources/bin/
├── tests/
└── package.json
```

## Límites actuales

- los clips se mueven desde campos numéricos, no mediante arrastrar y soltar;
- no existe cabezal de reproducción interactivo;
- no existe reproducción real de la composición completa;
- la mezcla se guarda, pero todavía no se escucha sobre la composición;
- los filtros y animaciones se previsualizan mediante CSS;
- no existen fotogramas clave personalizados;
- los efectos todavía no se compilan a una cadena final de render;
- no se han incorporado transiciones, efectos de sonido ni exportación final.

## Siguiente bloque

**Bloque 17 — Transiciones y efectos de sonido.**
