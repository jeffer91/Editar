<!-- =========================================================
Nombre completo: README.md
Ruta o ubicación: /resources/bin/README.md

Función o funciones:
- Documentar dónde colocar FFmpeg y FFprobe.
- Explicar prioridades de resolución y variables de entorno.
- Evitar versionar binarios grandes dentro del repositorio.
========================================================= -->

# Binarios multimedia

Esta carpeta está reservada para los ejecutables de FFmpeg y FFprobe que acompañarán la aplicación empaquetada.

## Windows

Archivos esperados:

```text
resources/bin/ffmpeg.exe
resources/bin/ffprobe.exe
```

## Orden de búsqueda

La aplicación intenta localizar cada herramienta en este orden:

1. Variables de entorno `EDITAR_FFMPEG_PATH` y `EDITAR_FFPROBE_PATH`.
2. Carpeta `bin` dentro de los recursos empaquetados.
3. Carpeta `resources/bin` de la aplicación.
4. Carpeta `resources/bin` del proyecto durante desarrollo.
5. `PATH` del sistema operativo.

## Reglas

- Los comandos se ejecutan sin shell.
- Cada ejecutable debe responder correctamente a `-version`.
- Esta carpeta no debe contener descargas incompletas o archivos comprimidos.
- Los binarios grandes no se incluyen todavía en el repositorio.
- El instalador del bloque final deberá copiar versiones verificadas y compatibles con la licencia correspondiente.

## Configuración temporal

En PowerShell se puede señalar una instalación existente:

```powershell
$env:EDITAR_FFMPEG_PATH = "C:\ffmpeg\bin\ffmpeg.exe"
$env:EDITAR_FFPROBE_PATH = "C:\ffmpeg\bin\ffprobe.exe"
npm run dev
```

Las variables solo afectan a la sesión actual de PowerShell, salvo que se registren de forma permanente en Windows.
