#!/bin/bash
# Si la pantalla del marco quedó negra y no responde: mira qué pasa (guarda un informe y
# una captura de lo que Chrome está dibujando) y después vuelve a abrir el panel.
# Uso:  bash marco/7-pantalla-negra.sh 192.168.68.114
IP="$1"
[ -z "$IP" ] && { echo "Uso: bash marco/7-pantalla-negra.sh IP_DEL_MARCO"; exit 1; }
adb connect "$IP:5555" >/dev/null 2>&1
A="adb -s $IP:5555"
if ! $A shell true >/dev/null 2>&1 && adb -d shell true >/dev/null 2>&1; then
  echo "(por Wi-Fi no responde: uso el cable USB)"
  A="adb -d"
fi
$A shell true 2>/dev/null || { echo "No se pudo conectar con $IP (probá con cable USB, o desenchufá y volvé a enchufar el marco)"; exit 1; }
SU() { $A shell "su -c '$1'"; }
HORA=$(date +%Y%m%d-%H%M)
SALIDA="marco/pantalla-negra-$HORA.txt"

echo "1/2 Mirando qué pasa ..."
# Captura ANTES de tocar nada: si se ve el panel, Chrome anda y lo apagado es la luz de la pantalla.
$A shell screencap -p /sdcard/captura.png && $A pull /sdcard/captura.png "marco/pantalla-negra-$HORA.png" >/dev/null 2>&1
{
  echo "=== hora del marco ==="; $A shell date
  echo; echo "=== pantalla (power) ==="; $A shell "dumpsys power | grep -iE 'mWakefulness|Display Power|mScreenOn|mScreenBrightnessSetting|mStayOn|mUserActivityTimeoutOverride|screenBrightness'"
  echo; echo "=== brillo ==="; $A shell "settings get system screen_brightness; settings get system screen_brightness_mode; settings get system screen_off_timeout"
  SU "for f in /sys/class/backlight/*/brightness /sys/class/backlight/*/bl_power; do echo \$f: \$(cat \$f); done"
  echo; echo "=== adelante ==="; $A shell "dumpsys activity activities | grep -m2 -E 'mResumedActivity|mFocusedActivity'"; $A shell "dumpsys window | grep -m2 -E 'mCurrentFocus|mFocusedApp'"
  echo; echo "=== procesos de Chrome y Frameo ==="; $A shell "ps | grep -E 'chrome|frameo'"
  echo; echo "=== memoria ==="; $A shell "cat /proc/meminfo | head -4"
  echo; echo "=== errores anotados por el panel ==="
  SU "cat /data/data/com.android.chrome/app_chrome/Default/Local\\ Storage/leveldb/*.log 2>/dev/null" | LC_ALL=C tr -d '\000' | LC_ALL=C tr -c '[:print:]' '\n' | grep -oE '[0-9]{1,2}/[0-9]{1,2} [0-9]{2}:[0-9]{2} [^"]{3,200}' | tail -12
  echo; echo "=== vigía del marco ==="; SU "tail -25 /data/local/panel/registro.log"
  echo; echo "=== Android: errores recientes ==="
  $A shell "logcat -d -v time 2>/dev/null | grep -iE 'lowmemory|killing|died|crash|ANR|chromium.*(error|fatal)|frameo.*(sleep|screen|bright)|backlight' | tail -40"
} > "$SALIDA" 2>&1
echo "    informe: $SALIDA   captura: marco/pantalla-negra-$HORA.png"

echo "2/2 Volviendo a abrir el panel ..."
$A shell input keyevent KEYCODE_WAKEUP
BR=$($A shell settings get system screen_brightness | tr -d '\r')
[ -z "$BR" ] || [ "$BR" -lt 30 ] 2>/dev/null && $A shell settings put system screen_brightness 200
$A shell am force-stop com.android.chrome
sleep 2
$A shell "am start -n com.android.chrome/com.google.android.apps.chrome.Main -a android.intent.action.VIEW -d 'file:///sdcard/panel/index.html?marco=1' --es com.android.browser.application_id panel-cocina --ez create_new_tab false" >/dev/null
sleep 10
$A shell input tap 760 40
echo "    listo. Pasale a Claude:  cat $SALIDA   (y la captura, si la querés mandar)"
