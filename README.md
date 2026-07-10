<!-- =========================================================
Nombre completo: README.md
Ruta o ubicación: /README.md

Función o funciones:
- Documentar la finalidad y arquitectura actual del proyecto.
- Explicar cómo instalar, ejecutar y verificar la aplicación.
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

La aplicación ya dispone de proceso principal, preload aislado, comunicación validada, shell responsivo, núcleo de dominio, almacenamiento SQLite, gestión de proyectos, importación de medios y una cola de trabajos ejecutada fuera del renderer.

## Requisitos

- Node.js 22.16 o superior.
- npm 10 o superior.
- Windows 10 u 11 como plataforma inicial objetivo.

## Instalación

```powershell
npm install
```

## Desarrollo

```powershell
npm run dev
```

Este comando inicia Vite, compila el proceso Electron y abre la aplicación.

## Verificación

```powershell
npm run verify
```

La verificación realiza:

1. Limpieza de compilaciones anteriores.
2. Comprobación de tipos del renderer.
3. Comprobación de tipos de Electron.
4. Compilación de React.
5. Compilación del proceso principal, preload, trabajadores y contratos.
6. Pruebas de seguridad e IPC.
7. Pruebas de navegación.
8. Pruebas del dominio completo.
9. Pruebas de migraciones, integridad y respaldos SQLite.
10. Pruebas de gestión de proyectos.
11. Pruebas de importación y firmas multimedia.
12. Pruebas reales de Worker Threads.
13. Pruebas de progreso, pausa, reanudación y cancelación.
14. Pruebas de prioridad y límite de concurrencia.
15. Pruebas de recuperación de trabajos interrumpidos.

Cuando falla el tipado, GitHub Actions conserva el diagnóstico completo como artefacto durante siete días.

## Ejecución compilada

```powershell
npm start
```

## Pantallas disponibles

- Inicio.
- Proyectos funcionales.
- Editor conectado al proyecto activo e importación de medios.
- Centro de trabajos.
- Biblioteca.
- Ajustes y diagnóstico.

## Cola de trabajos

La aplicación dispone de una cola persistente en SQLite para operaciones largas.

Cada trabajo registra:

- proyecto y tipo de operación;
- estado y porcentaje de progreso;
- prioridad;
- dependencias;
- intento actual y máximo permitido;
- datos de entrada y resultado;
- error controlado;
- fechas de creación, actualización, inicio y finalización.

Estados disponibles:

```text
pending     Esperando ejecución
preparing   Preparando recursos
running     Ejecutándose
paused      Detenido para reiniciarse después
cancelled   Cancelado por el usuario
completed   Finalizado correctamente
failed      Finalizado con error
```

La cola:

- ordena por prioridad y antigüedad;
- respeta dependencias entre trabajos;
- limita la cantidad de ejecuciones simultáneas;
- actualiza progreso sin generar snapshots del proyecto;
- permite pausar, reanudar, cancelar y reintentar;
- recupera al iniciar trabajos que quedaron en `preparing` o `running`;
- detiene los trabajadores antes de cerrar SQLite.

La pausa termina la ejecución activa y conserva el trabajo como `paused`. Al reanudar, la operación empieza nuevamente desde cero y aumenta el número de intento.

## Procesamiento en segundo plano

El trabajo `diagnostic-worker` se ejecuta realmente dentro de un Worker Thread de Node.js. Reporta diez avances hasta llegar al 100 % y demuestra que una tarea de procesamiento puede ejecutarse sin bloquear React ni la ventana de Electron.

Los tipos `probe-media`, `generate-proxy`, `generate-waveform`, `extract-audio`, `detect-silence`, `transcribe-audio`, `render-preview` y `export-video` ya forman parte del dominio, pero todavía no tienen ejecutores. Permanecerán pendientes hasta que los motores correspondientes sean incorporados.

## Importación de medios

El editor permite seleccionar varios archivos mediante el diálogo nativo del sistema.

Formatos registrados inicialmente:

- video: MP4, M4V, MOV, MKV, WEBM y AVI;
- audio: MP3, WAV, M4A, AAC, FLAC, OGG y OPUS;
- imagen: PNG, JPG, JPEG, WEBP, GIF y BMP.

Antes de guardar cada recurso, la aplicación valida ruta, tamaño, extensión y firma binaria, calcula un SHA-256 por streaming y busca duplicados. Los originales no se copian, renombran ni modifican.

## Gestión de proyectos

La pantalla Proyectos permite crear, buscar, abrir, renombrar, duplicar, archivar, restaurar y eliminar proyectos. La duplicación genera identificadores nuevos y excluye trabajos transitorios.

## Núcleo del dominio

El núcleo utiliza:

- identificadores tipados;
- tiempos enteros en microsegundos;
- versión de esquema del proyecto;
- modelos inmutables;
- parámetros JSON serializables;
- validación de referencias entre entidades;
- estados controlados para medios y trabajos;
- dependencias de trabajos sin ciclos.

## Persistencia local

SQLite utiliza:

- tablas separadas por entidad;
- claves foráneas y borrado en cascada;
- modo WAL;
- migraciones versionadas con checksum;
- esquema actual versión 3;
- transacciones completas por proyecto;
- repositorio especializado para progreso de trabajos;
- snapshots de recuperación;
- comprobaciones de integridad;
- respaldos externos con checksum SHA-256;
- retención automática de respaldos.

La interfaz nunca recibe acceso directo a SQLite, Node.js, rutas arbitrarias ni Worker Threads. Todas las operaciones se ejecutan mediante contratos IPC validados.

## Estructura actual

```text
Editar/
├── apps/
│   └── desktop/
│       ├── main/
│       │   ├── database/
│       │   ├── ipc/
│       │   ├── jobs/
│       │   ├── media/
│       │   ├── projects/
│       │   └── security/
│       ├── preload/
│       ├── renderer/
│       │   └── src/
│       │       ├── app/
│       │       ├── components/
│       │       └── screens/
│       └── shared/
│           ├── domain/
│           └── persistence/
├── docs/
├── scripts/
├── tests/
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── tsconfig.renderer.json
└── vite.config.ts
```

## Principios del proyecto

- Los videos originales nunca se modificarán.
- La interfaz no tendrá acceso directo a Node.js ni SQLite.
- Todo canal IPC debe declararse, tiparse y validarse.
- Los procesos pesados deben ejecutarse fuera del renderer.
- Los cambios frecuentes de progreso no deben crear snapshots.
- La aplicación debe cerrar trabajadores antes de cerrar la base.
- Las migraciones aplicadas no pueden modificarse silenciosamente.
- Los módulos futuros dependerán de contratos estables.
- Cada bloque deberá compilar y verificarse antes de continuar.

## Siguiente bloque

**Bloque 9 — Integración de FFmpeg y FFprobe.**
