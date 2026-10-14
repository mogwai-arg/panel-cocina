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
   * { temp, codigo, esDeDia, max, min, horas: [{ hora, fecha, temp, codigo, lluvia }],
   *   dias: [{ fecha, max, min, codigo, lluvia, sale, pone }] }
   * `horas` son las próximas 12 a partir de la hora actual; `dias`, los de la semana
   * (sale/pone: amanecer y atardecer, "HH:MM").
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
        fecha: h.time[i].slice(0, 10),
        temp: Math.round(h.temperature_2m[i]),
        codigo: h.weather_code[i],
        lluvia: h.precipitation_probability ? h.precipitation_probability[i] : 0,
        uv: h.uv_index && h.uv_index[i] !== null && h.uv_index[i] !== undefined ? Math.round(h.uv_index[i]) : null
      });
    }
    return {
      temp: Math.round(r.current.temperature_2m),
      codigo: r.current.weather_code,
      esDeDia: r.current.is_day !== 0,
      max: Math.round(r.daily.temperature_2m_max[0]),
      min: Math.round(r.daily.temperature_2m_min[0]),
      horas: horas,
      dias: dias(r.daily),
      uv: horas.length ? horas[0].uv : null,
      uvMax: r.daily.uv_index_max && r.daily.uv_index_max[0] !== null && r.daily.uv_index_max[0] !== undefined
        ? Math.round(r.daily.uv_index_max[0]) : null
    };
  }

  function dias(d) {
    if (!d || !d.time) return [];
    function de(lista, i) { return lista && lista[i] !== undefined && lista[i] !== null ? lista[i] : null; }
    return d.time.map(function (fecha, i) {
      var sale = de(d.sunrise, i), pone = de(d.sunset, i);
      return {
        fecha: fecha,
        max: Math.round(d.temperature_2m_max[i]),
        min: Math.round(d.temperature_2m_min[i]),
        codigo: de(d.weather_code, i),
        lluvia: de(d.precipitation_probability_max, i) || 0,
        uv: de(d.uv_index_max, i) === null ? null : Math.round(d.uv_index_max[i]),
        sale: sale ? String(sale).slice(11, 16) : null,
        pone: pone ? String(pone).slice(11, 16) : null
      };
    });
  }

  /*
   * Puntos para dibujar la curva de temperatura de las próximas horas en un recuadro
   * de ancho × alto: [{ x, y, temp, hora, lluvia }] y las marcas de amanecer/atardecer
   * que caen dentro ({ x, tipo: 'sale'|'pone', hora: 'HH:MM' }).
   */
  function curva(c, ancho, alto, margen) {
    margen = margen || 0;
    var hs = (c && c.horas) || [];
    if (hs.length < 2) return { puntos: [], sol: [] };
    var temps = hs.map(function (h) { return h.temp; });
    var tmax = Math.max.apply(null, temps), tmin = Math.min.apply(null, temps);
    var rango = Math.max(tmax - tmin, 4);
    var paso = (ancho - 2 * margen) / (hs.length - 1);
    var puntos = hs.map(function (h, i) {
      return {
        x: Math.round((margen + i * paso) * 10) / 10,
        y: Math.round((margen + (tmax - h.temp) / rango * (alto - 2 * margen)) * 10) / 10,
        temp: h.temp, hora: h.hora, lluvia: h.lluvia || 0
      };
    });
    var porFecha = {};
    ((c && c.dias) || []).forEach(function (d) { porFecha[d.fecha] = d; });
    var sol = [];
    hs.forEach(function (h, i) {
      var d = porFecha[h.fecha];
      if (!d || i === hs.length - 1) return;
      ['sale', 'pone'].forEach(function (tipo) {
        if (!d[tipo]) return;
        var p = d[tipo].split(':');
        if (Number(p[0]) !== h.hora) return;
        sol.push({ x: Math.round((margen + (i + Number(p[1]) / 60) * paso) * 10) / 10, tipo: tipo, hora: d[tipo] });
      });
    });
    return { puntos: puntos, sol: sol };
  }

  /* Índice UV → { texto, nivel 0..4 } (escala de la OMS). */
  function describirUV(uv) {
    if (uv === null || uv === undefined) return null;
    if (uv <= 2) return { texto: 'bajo', nivel: 0 };
    if (uv <= 5) return { texto: 'moderado', nivel: 1 };
    if (uv <= 7) return { texto: 'alto', nivel: 2 };
    if (uv <= 10) return { texto: 'muy alto', nivel: 3 };
    return { texto: 'extremo', nivel: 4 };
  }

  /* Calidad del aire (índice europeo de Open-Meteo, 0 a 100+) → { texto, nivel 0..5 }. */
  function describirAire(aqi) {
    if (aqi === null || aqi === undefined || isNaN(aqi)) return null;
    var textos = ['bueno', 'aceptable', 'moderado', 'malo', 'muy malo', 'pésimo'];
    var nivel = aqi <= 20 ? 0 : aqi <= 40 ? 1 : aqi <= 60 ? 2 : aqi <= 80 ? 3 : aqi <= 100 ? 4 : 5;
    return { texto: textos[nivel], nivel: nivel };
  }

  /* Una frase útil para las próximas horas. */
  function frase(c) {
    var conLluvia = c.horas.findIndex(function (x) { return x.lluvia >= 50; });
    if (conLluvia === 0) return 'Está lloviendo. Llevá paraguas.';
    if (conLluvia > 0) return 'Lluvia desde las ' + c.horas[conLluvia].hora + ' h. Llevá paraguas.';
    var minima = Math.min.apply(null, c.horas.map(function (x) { return x.temp; }));
    if (minima <= c.temp - 6) return 'Refresca más tarde: baja a ' + minima + '°. Llevá abrigo.';
    if (c.max >= 30) return 'Día caluroso: llega a ' + c.max + '°.';
    var deDia = c.horas.some(function (x) { return x.hora >= 11 && x.hora <= 15; });
    if (c.uvMax >= 8 && deDia) return 'UV ' + describirUV(c.uvMax).texto + ' al mediodía: protector y gorra.';
    return 'Sin lluvia en las próximas horas.';
  }

  function obtener(latitud, longitud) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitud + '&longitude=' + longitud +
      '&current=temperature_2m,weather_code,is_day' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,uv_index' +
      '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max' +
      '&timezone=auto&forecast_days=7';
    var clima = fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Open-Meteo respondió ' + r.status);
      return r.json();
    }).then(function (r) { return normalizar(r, new Date()); });
    // Calidad del aire: aparte y opcional (si falla, el clima se muestra igual).
    var aire = fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + latitud + '&longitude=' + longitud +
      '&current=european_aqi,pm2_5&timezone=auto').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (r) { return r && r.current ? { aqi: r.current.european_aqi, pm25: r.current.pm2_5 } : null; })
      .catch(function () { return null; });
    return Promise.all([clima, aire]).then(function (x) { x[0].aire = x[1]; return x[0]; });
  }

  /* Datos de ejemplo para el modo demo. */
  function ejemplo(ahora) {
    var h0 = ahora.getHours();
    var temps = [18, 19, 18, 17, 16, 15, 14, 13, 13, 12, 12, 11];
    function iso(n) {
      var d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + n);
      return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
    }
    var semana = [[22, 11, 2, 60], [24, 13, 1, 0], [19, 12, 61, 80], [17, 9, 3, 20], [20, 10, 0, 0], [23, 12, 1, 10], [21, 14, 95, 70]];
    return {
      temp: 18, codigo: 2, esDeDia: h0 >= 7 && h0 < 20, max: 22, min: 11, uv: 4, uvMax: 7, aire: { aqi: 18, pm25: 6 },
      horas: temps.map(function (t, i) {
        return { hora: (h0 + i) % 24, fecha: iso(h0 + i >= 24 ? 1 : 0), temp: t, codigo: i < 3 ? 2 : 3, lluvia: i === 4 ? 60 : 10 };
      }),
      dias: semana.map(function (x, i) {
        return { fecha: iso(i), max: x[0], min: x[1], codigo: x[2], lluvia: x[3], uv: 7, sale: '06:5' + i, pone: '19:3' + i };
      })
    };
  }

  var api = { describir: describir, describirUV: describirUV, describirAire: describirAire,
    normalizar: normalizar, curva: curva, frase: frase, obtener: obtener, ejemplo: ejemplo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Clima = api;
})(typeof window !== 'undefined' ? window : this);
