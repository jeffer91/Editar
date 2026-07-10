<!-- =========================================================
Nombre completo: BLOQUE_7.md
Ruta o ubicación: /docs/BLOQUE_7.md

Función o funciones:
- Registrar el alcance técnico del Bloque 7.
- Documentar la importación y validación de medios.
- Mantener trazabilidad para los siguientes bloques.
========================================================= -->

# Bloque 7 — Importación y registro de medios

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Permitir que un proyecto registre videos, audios e imágenes reales de forma segura, sin modificar ni copiar los archivos originales y sin inventar metadatos técnicos que todavía no han sido obtenidos mediante FFprobe.

## Funciones incorporadas

- Selector nativo de archivos del sistema operativo.
- Selección múltiple.
- Validación de archivo regular y tamaño mayor que cero.
- Resolución de la ruta real del archivo.
- Clasificación por extensión.
- Comprobación de firma binaria.
- Cálculo SHA-256 por streaming.
- Detección de duplicados dentro del proyecto.
- Registro de ruta, tamaño, extensión, MIME y fecha de modificación.
- Estado de análisis técnico pendiente.
- Guardado transaccional en SQLite.
- Snapshot automático cuando existen medios nuevos.
- Resumen de importados, duplicados y rechazados.
- Filtros de video, audio e imagen dentro del editor.

## Formatos admitidos

```text
Video   MP4, M4V, MOV, MKV, WEBM, AVI
Audio   MP3, WAV, M4A, AAC, FLAC, OGG, OPUS
Imagen  PNG, JPG, JPEG, WEBP, GIF, BMP
```

## Flujo de importación

```text
Editor
└── Selector nativo de Electron
    └── Rutas elegidas por el usuario
        ├── Realpath y stat
        ├── Extensión permitida
        ├── Firma binaria válida
        ├── SHA-256 por streaming
        ├── Detección de duplicado
        └── Registro del recurso
            └── Guardado transaccional + snapshot
```

La interfaz React no puede enviar rutas arbitrarias. Las rutas provienen únicamente del selector abierto por el proceso principal de Electron.

## Validaciones de firma

La aplicación reconoce las siguientes estructuras iniciales:

- ISOBMFF para MP4, MOV, M4V y M4A.
- EBML para MKV y WEBM.
- RIFF para AVI, WAV y WEBP.
- Firmas propias de PNG, JPEG, GIF y BMP.
- Cabeceras de MP3, FLAC, OGG/OPUS y AAC.

Si el contenido no coincide con la extensión, el archivo se rechaza y no se registra.

## Detección de duplicados

Cada archivo válido obtiene un SHA-256 calculado por bloques, sin cargar todo el archivo en memoria.

Se considera duplicado cuando otro recurso del mismo proyecto tiene el mismo hash. También se protege el dominio contra identificadores o rutas repetidas.

Los duplicados:

- no se vuelven a insertar;
- no generan otro snapshot;
- se presentan por separado en el resumen de importación.

## Registro pendiente de análisis

El Bloque 7 registra únicamente datos verificables sin FFprobe:

- nombre;
- ruta real;
- extensión;
- tipo MIME;
- clase multimedia;
- tamaño;
- fecha de modificación;
- hash;
- disponibilidad.

Los campos de duración, resolución, FPS, códecs, canales y frecuencia de audio quedan con estado `pending` hasta el Bloque 9.

Estados disponibles:

```text
pending  Registrado, pendiente de FFprobe
ready    Analizado con metadatos completos
failed   Análisis fallido con explicación
```

## Resultados de una importación

Cada selección devuelve:

- archivos importados;
- archivos duplicados;
- archivos rechazados y su motivo;
- cantidad por tipo multimedia;
- documento actualizado del proyecto.

Se procesan hasta cien archivos por operación. Los excedentes se informan como rechazados para evitar una operación accidentalmente ilimitada.

## Seguridad e integridad

- Los originales no se modifican, renombran ni eliminan.
- React no recibe acceso al sistema de archivos.
- Las rutas no llegan desde datos escritos manualmente por el renderer.
- El remitente IPC debe ser confiable.
- El identificador del proyecto se valida.
- Los proyectos archivados no permiten importaciones.
- La base se actualiza dentro de una transacción.
- El documento completo se valida antes de persistirse.
- Los errores de archivo quedan aislados y no cancelan los demás seleccionados.

## Diagnósticos de integración continua

El workflow conserva los errores completos de TypeScript como artefactos cuando el runner falla. Esto evita perder el mensaje técnico cuando los registros de GitHub Actions son demasiado extensos.

## Verificación realizada

GitHub Actions confirmó correctamente:

1. Typecheck del renderer.
2. Typecheck de Electron.
3. Compilación de React.
4. Compilación del proceso principal y preload.
5. Reconocimiento de una firma MP4.
6. Reconocimiento de una firma PNG.
7. Reconocimiento de una firma WAV.
8. Rechazo de contenido que no coincide con la extensión.
9. Cálculo de SHA-256.
10. Importación de varios archivos.
11. Omisión de contenido duplicado.
12. Registro con estado de análisis pendiente.
13. Persistencia y reapertura del proyecto.
14. Snapshot de importación.
15. Cancelación sin cambios.
16. Bloqueo de proyectos archivados.
17. Todas las pruebas anteriores de seguridad, dominio, proyectos y SQLite.

## Criterios de aprobación

- El selector permite elegir varios archivos.
- Solo se aceptan formatos declarados.
- La firma binaria se valida antes del hash y del guardado.
- Los duplicados se detectan por contenido.
- Los originales permanecen intactos.
- Los recursos aparecen inmediatamente en el editor.
- El panel permite filtrar por tipo.
- Los metadatos no disponibles quedan pendientes, no inventados.
- La importación parcial conserva los archivos válidos y reporta los rechazados.
- Todas las operaciones pasan por IPC seguro.
- Todas las pruebas terminan correctamente.

## Archivos creados

1. `/apps/desktop/shared/media-import-contracts.ts`
2. `/apps/desktop/shared/domain/project-media-operations.ts`
3. `/apps/desktop/main/media/media-file-inspector.ts`
4. `/apps/desktop/main/media/media-import-service.ts`
5. `/apps/desktop/main/ipc/register-media-ipc.ts`
6. `/apps/desktop/renderer/src/app/use-media-import.ts`
7. `/apps/desktop/renderer/src/components/media/ProjectMediaPanel.tsx`
8. `/apps/desktop/renderer/src/media-import.css`
9. `/tests/media-import.test.mjs`
10. `/docs/BLOQUE_7.md`

## Archivos actualizados

1. `/apps/desktop/shared/domain/media.ts`
2. `/apps/desktop/shared/domain/index.ts`
3. `/apps/desktop/shared/ipc-contracts.ts`
4. `/apps/desktop/preload/preload.cts`
5. `/apps/desktop/main/main.ts`
6. `/apps/desktop/renderer/src/App.tsx`
7. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
8. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
9. `/apps/desktop/renderer/src/main.tsx`
10. `/.github/workflows/verify.yml`
11. `/README.md`
12. `/package.json`

## Próximo bloque

Bloque 8: cola de trabajos y procesamiento en segundo plano.
