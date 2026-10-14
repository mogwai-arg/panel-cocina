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

## Paso 2: probar el panel (no toca Frameo)

`bash marco/2-probar.sh IP ~/Downloads/chrome-106....apkm` — instala Chrome 106 (el último
para Android 6), copia el panel y lo abre.

## Paso 3: diagnóstico del sensor y del arranque (no cambia nada)

`bash marco/3-sensor.sh IP`

## Paso 4: instalar

`bash marco/4-instalar.sh IP`

- Copia el panel al marco y deja un arranque automático (`/data/local/panel/arranque.sh`,
  enganchado en `/system/su.d` y en `install-recovery.sh`, con copia del original):
  al encender abre el panel en Chrome a pantalla completa, sin barras de Android; si Frameo
  queda adelante, vuelve al panel; vigila el sensor de movimiento y deja ADB por Wi-Fi.
- El primer toque pone la pantalla completa (Chrome no deja hacerlo sin un toque).
- **Para actualizar el panel** después de un `git pull`: correr de nuevo `4-instalar.sh`.
- Registro de lo que hace el marco: `adb -s IP:5555 shell su -c 'cat /data/local/panel/registro.log'`

## Volver a Frameo

`bash marco/5-volver-a-frameo.sh IP` — saca el arranque automático y abre Frameo. Frameo nunca
se desinstala; el backup de su app y sus datos quedó en `marco/backup-FECHA/`.
