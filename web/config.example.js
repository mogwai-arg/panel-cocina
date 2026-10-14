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
  },
  // Partidos de básquet (el equipo se configura en las propiedades del Apps Script).
  // Los partidos por jugar también aparecen en la agenda, en la columna `calendario`.
  BASQUET: { calendario: 'Thi', color: '#d39b1e' },
  // Color de cada persona en Tareas (el nombre como figura en la columna "persona" de la planilla)
  PERSONAS: { Thi: '#d39b1e', Javi: '#2f5fd0', Dan: '#7b4fc4' },
  // Cómo se lo nombra a Thiago en los mensajes de aliento de las notas
  APODO_ALUMNO: 'Thi',
  // Alternar: con fotos un rato, muestra el panel Hoy unos segundos y vuelve a las fotos.
  // También se prende/apaga desde la pantalla (tocando la hora de la barra lateral).
  ALTERNAR: { activo: true, cadaMinutos: 10, segundosPanel: 30 },
  // Tema oscuro de noche (también se prende/apaga desde Ajustes). false = nunca.
  TEMA_OSCURO: { desde: '19:30', hasta: '07:00' },
  // Descanso de la pantalla: de noche queda negra ('apagado') o tenue ('tenue'); al tocarla
  // se despierta 5 minutos. Con el sensor de movimiento conectado, de día se atenúa si no
  // pasa nadie en 20 minutos. Para no usar el horario nocturno: noche: false
  // Mañana de cole: los días de clase muestra la hora de salir y lo de la mañana de Thi.
  // La salida es la primera clase (horario de Colegium) menos el viaje. false = apagada.
  // minutosPorEstrella: premio de la búsqueda de la mañana (cada tarea vale sus estrellas).
  MANANA_COLE: { desde: '06:30', viajeMinutos: 20, salida: '07:20', minutosPorEstrella: 5 },
  // Wi-Fi de invitados: el panel muestra un QR para conectarse con la cámara del celular.
  // (config.js no se sube a GitHub, así que la clave queda solo en tu compu y en el marco.)
  WIFI_INVITADOS: { red: 'Casa-Invitados', clave: 'la-clave-de-invitados', tipo: 'WPA' },
  DESCANSO: { noche: { desde: '23:00', hasta: '07:00', modo: 'apagado' }, despiertoMinutos: 5, sinMovimientoMinutos: 20 }
};
