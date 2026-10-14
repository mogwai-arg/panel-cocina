#!/bin/bash
# Paso 3 (diagnóstico, no cambia nada): cómo se comporta el sensor de movimiento y cómo
# arranca el marco al encenderse (para que después el panel arranque solo).
#
# Uso:  bash marco/3-sensor.sh 192.168.68.114
IP="$1"
[ -z "$IP" ] && { echo "Uso: bash marco/3-sensor.sh IP_DEL_MARCO"; exit 1; }
adb connect "$IP:5555" >/dev/null
A="adb -s $IP:5555"
$A shell true 2>/dev/null || { echo "No se pudo conectar con $IP"; exit 1; }
SALIDA="marco/sensor-$(date +%Y%m%d-%H%M).txt"
DIR=/sys/devices/gpio_sensor_ctl.25

{
  echo "=== Archivos del sensor ==="
  $A shell "su -c 'ls -la $DIR; for f in $DIR/*; do [ -f \"\$f\" ] && echo \"\$f = \$(cat \"\$f\" 2>/dev/null | head -c 60)\"; done'"
  echo
  echo "=== Arranque del marco ==="
  $A shell "su -c 'ls -la /system/etc/install-recovery.sh /system/bin/install-recovery.sh /system/etc/init.d /su/su.d /system/su.d 2>&1'"
  $A shell "su -c 'cat /system/etc/install-recovery.sh 2>/dev/null | head -20'"
  $A shell "su -c 'grep -l -E \"install-recovery|flash_recovery|preinstall|userinit\" /init*.rc 2>/dev/null'"
  $A shell "su -c 'grep -A3 -E \"service (flash_recovery|install-recovery|preinstall|userinit|bootup)\" /init*.rc 2>/dev/null'" | head -30
  echo
  echo "=== Herramientas ==="
  $A shell "ls /system/xbin; which busybox toybox nohup setsid 2>/dev/null"
  echo
  echo "=== Lanzador (pantalla de inicio) ==="
  $A shell "dumpsys package r 2>/dev/null | grep -B1 -A4 'category.HOME'" | head -20
} > "$SALIDA" 2>&1

echo "Sensor de movimiento durante 3 minutos:"
echo "  1) ahora salí de la habitación (o tapá el sensor sin moverte),"
echo "  2) a los 2 minutos volvé y pasá frente al marco."
ANTES=""
FIN=$(( $(date +%s) + 180 ))
echo "--- sensor ---" >> "$SALIDA"
while [ "$(date +%s)" -lt "$FIN" ]; do
  V=$($A shell "su -c 'cat $DIR/sensor_value'" 2>/dev/null | tr -d '\r\n ')
  if [ "$V" != "$ANTES" ]; then
    L="$(date +%H:%M:%S)  sensor = $V"; echo "  $L"; echo "$L" >> "$SALIDA"; ANTES="$V"
  fi
  sleep 0.5
done
echo
echo "Listo. Pasale a Claude lo que aparece con:  cat $SALIDA"
