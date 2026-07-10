<!-- =========================================================
Nombre completo: BLOQUE_17.md
Ruta o ubicación: /docs/BLOQUE_17.md

Función o funciones:
- Registrar el alcance técnico del Bloque 17.
- Documentar transiciones y efectos de sonido temporales.
- Mantener trazabilidad para composición y exportación futuras.
========================================================= -->

# Bloque 17 — Transiciones y efectos de sonido

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Permitir conectar clips visuales mediante transiciones persistentes y añadir efectos de sonido temporales sobre la secuencia sin modificar los archivos originales.

## Transiciones disponibles

```text
crossfade
dip-black
dip-white
slide-left
slide-right
zoom
blur
```

En la interfaz se presentan como:

- Disolución.
- Fundido a negro.
- Fundido a blanco.
- Deslizar a la izquierda.
- Deslizar a la derecha.
- Zoom.
- Desenfoque.

## Requisitos de una transición

Una transición solo puede guardarse cuando:

- ambos clips existen;
- pertenecen a la misma pista;
- la pista es visual;
- ambos clips contienen una capa visual;
- el final del primer clip coincide exactamente con el inicio del segundo;
- la pista no está bloqueada;
- el proyecto no está archivado;
- la duración es de al menos 10 ms;
- la duración no supera la de ninguno de los clips conectados.

## Alineación

Cada transición admite:

```text
start
center
end
```

Esto permite que el futuro compilador de render decida cómo distribuir la duración alrededor de la unión.

## Modelo persistente

Las transiciones utilizan `TransitionInstance` y guardan:

```text
fromClipId
toClipId
transitionType
version
durationUs
alignment
parameters
```

Solo existe una transición por pareja ordenada de clips. Guardar nuevamente la misma unión actualiza la transición existente.

## Limpieza automática

Mover, recortar o dividir un clip puede romper una unión. Después de esas operaciones, el servicio revisa todas las transiciones y elimina las que ya no cumplen:

- continuidad temporal;
- relación de pista;
- compatibilidad visual;
- duración válida.

Esto evita referencias obsoletas dentro del proyecto.

## Efectos de sonido disponibles

```text
click
whoosh
pop
impact
notification
camera
applause
```

En la interfaz se presentan como:

- Clic.
- Barrido.
- Pop.
- Impacto.
- Notificación.
- Cámara.
- Aplausos.

## Modelo de los sonidos

Cada sonido se guarda como un efecto de secuencia:

```text
sound-effect-cue
```

El evento conserva:

```text
sequenceId
presetId
startOffsetUs
durationUs
gainDb
pan
fadeInUs
fadeOutUs
```

Los efectos de sonido no crean clips de medios ficticios ni rutas inexistentes. Son eventos temporales independientes que el futuro renderizador deberá resolver o sintetizar.

## Límites de audio

- duración mínima: 50 ms;
- duración máxima: 30 s;
- ganancia: de -60 dB a +12 dB;
- paneo: de -1 a 1;
- los fundidos no pueden superar la duración;
- la suma de entrada y salida no puede superar la duración total.

## Previsualización

El renderer puede generar una aproximación local mediante Web Audio.

La previsualización:

- no accede a archivos;
- no usa rutas del sistema;
- aplica ganancia y paneo;
- genera osciladores o ruido temporal;
- destruye el contexto de audio al terminar.

La aproximación sirve para identificar la intención del preset. No representa todavía el archivo definitivo que utilizará la exportación.

## Pista de sonidos

El panel muestra los eventos sobre una pista temporal dedicada.

Cada bloque indica:

- posición inicial;
- duración relativa;
- preset;
- selección activa.

La duración visible considera tanto los clips como el final más lejano de los efectos de sonido.

## Edición de sonidos

El usuario puede:

- crear un evento;
- cambiar el preset;
- modificar inicio y duración;
- ajustar ganancia;
- ajustar paneo;
- configurar fundidos;
- escuchar una aproximación;
- actualizar el evento;
- eliminarlo.

## Persistencia

Las operaciones crean snapshots con razones legibles:

```text
transición actualizada
transición eliminada
efecto de sonido añadido
efecto de sonido actualizado
efecto de sonido eliminado
```

Al cerrar y abrir el proyecto se recuperan las transiciones y todos los parámetros de los sonidos.

## IPC

Canales incorporados:

```text
timeline:set-transition
timeline:remove-transition
timeline:add-sound-effect
timeline:update-sound-effect
timeline:delete-sound-effect
```

El proceso principal valida el remitente, el sobre de solicitud y todos los valores antes de acceder al repositorio.

## Seguridad

- no se aceptan filtros FFmpeg arbitrarios;
- no se aceptan nombres de presets fuera de listas cerradas;
- no se reciben rutas de audio;
- no se reciben scripts, shaders ni comandos;
- los tiempos y parámetros tienen límites;
- el renderer no escribe en SQLite;
- los proyectos archivados permanecen de solo lectura;
- la edición nunca modifica los originales.

## Pruebas

- creación de transición;
- actualización de transición;
- eliminación de transición;
- rechazo de clips separados;
- limpieza después de mover un clip;
- creación de efecto de sonido;
- actualización de efecto de sonido;
- listado ordenado;
- eliminación del sonido;
- rechazo de fundidos inválidos;
- persistencia SQLite;
- reapertura del proyecto;
- creación de snapshots;
- rechazo de proyectos archivados.

## Archivos principales

1. `/apps/desktop/shared/domain/transition-operations.ts`
2. `/apps/desktop/shared/domain/sound-effects.ts`
3. `/apps/desktop/shared/timeline-editing-contracts.ts`
4. `/apps/desktop/main/timeline/transition-sound-request-validation.ts`
5. `/apps/desktop/main/timeline/timeline-editing-service.ts`
6. `/apps/desktop/main/ipc/register-timeline-ipc.ts`
7. `/apps/desktop/preload/preload.cts`
8. `/apps/desktop/renderer/src/app/sound-effect-preview.ts`
9. `/apps/desktop/renderer/src/app/use-timeline-editor.ts`
10. `/apps/desktop/renderer/src/components/timeline/TimelineExtrasPanel.tsx`
11. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
12. `/apps/desktop/renderer/src/timeline-extras.css`
13. `/tests/transition-sound-domain.test.mjs`
14. `/tests/transition-sound-service.test.mjs`
15. `/docs/BLOQUE_17.md`

## Límites actuales

- las transiciones se guardan y se muestran, pero no se reproducen fotograma por fotograma;
- la previsualización de sonidos es sintética y aproximada;
- no existe todavía una biblioteca de archivos de sonido empaquetados;
- no existe cabezal de reproducción sincronizado;
- las transiciones y los sonidos todavía no se compilan a una exportación final;
- no hay previsualización audiovisual completa en tiempo real.

## Próximo bloque

Bloque 18: reproducción y previsualización de la composición.
