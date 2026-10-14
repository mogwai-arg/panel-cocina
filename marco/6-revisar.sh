#!/bin/bash
# Revisa por qué el panel no arrancó solo al encender el marco (no cambia nada).
# Uso:  bash marco/6-revisar.sh 192.168.68.114
IP="$1"
[ -z "$IP" ] && { echo "Uso: bash marco/6-revisar.sh IP_DEL_MARCO"; exit 1; }
adb connect "$IP:5555" >/dev/null 2>&1
A="adb -s $IP:5555"
# Si por Wi-Fi no responde pero hay un cable USB conectado, se usa el cable.
if ! $A shell true >/dev/null 2>&1 && adb -d shell true >/dev/null 2>&1; then
  echo "(por Wi-Fi no responde: uso el cable USB)"
  A="adb -d"
fi
$A shell true 2>/dev/null || { echo "No se pudo conectar con $IP (si no responde: cable USB y bash marco/1-diagnostico.sh usb)"; exit 1; }
SALIDA="marco/revision-$(date +%Y%m%d-%H%M).txt"
{
  echo "=== install-recovery.sh ==="; $A shell "su -c 'cat /system/bin/install-recovery.sh'"
  echo; echo "=== su.d ==="; $A shell "su -c 'ls -laZ /system/su.d /system/su.d/* 2>&1; cat /system/su.d/90panel 2>&1'"
  echo; echo "=== panel ==="; $A shell "su -c 'ls -laZ /data/local/panel; cat /data/local/panel/registro.log 2>&1 | tail -15'"
  echo; echo "=== SELinux ==="; $A shell getenforce
  echo; echo "=== Procesos ==="; $A shell "ps | grep -E 'daemonsu|arranque|sh ' | head -10"
  echo; echo "=== Versión de SuperSU ==="; $A shell "su -v 2>&1; su -V 2>&1"
  echo; echo "=== Registro de Android (arranque) ==="
  $A shell "logcat -d 2>/dev/null | grep -iE 'avc.*(panel|arranque|install.recovery|su\\.d)|flash_recovery|install-recovery|su\\.d|panel/arranque' | tail -25"
  $A shell "dmesg 2>/dev/null | grep -iE 'avc.*(panel|arranque|install|recovery)|flash_recovery' | tail -15"
} > "$SALIDA" 2>&1
echo "Pasale a Claude lo que aparece con:  cat $SALIDA"
