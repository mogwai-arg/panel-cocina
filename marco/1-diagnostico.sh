#!/bin/bash
# Paso 1 en el marco: conectarse por Wi-Fi, ver qué tiene adentro y hacer el backup de Frameo.
# NO cambia nada en el marco: solo lee y copia a la Mac.
#
# Uso (desde la carpeta panel-cocina):
#   por Wi-Fi:  bash marco/1-diagnostico.sh 192.168.0.23   (la IP del marco)
#   por cable:  bash marco/1-diagnostico.sh usb            (además deja prendido el ADB por Wi-Fi)

IP="$1"
if [ -z "$IP" ]; then
  echo "Falta la IP del marco. Ejemplo:  bash marco/1-diagnostico.sh 192.168.0.23"
  exit 1
fi
if ! command -v adb >/dev/null 2>&1; then
  echo "Falta adb en la Mac. Instalalo con:  brew install android-platform-tools"
  echo "(si no tenés Homebrew, mirá marco/README.md)"
  exit 1
fi

DESTINO="marco/backup-$(date +%Y%m%d-%H%M)"
mkdir -p "$DESTINO"
INFO="$DESTINO/info.txt"

if [ "$IP" = "usb" ]; then
  echo "Buscando el marco por cable USB ..."
  adb wait-for-usb-device &
  ESPERA=$!
  sleep 8; kill $ESPERA 2>/dev/null
  if ! adb -d shell true 2>/dev/null; then
    echo
    echo "No aparece el marco por USB. Revisá:"
    echo " - Que el cable sea de datos (algunos solo cargan) y esté en el puerto del marco."
    echo " - En el marco: Configuración → Acceso mediante ADB → activado."
    echo " - Si en la pantalla del marco aparece '¿Permitir depuración?', tocá Permitir (y 'Siempre')."
    echo " Lo que ve la Mac:"; adb devices -l
    exit 1
  fi
  A="adb -d"
  POR_CABLE=1
else
  echo "Conectando con $IP ..."
  adb connect "$IP:5555"
  sleep 2
  if ! adb -s "$IP:5555" shell true 2>/dev/null; then
    echo
    echo "No se pudo entrar al marco por Wi-Fi. Probá por cable USB una vez:"
    echo "   bash marco/1-diagnostico.sh usb"
    echo "(conectá el marco a la Mac con un cable USB de datos; si pregunta '¿Permitir depuración?', tocá Permitir)"
    exit 1
  fi
  A="adb -s $IP:5555"
fi

{
  echo "=== Marco ==="
  for p in ro.product.manufacturer ro.product.model ro.product.board ro.board.platform ro.hardware \
           ro.build.version.release ro.build.version.sdk ro.product.cpu.abi ro.build.display.id; do
    echo "$p = $($A shell getprop $p | tr -d '\r')"
  done
  echo
  echo "=== Pantalla ==="
  $A shell wm size; $A shell wm density
  echo
  echo "=== Memoria y espacio ==="
  $A shell cat /proc/meminfo | head -3
  $A shell df -h /data /sdcard 2>/dev/null
  echo
  echo "=== ¿Root? ==="
  $A shell 'which su; su -c id 2>&1; id' 2>&1
  echo
  echo "=== Navegador (WebView / Chrome) ==="
  $A shell dumpsys webviewupdate 2>/dev/null | grep -iE "current webview|package|version" | head -8
  $A shell "pm list packages | grep -iE 'webview|chrome|browser'"
  echo
  echo "=== Apps instaladas (no de sistema) ==="
  $A shell pm list packages -3
  echo
  echo "=== Lanzador (pantalla de inicio) ==="
  $A shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME 2>/dev/null
  echo
  echo "=== Ajustes de pantalla ==="
  echo "brillo: $($A shell settings get system screen_brightness | tr -d '\r')"
  echo "apagado (ms): $($A shell settings get system screen_off_timeout | tr -d '\r')"
  echo "mantener encendida: $($A shell settings get global stay_on_while_plugged_in | tr -d '\r')"
  echo
  echo "=== Sensores ==="
  $A shell dumpsys sensorservice 2>/dev/null | grep -iE "^[0-9a-fx]+\)|name|proximity|motion|pir|human|presence" | head -30
  echo
  echo "=== Dispositivos de entrada (el sensor de movimiento a veces aparece acá) ==="
  $A shell getevent -lp 2>/dev/null | grep -E "add device|name:" | head -30
  echo
  echo "=== Pistas del sensor en el sistema ==="
  $A shell 'ls /sys/class/gpio /sys/class/misc /dev 2>/dev/null' | tr '\n' ' ' | grep -ioE "[a-z_]*(pir|motion|human|body|sensor|ir_)[a-z0-9_]*" | sort -u
  $A shell "dumpsys package net.frameo.app 2>/dev/null | grep -iE 'versionName|permission.*(SENSOR|BODY)'" | head -10
} > "$INFO" 2>&1
echo "Información del marco guardada en $INFO"

# Backup de Frameo: la app (APK) y la lista de todo lo instalado.
# No se borra nada: en el paso siguiente Frameo solo se "pausa" y se puede volver atrás.
echo "Copiando Frameo a la Mac ..."
$A shell pm list packages -f > "$DESTINO/paquetes.txt"
for paq in $($A shell pm list packages | tr -d '\r' | sed 's/package://' | grep -iE 'frameo'); do
  mkdir -p "$DESTINO/apk/$paq"
  for ruta in $($A shell pm path "$paq" | tr -d '\r' | sed 's/package://'); do
    $A pull "$ruta" "$DESTINO/apk/$paq/" >/dev/null && echo "  copiado: $paq ($(basename "$ruta"))"
  done
done
# Fotos que estén en la memoria del marco a la vista (Frameo guarda las suyas adentro de la app).
$A shell 'ls -la /sdcard /sdcard/DCIM /sdcard/Pictures /sdcard/Frameo 2>/dev/null' > "$DESTINO/archivos-sdcard.txt"

# Por cable: al final (prenderlo corta la conexión USB), dejar ADB por Wi-Fi prendido
# para que los pasos siguientes no necesiten el cable.
if [ -n "$POR_CABLE" ]; then
  IPW=$($A shell ip -f inet addr show wlan0 2>/dev/null | tr -d '\r' | grep -o 'inet [0-9.]*' | cut -d' ' -f2)
  $A tcpip 5555 >/dev/null 2>&1 && echo "ADB por Wi-Fi prendido. IP del marco: ${IPW:-no la encontré}"
fi

echo
echo "Listo. Mandale a Claude el contenido de: $INFO"
echo "(con:  cat $INFO  y copiás lo que aparece)"
