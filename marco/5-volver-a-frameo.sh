#!/bin/bash
# Volver a Frameo como estaba: saca el arranque automático del panel y abre Frameo.
# (Chrome y el panel quedan instalados; para volver al panel: marco/4-instalar.sh)
# Uso:  bash marco/5-volver-a-frameo.sh 192.168.68.114
IP="$1"
[ -z "$IP" ] && { echo "Uso: bash marco/5-volver-a-frameo.sh IP_DEL_MARCO"; exit 1; }
adb connect "$IP:5555" >/dev/null 2>&1
A="adb -s $IP:5555"
# Si por Wi-Fi no responde pero hay un cable USB conectado, se usa el cable.
if ! $A shell true >/dev/null 2>&1 && adb -d shell true >/dev/null 2>&1; then
  echo "(por Wi-Fi no responde: uso el cable USB)"
  A="adb -d"
fi
SU() { $A shell "su -c '$1'"; }
SU "rm -f /data/local/panel/activo; P=\$(cat /data/local/panel/pid 2>/dev/null); [ -n \"\$P\" ] && grep -q arranque /proc/\$P/cmdline 2>/dev/null && kill \$P; rm -f /data/local/panel/pid"
SU "mount -o remount,rw /system"
SU "rm -rf /system/su.d"
SU "[ -f /data/local/panel/original/install-recovery.sh ] && cp /data/local/panel/original/install-recovery.sh /system/bin/install-recovery.sh"
SU "mount -o remount,ro /system"
SU "settings delete global policy_control"
SU "pm enable net.frameo.frame" >/dev/null
$A shell am force-stop com.android.chrome
$A shell am start -n net.frameo.frame/.feature.slideshow.ui.AScreenSlidePager >/dev/null
echo "Listo: el marco volvió a Frameo (y al reiniciar sigue en Frameo)."
