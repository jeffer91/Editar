<!-- =========================================================
Nombre completo: BLOQUE_3.md
Ruta o ubicación: /docs/BLOQUE_3.md

Función o funciones:
- Registrar el alcance técnico del Bloque 3.
- Documentar navegación, pantallas y sistema visual.
- Mantener trazabilidad para los siguientes bloques.
========================================================= -->

# Bloque 3 — Diseño visual, navegación y estructura de pantallas

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Construir un shell visual reutilizable y responsivo, con navegación real entre pantallas independientes y una estructura preparada para incorporar los módulos funcionales posteriores.

## Componentes incorporados

- Navegación interna mediante hash, sin recargar Electron.
- Barra lateral de escritorio y menú móvil.
- Encabezado reutilizable con estado del sistema.
- Biblioteca interna de iconos SVG.
- Pantalla de Inicio.
- Pantalla de Proyectos.
- Estructura visual del Editor.
- Pantalla de Biblioteca.
- Pantalla de Ajustes y diagnóstico.
- Diseño responsivo para distintos tamaños de ventana.
- Separación de estilos globales, shell y pantallas.
- Pruebas automáticas de rutas y metadatos de navegación.

## Verificación realizada

GitHub Actions confirmó correctamente:

1. Instalación de dependencias.
2. Limpieza de compilaciones anteriores.
3. Typecheck del renderer.
4. Typecheck de Electron.
5. Compilación del renderer.
6. Compilación de Electron.
7. Pruebas de validación IPC.
8. Pruebas de rutas válidas e inválidas.
9. Pruebas de hashes y metadatos de navegación.

## Criterios de aprobación

- Todas las opciones del menú abren una pantalla real.
- La ruta activa se mantiene en el hash de la ventana.
- Una ruta inválida vuelve a Inicio.
- La barra lateral funciona en escritorio y móvil.
- El menú móvil se cierra con botón, fondo o tecla Escape.
- Las pantallas comparten el mismo shell y encabezado.
- El diagnóstico IPC continúa funcionando desde Ajustes.
- Renderer y Electron compilan sin errores.
- Las pruebas de navegación e IPC terminan correctamente.

## Archivos creados

1. `/apps/desktop/shared/navigation-contracts.ts`
2. `/apps/desktop/renderer/src/app/use-hash-navigation.ts`
3. `/apps/desktop/renderer/src/app/use-system-status.ts`
4. `/apps/desktop/renderer/src/components/ui/AppIcon.tsx`
5. `/apps/desktop/renderer/src/components/layout/Sidebar.tsx`
6. `/apps/desktop/renderer/src/components/layout/Topbar.tsx`
7. `/apps/desktop/renderer/src/components/layout/AppShell.tsx`
8. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
9. `/apps/desktop/renderer/src/screens/ProjectsScreen.tsx`
10. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
11. `/apps/desktop/renderer/src/screens/LibraryScreen.tsx`
12. `/apps/desktop/renderer/src/screens/SettingsScreen.tsx`
13. `/apps/desktop/renderer/src/app-layout.css`
14. `/apps/desktop/renderer/src/screens.css`
15. `/tests/navigation.test.mjs`
16. `/docs/BLOQUE_3.md`

## Archivos actualizados

1. `/apps/desktop/renderer/src/App.tsx`
2. `/apps/desktop/renderer/src/main.tsx`
3. `/apps/desktop/renderer/src/styles.css`
4. `/package.json`
5. `/.github/workflows/verify.yml`
6. `/README.md`

## Archivo eliminado

1. `/apps/desktop/renderer/src/ipc-status.css`

## Próximo bloque

Bloque 4: núcleo y modelos del dominio.
