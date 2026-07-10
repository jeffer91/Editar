<!-- =========================================================
Nombre completo: BLOQUE_4.md
Ruta o ubicación: /docs/BLOQUE_4.md

Función o funciones:
- Registrar el alcance técnico del Bloque 4.
- Documentar los modelos y sus relaciones.
- Mantener trazabilidad para los siguientes bloques.
========================================================= -->

# Bloque 4 — Núcleo y modelos del dominio

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Definir un núcleo independiente de Electron, React, SQLite y FFmpeg que represente de forma estable todos los conceptos principales del editor.

## Modelos incorporados

- Proyecto y configuración del lienzo.
- Recursos multimedia y derivados.
- Secuencias.
- Pistas.
- Clips.
- Transformaciones.
- Capas de texto.
- Efectos.
- Transiciones.
- Trabajos y dependencias.
- Documento integral del proyecto.

## Relaciones principales

```text
Proyecto
└── Secuencia principal
    ├── Pistas
    │   └── Clips
    │       ├── Medio o capa de texto
    │       └── Efectos
    └── Transiciones entre clips

Proyecto
├── Recursos multimedia
├── Capas de texto
└── Trabajos de procesamiento
```

## Decisiones técnicas

- Todas las posiciones y duraciones se guardan como microsegundos enteros.
- Los identificadores incluyen el tipo de entidad.
- El proyecto incorpora una versión de esquema.
- Los modelos no dependen de la base de datos ni de la interfaz.
- Los efectos almacenan parámetros JSON serializables.
- Las tasas de cuadros se representan mediante fracciones.
- Las transiciones deben conectar clips existentes de la misma pista.
- Los trabajos admiten prioridad, progreso, dependencias y reintentos.
- El documento completo valida todas las referencias antes de guardarse.

## Validaciones integrales

El agregado del proyecto detecta:

- identificadores duplicados;
- secuencias, pistas o clips inexistentes;
- clips asignados a pistas incompatibles;
- medios y textos pertenecientes a otro proyecto;
- efectos sin propietario;
- transiciones con clips inexistentes o duración inválida;
- trabajos con dependencias inexistentes;
- ciclos entre trabajos.

## Verificación realizada

GitHub Actions confirmó correctamente:

1. Instalación de dependencias.
2. Limpieza de compilaciones anteriores.
3. Typecheck del renderer.
4. Typecheck de Electron.
5. Compilación del renderer.
6. Compilación de Electron.
7. Pruebas de seguridad IPC.
8. Pruebas de navegación.
9. Pruebas de primitivas y tiempos.
10. Pruebas de proyectos y recursos multimedia.
11. Pruebas de clips, colisiones y velocidades.
12. Pruebas de textos, efectos y transiciones.
13. Pruebas de trabajos y dependencias.
14. Pruebas de integridad del documento completo.

## Criterios de aprobación

- El núcleo compila en renderer y Electron.
- Los modelos pueden importarse desde una única API pública.
- Un proyecto vacío se crea con secuencia y cuatro pistas válidas.
- Los tiempos negativos o decimales son rechazados.
- Los metadatos multimedia son validados.
- La velocidad de un clip modifica correctamente su duración.
- Los efectos y transiciones quedan versionados.
- Los estados de los trabajos respetan transiciones permitidas.
- El agregado detecta referencias rotas.
- Todas las pruebas anteriores continúan funcionando.

## Archivos creados

1. `/apps/desktop/shared/domain/domain-error.ts`
2. `/apps/desktop/shared/domain/primitives.ts`
3. `/apps/desktop/shared/domain/project.ts`
4. `/apps/desktop/shared/domain/media.ts`
5. `/apps/desktop/shared/domain/timeline.ts`
6. `/apps/desktop/shared/domain/effects.ts`
7. `/apps/desktop/shared/domain/text.ts`
8. `/apps/desktop/shared/domain/jobs.ts`
9. `/apps/desktop/shared/domain/project-document.ts`
10. `/apps/desktop/shared/domain/index.ts`
11. `/tests/domain.test.mjs`
12. `/docs/BLOQUE_4.md`

## Archivos actualizados

1. `/apps/desktop/renderer/src/screens/HomeScreen.tsx`
2. `/README.md`

## Próximo bloque

Bloque 5: base de datos SQLite, migraciones, repositorios y respaldos.
