// Copiá este archivo como config.js y completalo. config.js no se sube al repo.
window.CONFIG = {
  // URL de la implementación web del Apps Script (termina en /exec)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  // El mismo valor que pusiste en la propiedad TOKEN del Apps Script
  TOKEN: 'una-clave-larga-y-secreta',
  SEGUNDOS_POR_FOTO: 15,
  // Ancho en píxeles con el que se piden las fotos a Drive (el marco es de 1280)
  ANCHO_FOTO: 1600,
  // Ubicación para el clima (por defecto, Buenos Aires). Se saca de Google Maps:
  // clic derecho sobre tu casa → el primer número es la latitud, el segundo la longitud.
  LATITUD: -34.6037,
  LONGITUD: -58.3816,
  // Minutos sin tocar la pantalla hasta que vuelve a las fotos
  MINUTOS_INACTIVIDAD: 3,
  // Nombres cortos para los calendarios (a la izquierda, el nombre como figura en Google Calendar)
  NOMBRES_CALENDARIOS: {
    'tu-mail@gmail.com': 'Javi',
    'Festivos en Argentina': 'Feriados'
  }
};
