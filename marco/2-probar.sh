#!/bin/bash
# Paso 2: probar el panel en el marco SIN tocar Frameo.
#   - instala Chrome 106 (el último para Android 6),
#   - copia el panel (con tu config.js) al marco y lo abre en Chrome,
#   - muestra 30 segundos lo que marca el sensor de movimiento.
#
# Uso (desde la carpeta panel-cocina):
#   bash marco/2-probar.sh 192.168.68.114 ~/Downloads/com.android.chrome_106...apkm
#
# Para volver a Frameo:  adb -s IP:5555 shell am start -n net.frameo.frame/.feature.slideshow.ui.AScreenSlidePager
#   (o tocar el botón de inicio del marco)

IP="$1"
APKM="$2"
if [ -z "$IP" ] || [ -z "$APKM" ]; then
  echo "Uso: bash marco/2-probar.sh IP_DEL_MARCO ruta/al/chrome.apkm"; exit 1
fi
[ -f web/config.js ] || { echo "Falta web/config.js (corré esto desde la carpeta panel-cocina)"; exit 1; }
adb connect "$IP:5555" >/dev/null
A="adb -s $IP:5555"
if ! $A shell true 2>/dev/null; then
  echo "No se pudo conectar con $IP. Si el marco se reinició: cable USB y 'bash marco/1-diagnostico.sh usb'."; exit 1
fi

# 1) Chrome 106
if $A shell pm list packages | grep -q 'package:com.android.chrome'; then
  echo "Chrome ya está instalado: $($A shell dumpsys package com.android.chrome | grep -m1 versionName | tr -d ' \r')"
else
  TMP=$(mktemp -d)
  echo "Abriendo $APKM ..."
  if ! unzip -q -o "$APKM" -d "$TMP" 2>/dev/null || ! ls "$TMP"/*.apk >/dev/null 2>&1; then
    echo "No pude abrir el .apkm (puede venir cifrado). Bajá desde APKMirror la versión 'APK' (no 'BUNDLE') y pasala en su lugar."
    exit 1
  fi
  PARTES=()
  for f in "$TMP"/*.apk; do
    n=$(basename "$f")
    case "$n" in
      *arm64*|*x86*|*mips*) continue ;;                                          # otro procesador
      split_config.*dpi.apk) [ "$n" = "split_config.mdpi.apk" ] || continue ;;   # pantalla del marco: mdpi
      split_config.??.apk|split_config.??_??.apk)                                # idiomas: solo es y en
        case "$n" in split_config.es*.apk|split_config.en*.apk) ;; *) continue ;; esac ;;
    esac
    PARTES+=("$f")
  done
  echo "Instalando Chrome 106 (${#PARTES[@]} partes; tarda un par de minutos) ..."
  if [ ${#PARTES[@]} -eq 1 ]; then $A install -r "${PARTES[0]}"; else $A install-multiple -r "${PARTES[@]}"; fi || {
    echo "No se pudo instalar Chrome. Pasale a Claude el mensaje de arriba."; exit 1; }
  rm -rf "$TMP"
fi
# Que Chrome pueda leer el panel guardado en la memoria del marco
$A shell pm grant com.android.chrome android.permission.READ_EXTERNAL_STORAGE 2>/dev/null

# 2) El panel, copiado al marco
echo "Copiando el panel al marco ..."
$A shell rm -rf /sdcard/panel
$A push web /sdcard/panel >/dev/null && echo "  listo: /sdcard/panel"

# 3) Abrirlo en Chrome
$A shell input keyevent KEYCODE_WAKEUP
$A shell am start -a android.intent.action.VIEW -n com.android.chrome/com.google.android.apps.chrome.Main \
  -d "file:///sdcard/panel/index.html" >/dev/null
echo
echo "En el marco se abre Chrome. La primera vez pide aceptar términos o iniciar sesión: tocá"
echo "'Aceptar y continuar' y 'No, gracias'. Si no aparece el panel, en la barra de direcciones"
echo "escribí:  file:///sdcard/panel/index.html"
echo

# 4) Sensor de movimiento
echo "Sensor de movimiento: durante 30 segundos, alejate y después pasá la mano por adelante del marco."
SENSOR=/sys/devices/gpio_sensor_ctl.25/sensor_value
ANTES=""
for i in $(seq 1 60); do
  V=$($A shell "su -c 'cat $SENSOR'" 2>/dev/null | tr -d '\r\n ')
  if [ "$V" != "$ANTES" ]; then echo "  $(date +%H:%M:%S)  sensor = $V"; ANTES="$V"; fi
  sleep 0.5
done
echo
echo "Listo. Contale a Claude: cómo se ve y qué tan fluido anda el panel, y qué valores mostró el sensor."
