# Pasar el panel al marco

Todo se hace desde la Mac, con el marco en el mismo Wi-Fi. Cada paso dice si cambia algo
en el marco y cómo volver atrás.

## Paso 0: adb en la Mac (una vez)

`adb` es la herramienta oficial de Android para hablar con el marco.

- Con Homebrew: `brew install android-platform-tools`
- Sin Homebrew: bajá **SDK Platform-Tools para Mac** de
  https://developer.android.com/tools/releases/platform-tools, descomprimilo en tu carpeta
  personal y corré `echo 'export PATH="$HOME/platform-tools:$PATH"' >> ~/.zprofile`, cerrá y
  abrí la Terminal.

Para probar: `adb version`.

## Paso 1: diagnóstico y backup (no cambia nada)

1. En el marco: **Configuración → Acceso mediante ADB → activado**. Anotá la IP del marco
   (Configuración → Acerca de, o Wi-Fi).
2. En la Mac, en la carpeta `panel-cocina`:  `bash marco/1-diagnostico.sh IP_DEL_MARCO`
3. Si el marco pregunta "¿Permitir depuración?", tocá **Permitir** (y "Permitir siempre").

Guarda en `marco/backup-FECHA/` la app de Frameo y un `info.txt` con lo que tiene el marco
(Android, navegador, sensores). Esa carpeta no se sube a GitHub.
