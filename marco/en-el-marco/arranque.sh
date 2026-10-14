#!/system/bin/sh
# Corre EN EL MARCO, como root, al encenderse (lo instala marco/4-instalar.sh).
#  - abre el panel en Chrome a pantalla completa (sin barras de Android),
#  - si Frameo vuelve a quedar adelante, trae el panel de nuevo,
#  - vigila el sensor de movimiento y se lo avisa al panel (tecla F12),
#  - deja ADB por Wi-Fi prendido.
# Para volver a Frameo: marco/5-volver-a-frameo.sh (desde la Mac) o borrar /data/local/panel/activo.

DIR=/data/local/panel
LOG=$DIR/registro.log
URL="file:///sdcard/panel/index.html?marco=1"
SENSOR=/sys/devices/gpio_sensor_ctl.25/sensor_value
CHROME=com.android.chrome/com.google.android.apps.chrome.Main

# Una sola copia corriendo
if [ -f $DIR/pid ] && kill -0 "$(cat $DIR/pid)" 2>/dev/null; then exit 0; fi
echo $$ > $DIR/pid

anotar() { echo "$(date '+%d/%m %H:%M:%S') $1" >> $LOG; }
# El registro no crece para siempre
[ -f $LOG ] && [ "$(wc -l < $LOG)" -gt 2000 ] && tail -n 500 $LOG > $LOG.tmp && mv $LOG.tmp $LOG

# Esperar a que Android termine de arrancar
while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 3; done
sleep 20
anotar "arranque"

setprop persist.adb.tcp.port 5555
settings put global policy_control immersive.full=com.android.chrome
settings put system screen_off_timeout 2147483647

abrir_panel() {
  input keyevent KEYCODE_WAKEUP
  am start -n $CHROME -a android.intent.action.VIEW -d "$URL" > /dev/null 2>&1
}

adelante() { dumpsys activity activities 2>/dev/null | grep -m1 mResumedActivity; }

[ -f $DIR/activo ] && abrir_panel

ANTES=""
CUENTA=0
while true; do
  if [ -f $DIR/activo ]; then
    # Sensor: cualquier cambio queda anotado; si marca algo distinto de 0, es movimiento.
    V=$(cat $SENSOR 2>/dev/null)
    if [ "$V" != "$ANTES" ]; then
      anotar "sensor=$V"
      ANTES="$V"
      if [ -n "$V" ] && [ "$V" != "0" ]; then input keyevent KEYCODE_F12; fi
    fi
    # Cada minuto: si quedó Frameo (u otra cosa) adelante, volver al panel.
    CUENTA=$((CUENTA + 1))
    if [ $CUENTA -ge 30 ]; then
      CUENTA=0
      case "$(adelante)" in
        *com.android.chrome*|*com.android.settings*|*packageinstaller*) ;;
        *) anotar "panel de nuevo adelante ($(adelante | sed 's/.* u0 //; s/ .*//'))"; abrir_panel ;;
      esac
    fi
  fi
  sleep 2
done
