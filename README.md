<!-- =========================================================
Nombre completo: README.md
Ruta o ubicación: /README.md

Función o funciones:
- Documentar la finalidad y arquitectura inicial del proyecto.
- Explicar cómo instalar, ejecutar y verificar la aplicación.
- Registrar el alcance y estado del Bloque 1.
========================================================= -->

# Editar

Aplicación de escritorio modular para edición de video, eliminación de silencios, animaciones, efectos visuales, efectos de sonido, textos flotantes, transiciones y automatización futura.

## Estado actual

**Bloque 1 — Inicialización de la aplicación**

La base incluye:

- Electron como contenedor de escritorio.
- React para la interfaz.
- TypeScript estricto.
- Vite para desarrollo y compilación del renderer.
- Proceso principal, preload seguro e interfaz separados.
- Scripts multiplataforma de desarrollo, compilación y verificación.

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
5. Compilación del proceso principal y preload.

## Ejecución compilada

```powershell
npm start
```

## Estructura inicial

```text
Editar/
├── apps/
│   └── desktop/
│       ├── main/
│       ├── preload/
│       └── renderer/
├── scripts/
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── tsconfig.renderer.json
└── vite.config.ts
```

## Principios del proyecto

- Los videos originales nunca se modificarán.
- La interfaz no tendrá acceso directo a Node.js.
- Los procesos pesados se incorporarán fuera del renderer.
- Los módulos futuros dependerán de contratos estables.
- Cada bloque deberá compilar y verificarse antes de continuar.

## Siguiente bloque

**Bloque 2 — Seguridad, contratos IPC y comunicación tipada.**
