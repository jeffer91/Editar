<!-- =========================================================
Nombre completo: BLOQUE_8.md
Ruta o ubicación: /docs/BLOQUE_8.md

Función o funciones:
- Registrar el alcance técnico del Bloque 8.
- Documentar la cola persistente y los Worker Threads.
- Mantener trazabilidad para la integración de FFmpeg.
========================================================= -->

# Bloque 8 — Cola de trabajos y procesamiento en segundo plano

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Crear una infraestructura persistente para operaciones largas que permita ejecutar procesamiento fuera del renderer, controlar concurrencia, mostrar progreso y recuperar trabajos después de una interrupción.

## Arquitectura

```text
JobsScreen
└── window.editar.jobs
    └── preload aislado
        └── IPC validado
            └── JobQueueService
                ├── SqliteJobQueueRepository
                ├── scheduler de prioridad y dependencias
                └── WorkerThreadJobExecutor
                    └── background-worker
```

React consulta estados y solicita acciones, pero nunca administra Worker Threads ni accede directamente a SQLite.

## Estados de los trabajos

```text
pending     Esperando un espacio de ejecución
preparing   Preparando la operación
running     Procesándose en segundo plano
paused      Detenido para reiniciarse después
cancelled   Cancelado por el usuario
completed   Completado correctamente
failed      Finalizado con un error controlado
```

El dominio controla las transiciones permitidas y rechaza cambios incompatibles.

## Datos persistidos

Cada trabajo conserva:

- identificador y proyecto;
- tipo de operación;
- estado;
- prioridad entre 0 y 100;
- porcentaje entre 0 y 100;
- dependencias;
- intento actual y máximo permitido;
- payload de entrada;
- resultado;
- error y posibilidad de reintento;
- fechas de creación, actualización, inicio y finalización.

## Migración SQLite

La migración 3 añade a la tabla `jobs`:

- `updated_at`;
- `attempt`;
- `max_attempts`;
- índice de planificación por estado, prioridad y antigüedad;
- índice de actualización.

Los trabajos existentes se normalizan dentro de la migración. El JSON almacenado también recibe los campos nuevos para mantener compatibilidad al reconstruir el dominio.

## Repositorio especializado

El progreso de un trabajo puede cambiar muchas veces por minuto. Por esta razón, la cola utiliza `SqliteJobQueueRepository` en lugar de guardar nuevamente todo el documento del proyecto.

Esto permite:

- actualizar una sola fila;
- no reconstruir pistas, clips o medios;
- no crear snapshots por cada avance;
- consultar la cola global con el nombre de cada proyecto;
- conservar dependencias por separado.

## Scheduler

El planificador:

1. busca trabajos `pending`;
2. descarta operaciones sin ejecutor disponible;
3. comprueba que todas las dependencias estén completadas;
4. ordena por prioridad descendente y antigüedad ascendente;
5. respeta el límite de concurrencia;
6. cambia el estado a `preparing` y después a `running`;
7. persiste cada avance;
8. guarda resultado o error final;
9. libera el espacio y procesa el siguiente trabajo.

La aplicación utiliza inicialmente una concurrencia de dos trabajos.

## Worker Thread real

El tipo `diagnostic-worker` ejecuta una tarea real dentro de un Worker Thread de Node.js.

La prueba:

- realiza cálculo fuera del renderer;
- reporta diez avances;
- llega al 100 %;
- devuelve un checksum y la confirmación `workerThread: true`;
- permite verificar que la ventana permanezca disponible.

Este diagnóstico no representa una función final del editor. Es la prueba funcional de la infraestructura que utilizarán FFmpeg, FFprobe y otros motores.

## Pausa y reanudación

Cuando se pausa una operación activa:

1. el scheduler marca la intención de pausa;
2. `AbortController` solicita detenerla;
3. el Worker Thread se termina;
4. el trabajo queda persistido como `paused`.

Al reanudar, vuelve a `pending`, reinicia el progreso desde cero y utiliza un nuevo intento. No se simula una continuación exacta del punto anterior.

## Cancelación

Los trabajos pendientes, pausados o activos pueden cancelarse. Una ejecución activa termina primero su Worker Thread y luego queda registrada como `cancelled`.

Los trabajos completados, fallidos o ya cancelados no aceptan una nueva cancelación.

## Reintentos

Los errores incluyen:

- código;
- mensaje;
- indicador `retryable`.

Si el error es recuperable y quedan intentos, la cola puede devolver automáticamente el trabajo a `pending`. La pantalla también permite reintentar manualmente un trabajo fallido.

## Recuperación después de interrupciones

Al iniciar la aplicación, los trabajos almacenados como `preparing` o `running` se consideran interrumpidos.

- Si quedan intentos, regresan a `pending` con progreso cero.
- Si alcanzaron el máximo, pasan a `failed` con el código `MAX_ATTEMPTS_REACHED`.

Durante el cierre normal, la aplicación detiene la cola y los Worker Threads antes de cerrar SQLite.

## Tipos preparados

El dominio reconoce:

- `probe-media`;
- `generate-proxy`;
- `generate-waveform`;
- `generate-thumbnails`;
- `extract-audio`;
- `detect-silence`;
- `transcribe-audio`;
- `detect-scenes`;
- `render-preview`;
- `export-video`.

En el Bloque 8 solo `diagnostic-worker` tiene ejecutor. Los demás tipos permanecerán pendientes hasta incorporar sus motores. No se presentan como procesados ni completados artificialmente.

## Centro de trabajos

La nueva pantalla muestra:

- disponibilidad del Worker;
- límite de concurrencia;
- pendientes, activos, pausados, completados y fallidos;
- proyecto y tipo de trabajo;
- barra de progreso;
- prioridad;
- intento actual;
- fecha de actualización;
- error técnico controlado;
- botones de pausa, reanudación, cancelación y reintento.

La interfaz consulta la cola cada 750 milisegundos. Los cambios funcionales siempre pasan por IPC validado.

## Seguridad e integridad

- El renderer no crea Worker Threads.
- El renderer no escribe estados directamente en SQLite.
- Los identificadores de proyecto y trabajo se validan por tipo.
- Los proyectos archivados no aceptan trabajos nuevos.
- Las actualizaciones frecuentes no generan snapshots.
- Las dependencias deben existir y no pueden formar ciclos.
- La concurrencia está limitada entre 1 y 8.
- El cierre ordenado evita terminar SQLite mientras un trabajador sigue activo.

## Verificación realizada

GitHub Actions confirmó correctamente:

1. Typecheck del renderer.
2. Typecheck de Electron.
3. Compilación de React.
4. Compilación del proceso principal, preload y trabajador.
5. Aplicación de la migración 3.
6. Integridad y reapertura de SQLite.
7. Ejecución real de un Worker Thread.
8. Progreso hasta 100 %.
9. Persistencia del resultado.
10. Ausencia de snapshots por avances.
11. Pausa de una ejecución activa.
12. Reanudación desde cero con un nuevo intento.
13. Cancelación y persistencia del estado.
14. Recuperación de un trabajo interrumpido.
15. Respeto del límite de concurrencia.
16. Ejecución posterior del siguiente trabajo.
17. Todas las pruebas anteriores de seguridad, dominio, proyectos y medios.

## Criterios de aprobación

- La cola sobrevive al cierre de la interfaz.
- El procesamiento real ocurre fuera de React.
- El progreso se persiste sin snapshots.
- La concurrencia está controlada.
- Las dependencias bloquean trabajos hasta completarse.
- Pausa, reanudación, cancelación y reintento son operaciones validadas.
- Los trabajos interrumpidos se recuperan al iniciar.
- El Centro de trabajos refleja información real de SQLite.
- Los tipos sin ejecutor no se marcan como completados.
- Todas las pruebas terminan correctamente.

## Archivos creados

1. `/apps/desktop/shared/persistence/job-queue-repository.ts`
2. `/apps/desktop/shared/job-queue-contracts.ts`
3. `/apps/desktop/main/database/sqlite-job-queue-repository.ts`
4. `/apps/desktop/main/jobs/job-executor.ts`
5. `/apps/desktop/main/jobs/background-worker.ts`
6. `/apps/desktop/main/jobs/worker-thread-job-executor.ts`
7. `/apps/desktop/main/jobs/job-queue-service.ts`
8. `/apps/desktop/main/jobs/job-queue-request-validation.ts`
9. `/apps/desktop/main/ipc/register-job-queue-ipc.ts`
10. `/apps/desktop/renderer/src/app/use-job-queue.ts`
11. `/apps/desktop/renderer/src/screens/JobsScreen.tsx`
12. `/apps/desktop/renderer/src/job-queue.css`
13. `/tests/job-queue.test.mjs`
14. `/docs/BLOQUE_8.md`

## Archivos actualizados

1. `/apps/desktop/shared/domain/jobs.ts`
2. `/apps/desktop/main/database/migrations.ts`
3. `/apps/desktop/main/database/database-service.ts`
4. `/apps/desktop/shared/ipc-contracts.ts`
5. `/apps/desktop/preload/preload.cts`
6. `/apps/desktop/main/main.ts`
7. `/apps/desktop/shared/navigation-contracts.ts`
8. `/apps/desktop/renderer/src/components/ui/AppIcon.tsx`
9. `/apps/desktop/renderer/src/main.tsx`
10. `/apps/desktop/renderer/src/App.tsx`
11. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
12. `/tests/database.test.mjs`
13. `/package.json`
14. `/README.md`

## Próximo bloque

Bloque 9: integración de FFmpeg y FFprobe.
