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
anotar "inicio (pid $$)"
# El registro no crece para siempre
[ -f $LOG ] && [ "$(wc -l < $LOG)" -gt 2000 ] && tail -n 500 $LOG > $LOG.tmp && mv $LOG.tmp $LOG

# Esperar a que Android termine de arrancar
while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 3; done
sleep 20
anotar "arranque"

# ADB por Wi-Fi en cada arranque (si no, después de apagar hace falta el cable).
if [ "$(getprop service.adb.tcp.port)" != "5555" ]; then
  setprop persist.adb.tcp.port 5555
  setprop service.adb.tcp.port 5555
  stop adbd; start adbd
fi
anotar "ip $(ip -f inet addr show wlan0 2>/dev/null | grep -o 'inet [0-9.]*' | cut -d' ' -f2)"
settings put global policy_control immersive.full=com.android.chrome
settings put system screen_off_timeout 2147483647
# Frameo deshabilitado (ver 4-instalar.sh); si una actualización lo volvió a habilitar, de nuevo.
pm list packages -d 2>/dev/null | grep -q net.frameo.frame || { pm disable net.frameo.frame >/dev/null 2>&1; anotar "Frameo en pausa"; }

abrir_panel() {
  input keyevent KEYCODE_WAKEUP
  # application_id: Chrome reutiliza siempre la misma pestaña (no abre una nueva cada vez).
  am start -n $CHROME -a android.intent.action.VIEW -d "$URL" \
    --es com.android.browser.application_id panel-cocina --ez create_new_tab false > /dev/null 2>&1
  # Chrome solo deja la pantalla completa después de un toque: el marco se toca solo,
  # arriba al medio (sobre el clima, donde no hay botones).
  sleep 10
  input tap 760 40
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
      # Si Android cerró Chrome por falta de memoria, la ventana queda negra: abrirlo de nuevo.
      if ! ps | grep -q 'com\.android\.chrome$'; then
        anotar "Chrome estaba cerrado (falta de memoria?): abrir de nuevo"
        abrir_panel
        continue
      fi
      # Si se cayó solo la página (Chrome muestra "error al mostrar la página"), su proceso
      # (sandboxed_process) desaparece: dos minutos seguidos sin él → abrir el panel de nuevo.
      # Solo se vigila después de haberlo visto alguna vez (por si el nombre cambia).
      if ps | grep -q 'com\.android\.chrome:sandboxed_process'; then
        VISTA_PAGINA=1; SIN_PAGINA=0
      elif [ -n "$VISTA_PAGINA" ]; then
        SIN_PAGINA=$((SIN_PAGINA + 1))
        if [ $SIN_PAGINA -ge 2 ]; then
          anotar "la página del panel se cayó: abrir de nuevo ($(grep MemFree /proc/meminfo))"
          SIN_PAGINA=0
          abrir_panel
          continue
        fi
      fi
      case "$(adelante)" in
        *com.android.chrome*|*com.android.settings*|*packageinstaller*) ;;
        *) anotar "panel de nuevo adelante ($(adelante | sed 's/.* u0 //; s/ .*//'))"; abrir_panel ;;
      esac
    fi
  fi
  sleep 2
done
