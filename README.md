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

La aplicación ya dispone de proceso principal, preload aislado, comunicación validada, shell responsivo, núcleo de dominio, almacenamiento SQLite, gestión de proyectos e importación real de videos, audios e imágenes.

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
5. Compilación del proceso principal, preload y contratos.
6. Pruebas automáticas de validación IPC.
7. Pruebas automáticas de rutas y navegación.
8. Pruebas de proyectos, medios, timeline, efectos y trabajos.
9. Pruebas de integridad del documento completo del proyecto.
10. Pruebas de migraciones SQLite.
11. Pruebas de repositorios, snapshots y cascadas.
12. Pruebas de respaldos y retención.
13. Pruebas de creación, apertura y listado de proyectos.
14. Pruebas de renombrado, archivo, restauración y eliminación.
15. Pruebas de duplicación y remapeo de identificadores.
16. Pruebas de firmas binarias de MP4, PNG y WAV.
17. Pruebas de hash, duplicados, cancelación e importación persistente.

Cuando falla el tipado, GitHub Actions conserva el diagnóstico completo como artefacto durante siete días.

## Ejecución compilada

```powershell
npm start
```

## Pantallas disponibles

- Inicio.
- Proyectos funcionales.
- Editor conectado al proyecto activo e importación de medios.
- Biblioteca.
- Ajustes y diagnóstico.

## Importación de medios

El editor permite seleccionar varios archivos mediante el diálogo nativo del sistema.

Formatos registrados inicialmente:

- video: MP4, M4V, MOV, MKV, WEBM y AVI;
- audio: MP3, WAV, M4A, AAC, FLAC, OGG y OPUS;
- imagen: PNG, JPG, JPEG, WEBP, GIF y BMP.

Antes de guardar cada recurso, la aplicación:

1. resuelve la ruta real del archivo;
2. confirma que sea un archivo regular y no esté vacío;
3. valida la extensión;
4. verifica su firma binaria;
5. calcula un SHA-256 por streaming;
6. busca duplicados dentro del proyecto;
7. registra ruta, tamaño, tipo MIME y fecha de modificación;
8. crea un snapshot cuando existen nuevas importaciones.

Los archivos originales no se copian, no se renombran y no se modifican. La duración, resolución, FPS y códecs quedan pendientes hasta la integración de FFprobe.

## Gestión de proyectos

La pantalla Proyectos permite:

- crear proyectos horizontales, verticales, cuadrados y de retrato;
- buscar por nombre;
- filtrar activos, archivados o todos;
- abrir el documento completo en el editor;
- renombrar con snapshot automático;
- duplicar contenido con identificadores nuevos;
- archivar y restaurar;
- eliminar con confirmación.

La duplicación no copia trabajos transitorios. Conserva la estructura creativa, referencias multimedia, clips, textos, efectos y transiciones.

## Núcleo del dominio

El núcleo utiliza:

- identificadores tipados;
- tiempos enteros en microsegundos;
- versión de esquema del proyecto;
- modelos inmutables;
- parámetros JSON serializables;
- validación de referencias entre entidades;
- estados controlados para trabajos de procesamiento;
- estados de inspección multimedia pendientes, completos o fallidos.

## Persistencia local

SQLite utiliza:

- tablas separadas por entidad;
- claves foráneas y borrado en cascada;
- modo WAL;
- migraciones versionadas con checksum;
- transacciones completas por proyecto;
- snapshots de recuperación;
- comprobaciones de integridad;
- respaldos externos con checksum SHA-256;
- retención automática de respaldos.

La interfaz nunca recibe acceso directo a SQLite ni acepta rutas arbitrarias para importar. Todas las operaciones se ejecutan mediante IPC validado.

## Estructura actual

```text
Editar/
├── apps/
│   └── desktop/
│       ├── main/
│       │   ├── database/
│       │   ├── ipc/
│       │   ├── media/
│       │   ├── projects/
│       │   └── security/
│       ├── preload/
│       ├── renderer/
│       │   └── src/
│       │       ├── app/
│       │       ├── components/
│       │       │   ├── media/
│       │       │   └── projects/
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
- Las rutas de importación solo provienen del selector nativo del proceso principal.
- Las pantallas deben depender de componentes compartidos.
- Los modelos del dominio no dependen de Electron ni de SQLite.
- Todos los tiempos audiovisuales se guardan como microsegundos enteros.
- Todo guardado integral debe ejecutarse dentro de una transacción.
- Las migraciones aplicadas no pueden modificarse silenciosamente.
- Los trabajos transitorios no se copian al duplicar proyectos.
- Los procesos pesados se incorporarán fuera del renderer.
- Los módulos futuros dependerán de contratos estables.
- Cada bloque deberá compilar y verificarse antes de continuar.

## Siguiente bloque

**Bloque 8 — Cola de trabajos y procesamiento en segundo plano.**
