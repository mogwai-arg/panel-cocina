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
  # Varios aparatos pueden tener ese puerto abierto: se pregunta a cada uno qué es.
  # El marco es el que tiene la carpeta del panel (/sdcard/panel).
  for ip in $(cat /tmp/marco-encontrado.txt); do
    adb connect "$ip:5555" >/dev/null 2>&1
    MODELO=$(adb -s "$ip:5555" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
    if adb -s "$ip:5555" shell ls /sdcard/panel/index.html 2>/dev/null | grep -q index.html; then
      echo "  ✓ EL MARCO está en $ip ($MODELO). Copiá y pegá:"
      echo "      bash marco/4-instalar.sh $ip"
    else
      echo "  · $ip: otro aparato${MODELO:+ ($MODELO)} (no es el marco)"
    fi
  done
else
  echo "No apareció. El marco tiene que estar prendido y en el mismo Wi-Fi."
  echo "Si lo reiniciaste hace menos de 2 minutos, esperá y probá de nuevo; si no, cable USB y:"
  echo "  bash marco/4-instalar.sh 192.168.68.114   (usa el cable solo si por Wi-Fi no responde)"
fi
