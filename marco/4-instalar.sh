#!/bin/bash
# Paso 4: dejar el panel como pantalla del marco.
#  - copia el panel (web/ con tu config.js) al marco,
#  - instala el arranque automático (Chrome a pantalla completa, sensor, ADB por Wi-Fi),
#  - NO borra Frameo: queda instalado y se vuelve con marco/5-volver-a-frameo.sh.
# También sirve para actualizar el panel en el marco después de un git pull.
#
# Uso:  bash marco/4-instalar.sh 192.168.68.114
IP="$1"
[ -z "$IP" ] && { echo "Uso: bash marco/4-instalar.sh IP_DEL_MARCO"; exit 1; }
[ -f web/config.js ] || { echo "Falta web/config.js (corré esto desde la carpeta panel-cocina)"; exit 1; }
adb connect "$IP:5555" >/dev/null 2>&1
A="adb -s $IP:5555"
# Si por Wi-Fi no responde pero hay un cable USB conectado, se usa el cable.
if ! $A shell true >/dev/null 2>&1 && adb -d shell true >/dev/null 2>&1; then
  echo "(por Wi-Fi no responde: uso el cable USB)"
  A="adb -d"
fi
$A shell true 2>/dev/null || {
  echo "No se pudo conectar con $IP."
  echo " - Puede que el router le haya dado otra IP: mirala en el marco (Ajustes de Android → Wi-Fi) o en tu router."
  echo " - O conectá un cable USB de datos entre la Mac y el marco y volvé a correr este mismo comando."
  exit 1; }
$A shell pm list packages | grep -q com.android.chrome || { echo "Falta Chrome: corré antes marco/2-probar.sh"; exit 1; }
SU() { $A shell "su -c '$1'"; }

echo "1/4 Copiando el panel ..."
$A shell rm -rf /sdcard/panel
$A push web /sdcard/panel >/dev/null && echo "    listo"

echo "2/4 Copiando el arranque ..."
$A push marco/en-el-marco/arranque.sh /sdcard/panel-arranque.sh >/dev/null
SU "mkdir -p /data/local/panel && cp /sdcard/panel-arranque.sh /data/local/panel/arranque.sh && chmod 755 /data/local/panel/arranque.sh && touch /data/local/panel/activo && rm /sdcard/panel-arranque.sh"

echo "3/4 Enganchando el arranque al encender ..."
# install-recovery.sh corre como root en cada arranque (servicio flash_recovery). Se le agrega
# una línea al final, con copia del original. (Ojo: en Android 6 'adb shell' siempre devuelve
# "salió bien", por eso se mira la salida del comando y no su resultado.)
LINEA='setsid /system/bin/sh /data/local/panel/arranque.sh </dev/null >/dev/null 2>&1 &'
SU "mount -o remount,rw /system"
if [ -z "$($A shell "su -c 'grep -c panel/arranque /system/bin/install-recovery.sh'" | tr -d '\r' | grep -v '^0$')" ]; then
  SU "mkdir -p /data/local/panel/original; [ -f /data/local/panel/original/install-recovery.sh ] || cp /system/bin/install-recovery.sh /data/local/panel/original/"
  $A shell "su -c 'echo \"$LINEA\" >> /system/bin/install-recovery.sh'"
fi
SU "rm -rf /system/su.d"   # de la versión anterior: este SuperSU no la usa
SU "mount -o remount,ro /system"
if $A shell "su -c 'tail -1 /system/bin/install-recovery.sh'" | grep -q panel/arranque; then
  echo "    listo (al encender corre el panel)"
else
  echo "    ⚠️ no se pudo agregar al arranque: pasale a Claude lo que dice:"
  $A shell "su -c 'tail -3 /system/bin/install-recovery.sh'"
fi

echo "4/4 Arrancando el panel ..."
SU "setprop persist.adb.tcp.port 5555"
SU "P=\$(cat /data/local/panel/pid 2>/dev/null); [ -n \"\$P\" ] && grep -q arranque /proc/\$P/cmdline 2>/dev/null && kill \$P; rm -f /data/local/panel/pid"
$A shell "su -c 'setsid /system/bin/sh /data/local/panel/arranque.sh </dev/null >/dev/null 2>&1 &'"
sleep 3
if $A shell "su -c 'cat /data/local/panel/registro.log 2>/dev/null'" | grep -q inicio; then
  echo "    el vigía del marco está corriendo"
else
  echo "    ⚠️ el vigía no arrancó ahora (igual debería arrancar al reiniciar el marco)"
fi
# Frameo queda habilitado: es la pantalla de inicio de Android en este marco (sin él, el marco
# no termina de arrancar). Si se reinicia sin parar de fondo, el vigía del marco lo frena.
SU "pm enable net.frameo.frame" >/dev/null
# Cerrar las pestañas de antes (cada apertura vieja dejó una) y abrir el panel en una sola.
$A shell am force-stop com.android.chrome
SU "rm -rf /data/data/com.android.chrome/app_tabs"
$A shell "am start -n com.android.chrome/com.google.android.apps.chrome.Main -a android.intent.action.VIEW -d file:///sdcard/panel/index.html?marco=1 --es com.android.browser.application_id panel-cocina --ez create_new_tab false" >/dev/null
sleep 10
$A shell input tap 760 40
echo
echo "Listo: el panel tiene que quedar a pantalla completa solo (el marco se toca a sí mismo)."
echo "Para probar el arranque: apagá y prendé el marco; en ~1 minuto tiene que aparecer el panel."
echo "Registro de lo que hace el marco:  $A shell su -c 'cat /data/local/panel/registro.log'"
if [ "$A" = "adb -d" ]; then
  IPW=$($A shell ip -f inet addr show wlan0 2>/dev/null | tr -d '\r' | grep -o 'inet [0-9.]*' | cut -d' ' -f2)
  $A tcpip 5555 >/dev/null 2>&1
  echo "ADB por Wi-Fi prendido de nuevo. IP del marco: ${IPW:-no la encontré} (usá esa la próxima vez)."
fi
