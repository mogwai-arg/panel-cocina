#!/bin/bash
# Volver a Frameo como estaba: saca el arranque automático del panel y abre Frameo.
# (Chrome y el panel quedan instalados; para volver al panel: marco/4-instalar.sh)
# Uso:  bash marco/5-volver-a-frameo.sh 192.168.68.114
IP="$1"
[ -z "$IP" ] && { echo "Uso: bash marco/5-volver-a-frameo.sh IP_DEL_MARCO"; exit 1; }
adb connect "$IP:5555" >/dev/null
A="adb -s $IP:5555"
SU() { $A shell "su -c '$1'"; }
SU "rm -f /data/local/panel/activo; kill \$(cat /data/local/panel/pid 2>/dev/null) 2>/dev/null; rm -f /data/local/panel/pid"
SU "mount -o remount,rw /system"
SU "rm -f /system/su.d/90panel"
SU "[ -f /data/local/panel/original/install-recovery.sh ] && cp /data/local/panel/original/install-recovery.sh /system/bin/install-recovery.sh"
SU "mount -o remount,ro /system"
SU "settings delete global policy_control"
$A shell am force-stop com.android.chrome
$A shell am start -n net.frameo.frame/.feature.slideshow.ui.AScreenSlidePager >/dev/null
echo "Listo: el marco volvió a Frameo (y al reiniciar sigue en Frameo)."
