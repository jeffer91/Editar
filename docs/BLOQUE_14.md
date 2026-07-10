<!-- =========================================================
Nombre completo: BLOQUE_14.md
Ruta o ubicación: /docs/BLOQUE_14.md

Función o funciones:
- Registrar el alcance técnico del Bloque 14.
- Documentar plantillas, estilos y animaciones de texto.
- Mantener trazabilidad para composición y exportación futuras.
========================================================= -->

# Bloque 14 — Textos, títulos y subtítulos animados

## Estado

**COMPLETADO Y VERIFICADO**

## Objetivo

Permitir que el usuario añada capas de texto editables a la línea de tiempo, aplique plantillas institucionales o audiovisuales y configure animaciones de entrada y salida sin generar imágenes rasterizadas permanentes.

## Plantillas disponibles

### Título

- texto centrado;
- tamaño inicial de 76 px;
- peso 800;
- animación de entrada `scale-in`;
- salida `fade`.

### Subtítulo

- ubicación inferior;
- tamaño inicial de 42 px;
- fondo semitransparente;
- entrada y salida `fade`.

### Rótulo inferior

- alineación izquierda;
- contenido en dos líneas;
- fondo semitransparente;
- entrada `slide-left`;
- salida `fade`.

### Texto flotante

- color de fondo destacado;
- peso 800;
- ligera rotación inicial;
- entrada `slide-up`;
- salida `fade`.

## Modelo de capa

Cada `TextLayer` contiene:

```text
id
projectId
name
content
style
entranceAnimation
exitAnimation
```

El clip de la línea de tiempo mantiene la referencia mediante:

```text
source.type = text
source.textLayerId
```

La duración y posición pertenecen al clip. El contenido, estilo y animaciones pertenecen a la capa.

## Estilo editable

El inspector permite cambiar:

- contenido;
- familia tipográfica;
- tamaño;
- peso;
- estilo normal o cursiva;
- color del texto;
- color de fondo;
- opacidad del fondo;
- alineación horizontal;
- alineación vertical;
- interlineado;
- espaciado entre letras;
- ancho máximo.

La interfaz inicial expone los controles más importantes y el contrato admite el resto para futuras pantallas especializadas.

## Validación de estilo

- tamaño: 1 a 10000 px en el dominio;
- peso: múltiplos de 100 entre 100 y 900;
- colores: formato `#RRGGBB`;
- opacidad: 0 a 1;
- interlineado: 0.1 a 10;
- espaciado: -1000 a 1000 px;
- ancho máximo: 1 a 100000 px;
- contenido: 1 a 100000 caracteres.

Los colores se normalizan a mayúsculas antes de persistirse.

## Animaciones permitidas

```text
fade
slide-up
slide-left
scale-in
typewriter
```

Cada referencia guarda:

```text
presetId
durationMs
```

La duración debe estar entre 0 y 60000 ms.

El renderer no puede registrar nombres arbitrarios de animaciones. Solo se aceptan los presets declarados por el dominio.

## Creación

Al pulsar una plantilla:

1. se localiza la pista de texto principal;
2. se calcula el final de esa pista;
3. se crea un `TextLayer` validado;
4. se crea un clip de texto;
5. se registra la referencia entre ambos;
6. se recalcula la secuencia;
7. se guarda un snapshot;
8. el nuevo clip queda seleccionado.

Duración inicial predeterminada:

```text
4000 ms
```

## Actualización

Editar un texto conserva:

- su identificador;
- posición y duración del clip;
- pista;
- transformaciones del clip;
- efectos futuros asociados.

Solo se reemplazan el contenido, estilo y animaciones solicitados.

Enviar `null` como preset elimina la animación correspondiente.

## Eliminación

Cuando se elimina un clip de texto:

- se retira de la pista;
- se eliminan sus transiciones y efectos directos;
- se elimina la capa si ningún otro clip la utiliza.

Esto evita capas huérfanas dentro del documento del proyecto.

## Vista previa

El monitor del Editor muestra el texto seleccionado aplicando:

- color;
- fondo y opacidad;
- tipografía;
- peso;
- cursiva;
- interlineado;
- espaciado;
- alineación;
- animación de entrada.

La vista previa utiliza CSS únicamente para interacción inmediata. El render final con FFmpeg o compositor se incorporará en los bloques de composición y exportación.

## Posición visual

Las plantillas guardan transformaciones iniciales en el clip:

```text
positionX
positionY
rotationDegrees
scaleX
scaleY
opacity
```

Estas propiedades ya pertenecen al modelo de línea de tiempo, aunque el inspector específico de posición visual se ampliará junto con los efectos de video.

## IPC

Canales incorporados:

```text
timeline:add-text-clip
timeline:update-text-clip
```

El renderer envía:

```text
projectId
clipId
templateId
content
style
entrancePresetId
entranceDurationMs
exitPresetId
exitDurationMs
```

La validación IPC no acepta rutas, HTML, scripts ni nombres libres de animación.

## Persistencia y recuperación

Las razones de snapshot incluyen:

```text
texto añadido: title
texto añadido: subtitle
texto añadido: lower-third
texto añadido: caption
texto actualizado
```

Al reabrir el proyecto se recuperan el contenido, estilo, posición temporal y animaciones.

## Seguridad

- no se interpreta HTML;
- el contenido se trata como texto;
- no se cargan fuentes desde URL;
- los colores deben tener formato hexadecimal;
- los presets pertenecen a una lista cerrada;
- los tiempos tienen límites;
- los proyectos archivados no pueden editarse;
- las pistas bloqueadas impiden cambios.

## Límites actuales

- no existe todavía editor visual de posición mediante arrastre;
- la vista previa no representa aún el tiempo exacto de entrada y salida;
- no existe transcripción automática a subtítulos;
- no se importan archivos SRT o VTT todavía;
- el render final de las capas se implementará en la fase de composición/exportación;
- no se distribuyen archivos de fuentes dentro del repositorio.

## Pruebas

- creación de las cuatro plantillas;
- estilos predeterminados;
- animaciones predeterminadas;
- actualización de contenido;
- actualización de color y tamaño;
- cambio de preset;
- eliminación de animación con `null`;
- validación de colores;
- validación de duración;
- persistencia SQLite;
- reapertura del proyecto;
- limpieza de capas huérfanas;
- rechazo en proyectos archivados.

## Archivos principales

1. `/apps/desktop/shared/domain/text.ts`
2. `/apps/desktop/shared/domain/text-operations.ts`
3. `/apps/desktop/shared/timeline-editing-contracts.ts`
4. `/apps/desktop/main/timeline/timeline-editing-service.ts`
5. `/apps/desktop/main/timeline/timeline-request-validation.ts`
6. `/apps/desktop/main/ipc/register-timeline-ipc.ts`
7. `/apps/desktop/renderer/src/app/use-timeline-editor.ts`
8. `/apps/desktop/renderer/src/components/timeline/TimelineEditor.tsx`
9. `/apps/desktop/renderer/src/components/timeline/ClipInspector.tsx`
10. `/apps/desktop/renderer/src/screens/EditorScreen.tsx`
11. `/apps/desktop/renderer/src/timeline-editor.css`
12. `/tests/timeline-domain.test.mjs`
13. `/tests/timeline-editing.test.mjs`
14. `/docs/BLOQUE_14.md`

## Próximo bloque

Bloque 15: edición y mezcla de audio.
