#!/bin/bash
# El marco quedó trabado en el logo de Frameo al prenderse: una versión anterior deshabilitaba
# Frameo, que en este marco es la pantalla de inicio de Android. Esto lo vuelve a habilitar,
# instala el arranque corregido y reinicia el marco.
# Uso:  bash marco/8-destrabar-arranque.sh 192.168.68.114     (mejor con el cable USB conectado)
IP="${1:-192.168.68.114}"
adb kill-server >/dev/null 2>&1; adb start-server >/dev/null 2>&1
sleep 2
echo "Aparatos que ve la Mac:"; adb devices -l | sed 1d | sed '/^$/d; s/^/   /'
if adb -d get-state 2>/dev/null | grep -q device; then
  A="adb -d"; echo "Uso el cable USB."
else
  adb connect "$IP:5555" >/dev/null 2>&1; sleep 2
  if adb -s "$IP:5555" get-state 2>/dev/null | grep -q device; then A="adb -s $IP:5555"; echo "Uso el Wi-Fi ($IP)."
  else
    echo
    echo "No hay conexión con el marco. Pasale a Claude lo de arriba (\"Aparatos que ve la Mac\")."
    echo " - Si dice 'unauthorized' u 'offline': desenchufá y enchufá el cable USB y probá de nuevo."
    echo " - Si con el cable no aparece nada: probá otro cable (muchos cables solo cargan) u otro puerto de la Mac."
    exit 1
  fi
fi
echo "1/3 Habilitando Frameo ..."
$A shell "su -c 'pm enable net.frameo.frame'"
echo "2/3 Instalando el arranque corregido ..."
$A push marco/en-el-marco/arranque.sh /sdcard/panel-arranque.sh >/dev/null
$A shell "su -c 'cp /sdcard/panel-arranque.sh /data/local/panel/arranque.sh && chmod 755 /data/local/panel/arranque.sh && rm -f /sdcard/panel-arranque.sh /data/local/panel/pid'"
$A shell "su -c 'grep -c \"Frameo tiene que estar habilitado\" /data/local/panel/arranque.sh'" | grep -q 1 && echo "    listo" || echo "    ⚠️ no se pudo copiar el arranque"
echo "3/3 Reiniciando el marco (en 1-2 minutos tiene que aparecer el panel) ..."
$A shell "su -c reboot"
