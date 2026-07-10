<!-- =========================================================
Nombre completo: BLOQUE_6.md
Ruta o ubicación: /docs/BLOQUE_6.md

Función o funciones:
- Registrar el alcance técnico del Bloque 6.
- Documentar las operaciones funcionales de proyectos.
- Mantener trazabilidad para los siguientes bloques.
========================================================= -->

# Bloque 6 — Gestión funcional de proyectos

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Convertir la pantalla de proyectos en un módulo funcional conectado a SQLite, manteniendo la interfaz aislada mediante IPC seguro y aplicando las reglas del dominio antes de cada guardado.

## Funciones incorporadas

- Listar proyectos guardados.
- Crear proyectos nuevos.
- Seleccionar formato inicial.
- Buscar proyectos por nombre.
- Filtrar activos, archivados o todos.
- Abrir el documento completo en el editor.
- Renombrar proyectos.
- Duplicar proyectos.
- Archivar proyectos.
- Restaurar proyectos archivados.
- Eliminar con confirmación.
- Mostrar errores y permitir reintentos.

## Formatos iniciales

```text
Horizontal  1920 × 1080  16:9
Vertical    1080 × 1920   9:16
Cuadrado    1080 × 1080   1:1
Retrato     1080 × 1350   4:5
```

Todos los formatos se crean inicialmente a 30 FPS y pueden evolucionar en los bloques posteriores.

## Arquitectura

```text
ProjectsScreen
└── useProjectManagement
    └── window.editar.projects
        └── preload
            └── IPC validado
                └── ProjectManagementService
                    └── ProjectRepository
                        └── SQLite
```

React no conoce rutas de archivos, sentencias SQL ni conexiones de base de datos.

## Duplicación segura

Al duplicar un proyecto se generan identificadores nuevos para:

- proyecto;
- secuencias;
- pistas;
- recursos multimedia;
- derivados;
- capas de texto;
- clips;
- efectos;
- transiciones.

También se actualizan todas las referencias internas. Los trabajos de procesamiento no se copian porque representan operaciones transitorias del proyecto original.

## Snapshots

Las operaciones siguientes crean snapshots automáticamente:

- creación;
- renombrado;
- cambio de estado;
- duplicación.

La eliminación borra el proyecto y sus relaciones mediante las reglas de cascada definidas en SQLite.

## Proyecto activo

Cuando un usuario abre un proyecto:

1. La interfaz solicita el documento completo mediante IPC.
2. El proceso principal lo reconstruye desde SQLite.
3. El dominio valida todas sus relaciones.
4. React lo mantiene como proyecto activo durante la sesión.
5. El editor muestra nombre, estado, lienzo, pistas y contadores reales.

## Seguridad

- Todos los canales están declarados en contratos compartidos.
- Todas las solicitudes incluyen identificador y fecha.
- Los datos de entrada se validan en el proceso principal.
- Los identificadores deben pertenecer al tipo `project`.
- Los nombres se normalizan y limitan a 120 caracteres.
- Los estados y formatos se restringen a valores permitidos.
- Los proyectos inexistentes producen un error `NOT_FOUND` controlado.

## Verificación realizada

GitHub Actions confirmó correctamente:

1. Typecheck del renderer.
2. Typecheck de Electron.
3. Compilación de React.
4. Compilación del proceso principal y preload.
5. Creación por cada formato.
6. Apertura y reconstrucción del documento.
7. Listado de proyectos.
8. Renombrado con snapshot.
9. Archivo y restauración.
10. Duplicación con identificadores nuevos.
11. Exclusión de trabajos al duplicar.
12. Eliminación.
13. Errores de proyecto inexistente.
14. Validación de datos IPC.
15. Todas las pruebas anteriores de seguridad, dominio y SQLite.

## Criterios de aprobación

- La pantalla muestra datos reales de SQLite.
- Crear un proyecto lo guarda y abre en el editor.
- Las búsquedas y filtros funcionan localmente.
- Las operaciones mantienen actualizada la lista.
- Los proyectos archivados no pueden abrirse hasta restaurarse.
- La duplicación no comparte identificadores con el original.
- La eliminación requiere confirmación.
- El editor distingue entre proyecto activo y ausencia de proyecto.
- Todas las operaciones pasan por IPC validado.
- Todas las pruebas terminan correctamente.

## Archivos creados

1. `/apps/desktop/shared/domain/project-operations.ts`
2. `/apps/desktop/shared/project-management-contracts.ts`
3. `/apps/desktop/main/projects/project-management-service.ts`
4. `/apps/desktop/main/projects/project-request-validation.ts`
5. `/apps/desktop/main/ipc/register-project-ipc.ts`
6. `/apps/desktop/renderer/src/app/use-project-management.ts`
7. `/apps/desktop/renderer/src/components/projects/ProjectFormDialog.tsx`
8. `/apps/desktop/renderer/src/components/projects/ConfirmProjectDialog.tsx`
9. `/apps/desktop/renderer/src/components/projects/ProjectCard.tsx`
10. `/apps/desktop/renderer/src/project-management.css`
11. `/tests/project-management.test.mjs`
12. `/docs/BLOQUE_6.md`

## Archivos actualizados

1. `/apps/desktop/shared/domain/index.ts`
2. `/apps/desktop/shared/ipc-contracts.ts`
3. `/apps/desktop/main/ipc/ipc-validation.ts`
4. `/apps/desktop/preload/preload.cts`
5. `/apps/desktop/main/main.ts`
6. `/apps/desktop/renderer/src/App.tsx`
7. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
8. `/apps/desktop/renderer/src/screens/ProjectsScreen.tsx`
9. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
10. `/apps/desktop/renderer/src/main.tsx`
11. `/README.md`

## Próximo bloque

Bloque 7: importación y registro de medios.
