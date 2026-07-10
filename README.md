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

La aplicación ya dispone de proceso principal, preload aislado, comunicación validada, shell responsivo y un núcleo independiente que representa proyectos, medios, secuencias, pistas, clips, textos, efectos, transiciones y trabajos.

## Requisitos

- Node.js 22.12 o superior.
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
5. Compilación del proceso principal, preload y contratos.
6. Pruebas automáticas de validación IPC.
7. Pruebas automáticas de rutas y navegación.
8. Pruebas de proyectos, medios, timeline, efectos y trabajos.
9. Pruebas de integridad del documento completo del proyecto.

## Ejecución compilada

```powershell
npm start
```

## Pantallas disponibles

- Inicio.
- Proyectos.
- Editor.
- Biblioteca.
- Ajustes y diagnóstico.

## Núcleo del dominio

El núcleo utiliza:

- identificadores tipados;
- tiempos enteros en microsegundos;
- versión de esquema del proyecto;
- modelos inmutables;
- parámetros JSON serializables;
- validación de referencias entre entidades;
- estados controlados para trabajos de procesamiento.

## Estructura actual

```text
Editar/
├── apps/
│   └── desktop/
│       ├── main/
│       │   ├── ipc/
│       │   └── security/
│       ├── preload/
│       ├── renderer/
│       │   └── src/
│       │       ├── app/
│       │       ├── components/
│       │       └── screens/
│       └── shared/
│           └── domain/
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
- La interfaz no tendrá acceso directo a Node.js.
- Todo canal IPC debe declararse, tiparse y validarse.
- Las pantallas deben depender de componentes compartidos.
- Los modelos del dominio no dependen de Electron ni de SQLite.
- Todos los tiempos audiovisuales se guardan como microsegundos enteros.
- Los procesos pesados se incorporarán fuera del renderer.
- Los módulos futuros dependerán de contratos estables.
- Cada bloque deberá compilar y verificarse antes de continuar.

## Siguiente bloque

**Bloque 5 — Base de datos SQLite, migraciones, repositorios y respaldos.**
