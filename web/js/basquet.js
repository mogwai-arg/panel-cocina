/*
 * Lógica de la tarjeta de básquet (sin DOM, con tests).
 *
 * Un partido es: { fecha, cancha, local: { nombre, escudo, puntos }, visitante: {...} }
 * con puntos = null si todavía no se jugó.
 */
(function (root) {
  'use strict';

  var MINUSCULAS = { DE: 'de', DEL: 'del', LA: 'la', LAS: 'las', LOS: 'los', Y: 'y', EL: 'el' };

  /* "ARGENTINO DE CASTELAR NORTE A" → "Argentino de Castelar Norte A" */
  function nombreLindo(s) {
    return String(s || '').trim().split(/\s+/).map(function (p, i) {
      var may = p.toUpperCase();
      if (i > 0 && MINUSCULAS[may]) return MINUSCULAS[may];
      if (p.length <= 2 && /^[A-Z0-9]+$/.test(may)) return may; // "A", "B", "LFF"...
      return may.charAt(0) + may.slice(1).toLowerCase();
    }).join(' ');
  }

  function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function jugado(p) {
    return p.local.puntos !== null && p.visitante.puntos !== null;
  }

  /* El partido visto desde nuestro equipo. */
  function desdeEquipo(p, equipo) {
    var esLocal = normalizar(p.local.nombre) === normalizar(equipo);
    var propio = esLocal ? p.local : p.visitante;
    var rival = esLocal ? p.visitante : p.local;
    return {
      fecha: p.fecha,
      cancha: p.cancha,
      esLocal: esLocal,
      propio: propio,
      rival: rival,
      jugado: jugado(p),
      gano: jugado(p) ? propio.puntos > rival.puntos : null
    };
  }

  /*
   * Resume los partidos: el próximo, el último resultado y la racha de los
   * últimos 5 (de más viejo a más nuevo, true = ganado).
   */
  function resumen(datos, ahora) {
    ahora = ahora instanceof Date ? ahora : new Date(ahora);
    var equipo = datos.equipo;
    var partidos = (datos.partidos || []).slice().sort(function (a, b) {
      return new Date(a.fecha) - new Date(b.fecha);
    });
    // Un partido sin resultado sigue siendo "el próximo" hasta 2 horas después de empezar.
    var proximo = partidos.filter(function (p) {
      return !jugado(p) && new Date(p.fecha).getTime() + 2 * 3600000 > ahora.getTime();
    })[0];
    var jugados = partidos.filter(jugado);
    var ultimo = jugados[jugados.length - 1];
    return {
      equipo: equipo,
      proximo: proximo ? desdeEquipo(proximo, equipo) : null,
      ultimo: ultimo ? desdeEquipo(ultimo, equipo) : null,
      racha: jugados.slice(-5).map(function (p) { return desdeEquipo(p, equipo).gano; })
    };
  }

  /* Partidos por jugar como eventos de la agenda, para que aparezcan en "Próximo". */
  function comoEventos(datos, ahora, calendario, color) {
    var r = [];
    (datos.partidos || []).forEach(function (p) {
      if (jugado(p)) return;
      var v = desdeEquipo(p, datos.equipo);
      var inicio = new Date(p.fecha);
      if (inicio.getTime() + 2 * 3600000 < ahora.getTime()) return;
      r.push({
        titulo: 'Básquet vs ' + nombreLindo(v.rival.nombre),
        inicio: inicio.toISOString(),
        fin: new Date(inicio.getTime() + 2 * 3600000).toISOString(),
        todoElDia: false,
        lugar: p.cancha + (v.esLocal ? ' (local)' : ''),
        calendario: calendario,
        color: color
      });
    });
    return r;
  }

  var api = { nombreLindo: nombreLindo, resumen: resumen, comoEventos: comoEventos, desdeEquipo: desdeEquipo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Basquet = api;
})(typeof window !== 'undefined' ? window : this);
