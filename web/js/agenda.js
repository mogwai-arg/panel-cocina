/*
 * Lógica de la agenda del panel "Hoy" (sin DOM, con tests).
 *
 * Un evento es: { titulo, inicio, fin, todoElDia, lugar, calendario, color }
 * con inicio y fin en ISO 8601.
 */
(function (root) {
  'use strict';

  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  function d(x) { return x instanceof Date ? x : new Date(x); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function hora(fecha) {
    var f = d(fecha);
    return pad(f.getHours()) + ':' + pad(f.getMinutes());
  }

  function inicioDelDia(fecha, sumarDias) {
    var f = new Date(d(fecha).getTime());
    f.setHours(0, 0, 0, 0);
    if (sumarDias) f.setDate(f.getDate() + sumarDias);
    return f;
  }

  function etiquetaDia(fecha, ahora) {
    var f = inicioDelDia(fecha).getTime();
    if (f === inicioDelDia(ahora).getTime()) return 'Hoy';
    if (f === inicioDelDia(ahora, 1).getTime()) return 'Mañana';
    var x = d(fecha);
    return DIAS[x.getDay()] + ' ' + x.getDate();
  }

  function porInicio(a, b) { return d(a.inicio) - d(b.inicio); }

  /*
   * El próximo evento con horario (no los de todo el día) que todavía no terminó.
   * Devuelve { evento, enCurso, grande, chico } para la tarjeta "Próximo", o null.
   */
  function proximo(eventos, ahora) {
    ahora = d(ahora);
    var candidatos = eventos.filter(function (e) {
      return !e.todoElDia && d(e.fin) > ahora;
    }).sort(porInicio);
    var e = candidatos[0];
    if (!e) return null;

    var minutos = Math.round((d(e.inicio) - ahora) / 60000);
    if (minutos <= 0) {
      return { evento: e, enCurso: true, grande: 'Ahora', chico: 'HASTA LAS ' + hora(e.fin) };
    }
    if (minutos <= 90) {
      return { evento: e, enCurso: false, grande: String(minutos), chico: 'MIN' };
    }
    return { evento: e, enCurso: false, grande: hora(e.inicio),
             chico: etiquetaDia(e.inicio, ahora).toUpperCase() };
  }

  /*
   * Agrupa por calendario los eventos de hoy y mañana que no terminaron.
   * Devuelve hasta `maxColumnas` columnas, las de más eventos primero.
   */
  function columnas(eventos, ahora, maxColumnas, maxEventos) {
    ahora = d(ahora);
    maxColumnas = maxColumnas || 4;
    maxEventos = maxEventos || 3;
    var limite = inicioDelDia(ahora, 2);
    var grupos = {};
    var orden = [];

    eventos.slice().sort(porInicio).forEach(function (e) {
      if (d(e.fin) <= ahora || d(e.inicio) >= limite) return;
      if (!grupos[e.calendario]) {
        grupos[e.calendario] = { calendario: e.calendario, color: e.color, eventos: [] };
        orden.push(e.calendario);
      }
      grupos[e.calendario].eventos.push(e);
    });

    var cols = orden.map(function (k) { return grupos[k]; });
    cols.sort(function (a, b) { return b.eventos.length - a.eventos.length; });
    return cols.slice(0, maxColumnas).map(function (c) {
      return {
        calendario: c.calendario,
        color: c.color,
        eventos: c.eventos.slice(0, maxEventos),
        mas: Math.max(0, c.eventos.length - maxEventos)
      };
    });
  }

  /* Los próximos eventos a partir de pasado mañana. */
  function proximosDias(eventos, ahora, cantidad) {
    var desde = inicioDelDia(ahora, 2);
    return eventos.filter(function (e) { return d(e.inicio) >= desde; })
      .sort(porInicio).slice(0, cantidad || 5);
  }

  /* Texto corto de horario para un evento dentro de una columna. */
  function cuando(e, ahora) {
    var dia = etiquetaDia(e.inicio, ahora);
    var prefijo = dia === 'Hoy' ? '' : dia + ' ';
    if (e.todoElDia) return prefijo + (prefijo ? '· todo el día' : 'Todo el día');
    return prefijo + hora(e.inicio);
  }

  var api = {
    hora: hora,
    etiquetaDia: etiquetaDia,
    proximo: proximo,
    columnas: columnas,
    proximosDias: proximosDias,
    cuando: cuando
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Agenda = api;
})(typeof window !== 'undefined' ? window : this);
