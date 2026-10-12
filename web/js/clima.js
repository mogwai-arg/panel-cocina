/*
 * Clima con Open-Meteo: gratis, sin registrarse y sin clave.
 * La parte de interpretar los datos es pura y tiene tests; la descarga es solo del navegador.
 */
(function (root) {
  'use strict';

  // Códigos WMO que usa Open-Meteo → descripción e ícono.
  function describir(codigo) {
    if (codigo === 0) return { texto: 'Despejado', icono: 'sol' };
    if (codigo === 1) return { texto: 'Mayormente despejado', icono: 'sol' };
    if (codigo === 2) return { texto: 'Parcialmente nublado', icono: 'parcial' };
    if (codigo === 3) return { texto: 'Nublado', icono: 'nube' };
    if (codigo === 45 || codigo === 48) return { texto: 'Niebla', icono: 'niebla' };
    if (codigo >= 51 && codigo <= 57) return { texto: 'Llovizna', icono: 'lluvia' };
    if (codigo >= 61 && codigo <= 67) return { texto: 'Lluvia', icono: 'lluvia' };
    if (codigo >= 80 && codigo <= 82) return { texto: 'Chaparrones', icono: 'lluvia' };
    if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return { texto: 'Nieve', icono: 'nieve' };
    if (codigo >= 95) return { texto: 'Tormenta', icono: 'tormenta' };
    return { texto: '', icono: 'nube' };
  }

  /*
   * Convierte la respuesta de Open-Meteo al formato del panel:
   * { temp, codigo, esDeDia, max, min, horas: [{ hora, temp, codigo, lluvia }] }
   * `horas` son las próximas 12 a partir de la hora actual.
   */
  function normalizar(r, ahora) {
    var h = r.hourly;
    var horaActual = r.current.time.slice(0, 13); // "2026-10-12T15"
    var desde = h.time.findIndex(function (t) { return t.slice(0, 13) === horaActual; });
    if (desde < 0) desde = 0;
    var horas = [];
    for (var i = desde; i < Math.min(desde + 12, h.time.length); i++) {
      horas.push({
        hora: Number(h.time[i].slice(11, 13)),
        temp: Math.round(h.temperature_2m[i]),
        codigo: h.weather_code[i],
        lluvia: h.precipitation_probability ? h.precipitation_probability[i] : 0
      });
    }
    return {
      temp: Math.round(r.current.temperature_2m),
      codigo: r.current.weather_code,
      esDeDia: r.current.is_day !== 0,
      max: Math.round(r.daily.temperature_2m_max[0]),
      min: Math.round(r.daily.temperature_2m_min[0]),
      horas: horas
    };
  }

  /* Una frase útil para las próximas horas. */
  function frase(c) {
    var conLluvia = c.horas.findIndex(function (x) { return x.lluvia >= 50; });
    if (conLluvia === 0) return 'Está lloviendo. Llevá paraguas.';
    if (conLluvia > 0) return 'Lluvia desde las ' + c.horas[conLluvia].hora + ' h. Llevá paraguas.';
    var minima = Math.min.apply(null, c.horas.map(function (x) { return x.temp; }));
    if (minima <= c.temp - 6) return 'Refresca más tarde: baja a ' + minima + '°. Llevá abrigo.';
    if (c.max >= 30) return 'Día caluroso: llega a ' + c.max + '°.';
    return 'Sin lluvia en las próximas horas.';
  }

  function obtener(latitud, longitud) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitud + '&longitude=' + longitud +
      '&current=temperature_2m,weather_code,is_day' +
      '&hourly=temperature_2m,weather_code,precipitation_probability' +
      '&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Open-Meteo respondió ' + r.status);
      return r.json();
    }).then(function (r) { return normalizar(r, new Date()); });
  }

  /* Datos de ejemplo para el modo demo. */
  function ejemplo(ahora) {
    var h0 = ahora.getHours();
    var temps = [18, 19, 18, 17, 16, 15, 14, 13, 13, 12, 12, 11];
    return {
      temp: 18, codigo: 2, esDeDia: h0 >= 7 && h0 < 20, max: 22, min: 11,
      horas: temps.map(function (t, i) {
        return { hora: (h0 + i) % 24, temp: t, codigo: i < 3 ? 2 : 3, lluvia: i === 4 ? 60 : 10 };
      })
    };
  }

  var api = { describir: describir, normalizar: normalizar, frase: frase, obtener: obtener, ejemplo: ejemplo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Clima = api;
})(typeof window !== 'undefined' ? window : this);
