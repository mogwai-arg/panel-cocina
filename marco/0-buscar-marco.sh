#!/bin/bash
# Busca el marco en la red de casa (por si el router le cambió la IP).
# Prueba todas las direcciones de la red de la Mac y muestra las que tienen ADB (puerto 5555) abierto.
# Uso:  bash marco/0-buscar-marco.sh
adb kill-server >/dev/null 2>&1; adb start-server >/dev/null 2>&1
MIA=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
[ -z "$MIA" ] && { echo "No encontré la IP de la Mac (¿está en el Wi-Fi?)"; exit 1; }
RED=${MIA%.*}
echo "Buscando el marco en $RED.1 a $RED.254 (unos segundos) ..."
for i in $(seq 1 254); do
  ( nc -z -G 1 "$RED.$i" 5555 >/dev/null 2>&1 && echo "$RED.$i" ) &
done | sort -t. -k4 -n > /tmp/marco-encontrado.txt
wait
if [ -s /tmp/marco-encontrado.txt ]; then
  for ip in $(cat /tmp/marco-encontrado.txt); do echo "  ✓ marco en $ip   →  bash marco/4-instalar.sh $ip"; done
else
  echo "No apareció. El marco tiene que estar prendido y en el mismo Wi-Fi."
  echo "Si lo reiniciaste hace menos de 2 minutos, esperá y probá de nuevo; si no, cable USB y:"
  echo "  bash marco/4-instalar.sh 192.168.68.114   (usa el cable solo si por Wi-Fi no responde)"
fi
