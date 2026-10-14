/*
 * Menú de la semana (hoja "Menú" de la planilla de Listas). Sin DOM, con tests.
 *
 * Cada fila: { dia, cena, ingredientes, receta }
 *   dia: una fecha ("2026-10-16") o un día de la semana ("lun", "martes", "mié") que se repite.
 *   ingredientes: separados por coma. receta: un link (se muestra como QR para el celular).
 * Si un día tiene fila con fecha, gana sobre la del día de la semana.
 */
(function (root) {
  'use strict';

  var DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  // A partir de esta hora se muestra la cena de mañana.
  var HORA_MANANA = 21;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(f) { return f.getFullYear() + '-' + pad(f.getMonth() + 1) + '-' + pad(f.getDate()); }
  function normal(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

  function ingredientes(texto) {
    if (Array.isArray(texto)) return texto.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(texto || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* La cena de un día, o null. */
  function delDia(filas, fecha) {
    var clave = iso(fecha), semana = DIAS[fecha.getDay()];
    var conFecha = null, deSemana = null;
    (filas || []).forEach(function (f) {
      if (!f || !String(f.cena || '').trim()) return;
      var d = normal(f.dia);
      if (d.slice(0, 10) === clave) conFecha = f;
      else if (d && d.slice(0, 3) === semana && !/\d/.test(d)) deSemana = f;
    });
    var f = conFecha || deSemana;
    if (!f) return null;
    return { fecha: clave, cena: String(f.cena).trim(), ingredientes: ingredientes(f.ingredientes),
      receta: /^https?:\/\//.test(String(f.receta || '').trim()) ? String(f.receta).trim() : '' };
  }

  /* Lo que se muestra en Hoy: la cena de esta noche (o la de mañana, ya tarde). */
  function paraMostrar(filas, ahora) {
    var manana = ahora.getHours() >= HORA_MANANA;
    var fecha = manana ? new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1) : ahora;
    var m = delDia(filas, fecha);
    if (!m) return null;
    m.titulo = manana ? 'Mañana' : 'Esta noche';
    return m;
  }

  /* Los ingredientes que todavía no están en la lista de compras (sin comprar). */
  function faltanEnCompras(lista, compras) {
    var ya = {};
    (compras || []).forEach(function (c) { if (!c.comprado) ya[normal(c.item)] = true; });
    return (lista || []).filter(function (i) { return !ya[normal(i)]; });
  }

  var api = { delDia: delDia, paraMostrar: paraMostrar, faltanEnCompras: faltanEnCompras, ingredientes: ingredientes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Menu = api;
})(typeof window !== 'undefined' ? window : this);
