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
adb connect "$IP:5555" >/dev/null
A="adb -s $IP:5555"
$A shell true 2>/dev/null || { echo "No se pudo conectar con $IP (si se reinició: cable USB y bash marco/1-diagnostico.sh usb)"; exit 1; }
$A shell pm list packages | grep -q com.android.chrome || { echo "Falta Chrome: corré antes marco/2-probar.sh"; exit 1; }
SU() { $A shell "su -c '$1'"; }

echo "1/4 Copiando el panel ..."
$A shell rm -rf /sdcard/panel
$A push web /sdcard/panel >/dev/null && echo "    listo"

echo "2/4 Copiando el arranque ..."
$A push marco/en-el-marco/arranque.sh /sdcard/panel-arranque.sh >/dev/null
SU "mkdir -p /data/local/panel && cp /sdcard/panel-arranque.sh /data/local/panel/arranque.sh && chmod 755 /data/local/panel/arranque.sh && touch /data/local/panel/activo && rm /sdcard/panel-arranque.sh"

echo "3/4 Enganchando el arranque al encender ..."
# SuperSU corre los scripts de /system/su.d al arrancar. Por las dudas también se agrega una
# línea al final de install-recovery.sh (con copia del original); el script no corre dos veces.
LINEA='/system/bin/sh /data/local/panel/arranque.sh &'
SU "mount -o remount,rw /system"
SU "mkdir -p /system/su.d && echo \"#!/system/bin/sh\" > /system/su.d/90panel && echo \"$LINEA\" >> /system/su.d/90panel && chmod 755 /system/su.d /system/su.d/90panel"
if ! $A shell "su -c 'grep -q /data/local/panel /system/bin/install-recovery.sh'"; then
  SU "mkdir -p /data/local/panel/original && cp /system/bin/install-recovery.sh /data/local/panel/original/ && echo \"$LINEA\" >> /system/bin/install-recovery.sh"
fi
SU "mount -o remount,ro /system"

echo "4/4 Arrancando el panel ..."
SU "setprop persist.adb.tcp.port 5555"
SU "kill \$(cat /data/local/panel/pid 2>/dev/null) 2>/dev/null; rm -f /data/local/panel/pid"
$A shell "su -c 'setsid nohup /system/bin/sh /data/local/panel/arranque.sh > /dev/null 2>&1 &'" &
sleep 3
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
