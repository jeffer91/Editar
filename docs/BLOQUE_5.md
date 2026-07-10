<!-- =========================================================
Nombre completo: BLOQUE_5.md
Ruta o ubicación: /docs/BLOQUE_5.md

Función o funciones:
- Registrar el alcance técnico del Bloque 5.
- Documentar SQLite, migraciones, repositorios y respaldos.
- Mantener trazabilidad para los siguientes bloques.
========================================================= -->

# Bloque 5 — SQLite, migraciones, repositorios y respaldos

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Incorporar almacenamiento local real y confiable para los proyectos, manteniendo el dominio desacoplado de SQLite y evitando acceso directo desde React.

## Tecnología seleccionada

Se utiliza `node:sqlite`, incluido en Node.js y en la versión de Node integrada por Electron. Esto evita dependencias nativas externas y procesos adicionales de recompilación.

## Componentes incorporados

- Conexión SQLite centralizada.
- Configuración WAL y claves foráneas.
- Migraciones versionadas.
- Checksums SHA-256 de migraciones.
- Repositorio de proyectos desacoplado.
- Guardado transaccional del documento completo.
- Reconstrucción y validación al leer.
- Snapshots internos de recuperación.
- Borrado en cascada.
- Comprobación rápida y completa de integridad.
- Respaldos externos mediante la API oficial de SQLite.
- Checksum SHA-256 de cada respaldo.
- Retención automática de respaldos.
- Respaldo automático diario cuando existen proyectos.
- Diagnóstico y respaldo manual desde Ajustes.

## Tablas principales

```text
schema_migrations
projects
sequences
tracks
media_assets
text_layers
clips
effects
transitions
jobs
job_dependencies
project_snapshots
database_metadata
backup_history
```

## Estrategia de almacenamiento

Cada entidad dispone de:

- columnas indexadas para búsquedas frecuentes;
- claves foráneas para relaciones estructurales;
- restricciones de rango y tipo;
- una representación JSON validada del modelo completo.

Esta estrategia permite consultas rápidas sin perder información cuando los modelos crezcan.

## Migraciones

Cada migración registra:

- número de versión;
- nombre;
- fecha de aplicación;
- checksum SHA-256.

La aplicación se niega a abrir una base si una migración aplicada fue modificada o si pertenece a una versión futura incompatible.

## Persistencia de proyectos

El repositorio ejecuta dentro de una sola transacción:

1. Validación integral del documento.
2. Inserción o actualización del proyecto.
3. Reemplazo ordenado de entidades relacionadas.
4. Inserción de dependencias.
5. Creación de snapshot.
6. Limpieza de snapshots antiguos.
7. Confirmación o reversión completa.

## Respaldos

Los respaldos:

- se guardan fuera del archivo principal;
- mantienen una copia consistente aunque SQLite use WAL;
- registran tamaño, fecha, versión y checksum;
- pueden crearse manualmente desde Ajustes;
- se crean automáticamente una vez al día cuando existen proyectos;
- conservan diez archivos de forma predeterminada.

## Verificación realizada

GitHub Actions confirmó correctamente:

1. Instalación con Node.js 22.16.
2. Typecheck del renderer.
3. Typecheck de Electron.
4. Compilación del renderer.
5. Compilación de Electron.
6. Migraciones iniciales e idempotentes.
7. Configuración WAL y claves foráneas.
8. Integridad rápida y completa.
9. Guardado y reconstrucción de proyectos.
10. Snapshots y límite de retención.
11. Borrado en cascada.
12. Creación de respaldos con checksum.
13. Retención de respaldos antiguos.
14. Cierre y reapertura sin pérdida.
15. Pruebas anteriores de IPC, navegación y dominio.

## Criterios de aprobación

- La base se crea y migra automáticamente.
- Las migraciones son idempotentes.
- El esquema utiliza la última versión disponible.
- La integridad devuelve `ok`.
- El modo de diario es WAL en bases de archivo.
- Un proyecto completo puede guardarse y reconstruirse.
- Los snapshots respetan su límite de retención.
- El borrado elimina las relaciones en cascada.
- Los respaldos son archivos válidos y verificables.
- La retención elimina respaldos antiguos.
- La base puede cerrarse y reabrirse sin pérdida.
- React solo accede mediante IPC validado.
- Las pruebas anteriores continúan funcionando.

## Archivos creados

1. `/apps/desktop/shared/database-contracts.ts`
2. `/apps/desktop/shared/persistence/project-repository.ts`
3. `/apps/desktop/main/database/migrations.ts`
4. `/apps/desktop/main/database/sqlite-database.ts`
5. `/apps/desktop/main/database/sqlite-project-repository.ts`
6. `/apps/desktop/main/database/database-backup-service.ts`
7. `/apps/desktop/main/database/database-service.ts`
8. `/apps/desktop/main/ipc/register-database-ipc.ts`
9. `/apps/desktop/renderer/src/app/use-database-status.ts`
10. `/apps/desktop/renderer/src/database-status.css`
11. `/tests/database.test.mjs`
12. `/docs/BLOQUE_5.md`

## Archivos actualizados

1. `/apps/desktop/shared/ipc-contracts.ts`
2. `/apps/desktop/preload/preload.cts`
3. `/apps/desktop/main/main.ts`
4. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
5. `/apps/desktop/renderer/src/screens/SettingsScreen.tsx`
6. `/apps/desktop/renderer/src/main.tsx`
7. `/package.json`
8. `/.github/workflows/verify.yml`
9. `/README.md`

## Próximo bloque

Bloque 6: gestión funcional de proyectos.
