<!-- =========================================================
Nombre completo: BLOQUE_13.md
Ruta o ubicación: /docs/BLOQUE_13.md

Función o funciones:
- Registrar el alcance técnico del Bloque 13.
- Documentar operaciones de clips, pistas y persistencia.
- Mantener trazabilidad para los módulos de edición posteriores.
========================================================= -->

# Bloque 13 — Línea de tiempo y edición funcional de clips

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Convertir la línea de tiempo visual inicial en una herramienta funcional capaz de construir y modificar una secuencia de clips sin alterar los archivos multimedia originales.

## Operaciones disponibles

- añadir un video, audio o imagen a la secuencia;
- seleccionar un clip;
- moverlo dentro de una pista compatible;
- cambiar su posición temporal;
- modificar su duración;
- modificar el punto de entrada del original;
- dividirlo en dos fragmentos;
- eliminarlo;
- silenciar una pista;
- ocultar una pista;
- bloquear o desbloquear una pista;
- modificar el nivel de zoom temporal.

## Edición no destructiva

Un clip de medios guarda referencias al original:

```text
mediaId
sourceStartUs
sourceDurationUs
timelineStartUs
durationUs
playbackRate
```

Recortar o dividir un clip modifica únicamente estos valores dentro del documento del proyecto. El archivo original no se abre en modo escritura ni se reemplaza.

## Inserción de medios

El Editor muestra los recursos que:

- están disponibles;
- terminaron el análisis técnico;
- pertenecen al proyecto actual.

Cuando no se especifica una posición, el medio se añade al final de la pista predeterminada compatible:

| Medio | Pista predeterminada |
|---|---|
| Video | Video principal |
| Audio | Audio principal |
| Imagen | Video principal |

Las imágenes usan cinco segundos como duración inicial cuando no se indica otro valor.

## Compatibilidad de pistas

- video e imagen: pistas de video o superposición;
- audio: pistas de audio;
- video con audio: puede utilizar su stream de audio en una pista de audio;
- texto: pistas de texto o superposición;
- generadores: video o superposición;
- ajustes: pistas de ajuste.

La interfaz filtra las opciones incompatibles y el dominio valida las relaciones antes de guardar.

## Colisiones

Las pistas principales de video y audio no permiten que dos clips se superpongan.

Las pistas de texto y superposición sí permiten coincidencias temporales porque varios elementos pueden mostrarse simultáneamente.

Cuando existe una colisión, la operación se rechaza y el documento anterior permanece intacto.

## Recorte

El inspector permite editar:

```text
pista
inicio en la secuencia
duración visible
punto de entrada del original
```

Reglas:

- duración mínima: 10 ms;
- posición inicial mayor o igual a cero;
- el punto de entrada no puede ser negativo;
- el recorte no puede superar la duración técnica del original;
- una pista bloqueada no puede modificarse.

## División

Dividir un clip conserva la continuidad del original.

Ejemplo:

```text
Original en secuencia: 2 s → 10 s
Punto de corte: 6 s

Fragmento 1: secuencia 2 s → 6 s
Fragmento 2: secuencia 6 s → 10 s
```

En clips de medios también se recalculan `sourceStartUs` y `sourceDurationUs` para que el segundo fragmento continúe exactamente donde termina el primero.

Cada fragmento debe conservar al menos 10 ms.

## Eliminación

Al eliminar un clip se limpian además:

- su identificador dentro de la pista;
- transiciones que lo referencien;
- efectos cuya propiedad sea el clip;
- capas de texto que queden sin ningún clip asociado.

Los recursos de la biblioteca no se eliminan.

## Duración de secuencia

Después de cada operación se recalcula:

```text
sequence.durationUs = máximo final de todos los clips
```

Cuando la secuencia queda vacía, su duración vuelve a cero.

## Orden de clips

Los identificadores de cada pista se regeneran ordenados por:

1. posición de inicio;
2. identificador, cuando dos elementos empiezan al mismo tiempo.

Esto evita depender del orden accidental de inserción en los arreglos.

## Estados de pista

### Silenciar

Guarda `muted = true`. No elimina el audio.

### Ocultar

Guarda `hidden = true`. No elimina clips visuales.

### Bloquear

Guarda `locked = true` e impide:

- añadir clips;
- mover clips desde o hacia la pista;
- recortar;
- dividir;
- eliminar;
- editar textos ubicados en ella.

## Persistencia

Cada edición funcional utiliza `ProjectRepository.save` y crea un snapshot con una razón legible, por ejemplo:

```text
clip añadido: entrevista.mp4
clip movido
clip recortado
clip dividido
clip eliminado
estado de pista actualizado
```

Se conservan hasta 50 snapshots recientes por proyecto.

El proyecto puede cerrarse y reabrirse sin perder posiciones, recortes, divisiones ni estados de pistas.

## IPC

Canales incorporados:

```text
timeline:add-media-clip
timeline:move-clip
timeline:trim-clip
timeline:split-clip
timeline:delete-clip
timeline:update-track-state
```

El renderer envía identificadores y tiempos en milisegundos. El proceso principal:

1. valida el remitente;
2. valida el payload;
3. recupera el proyecto desde SQLite;
4. convierte tiempos a microsegundos;
5. aplica reglas del dominio;
6. guarda el documento y snapshot;
7. devuelve el documento persistido.

## Interfaz

La línea de tiempo muestra:

- regla temporal;
- posición proporcional de cada clip;
- ancho proporcional a su duración;
- colores por tipo;
- selección visible;
- pistas con controles `M`, `O` y `L`;
- zoom de 1× a 4×;
- selector para añadir medios;
- inspector lateral.

## Límites actuales

- el movimiento se realiza desde el inspector, todavía no mediante arrastrar y soltar;
- no existe cabezal de reproducción interactivo;
- no hay ajuste magnético entre bordes;
- la vista previa de video todavía no reproduce la composición completa;
- las transiciones se incorporarán en un bloque posterior.

## Pruebas

- inserción de medios;
- orden de `clipIds`;
- recorte y límites del original;
- movimiento;
- colisiones;
- bloqueo de pistas;
- división y continuidad de origen;
- eliminación y limpieza de relaciones;
- duración de secuencia;
- persistencia SQLite;
- reapertura del proyecto;
- creación de snapshots;
- rechazo de proyectos archivados.

## Archivos principales

1. `/apps/desktop/shared/domain/timeline-operations.ts`
2. `/apps/desktop/shared/timeline-editing-contracts.ts`
3. `/apps/desktop/main/timeline/timeline-editing-service.ts`
4. `/apps/desktop/main/timeline/timeline-request-validation.ts`
5. `/apps/desktop/main/ipc/register-timeline-ipc.ts`
6. `/apps/desktop/renderer/src/app/use-timeline-editor.ts`
7. `/apps/desktop/renderer/src/components/timeline/TimelineEditor.tsx`
8. `/apps/desktop/renderer/src/components/timeline/ClipInspector.tsx`
9. `/apps/desktop/renderer/src/timeline-editor.css`
10. `/tests/timeline-domain.test.mjs`
11. `/tests/timeline-editing.test.mjs`
12. `/docs/BLOQUE_13.md`

## Próximo bloque

Bloque 14: textos, títulos y subtítulos animados.
