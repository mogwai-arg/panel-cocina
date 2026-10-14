/*
 * Ajustes que se cambian desde la pantalla (⚙️). Se guardan en cada aparato
 * (localStorage); los valores iniciales salen de config.js. Sin DOM, con tests.
 */
(function (root) {
  'use strict';

  var CLAVE = 'panel-ajustes';

  function minutosDe(hhmm) { var p = String(hhmm || '0:0').split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
  function hhmm(min) { min = ((min % 1440) + 1440) % 1440; var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }

  /* Qué se puede ajustar, con su rango. Los valores por defecto salen de config.js. */
  function definicion(config) {
    config = config || {};
    var alt = config.ALTERNAR || {};
    var osc = config.TEMA_OSCURO || {};
    var des = config.DESCANSO || {};
    var noche = des.noche || {};
    var man = config.MANANA_COLE || {};
    return {
      segundosFoto: { tipo: 'numero', min: 5, max: 120, paso: 5, def: config.SEGUNDOS_POR_FOTO || 15 },
      videos: { tipo: 'si', def: true },
      lugarFoto: { tipo: 'si', def: true },
      minutosInactividad: { tipo: 'numero', min: 1, max: 30, paso: 1, def: config.MINUTOS_INACTIVIDAD || 3 },
      alternar: { tipo: 'si', def: alt.activo !== false },
      alternarCada: { tipo: 'numero', min: 2, max: 60, paso: 1, def: alt.cadaMinutos || 10 },
      alternarSegundos: { tipo: 'numero', min: 10, max: 180, paso: 10, def: alt.segundosPanel || 30 },
      oscuro: { tipo: 'si', def: config.TEMA_OSCURO !== false },
      oscuroDesde: { tipo: 'hora', def: osc.desde || '19:30' },
      oscuroHasta: { tipo: 'hora', def: osc.hasta || '07:00' },
      noche: { tipo: 'si', def: des.noche !== false },
      nocheDesde: { tipo: 'hora', def: noche.desde || '23:00' },
      nocheHasta: { tipo: 'hora', def: noche.hasta || '07:00' },
      nocheModo: { tipo: 'opcion', opciones: ['apagado', 'tenue'], def: noche.modo || 'apagado' },
      despiertoMinutos: { tipo: 'numero', min: 1, max: 30, paso: 1, def: des.despiertoMinutos || 5 },
      sensor: { tipo: 'si', def: true },
      sinMovimientoMinutos: { tipo: 'numero', min: 1, max: 120, paso: 1, def: des.sinMovimientoMinutos || 20 },
      sinMovimientoModo: { tipo: 'opcion', opciones: ['tenue', 'apagado'], def: des.sinMovimientoModo || 'tenue' },
      mananaCole: { tipo: 'si', def: config.MANANA_COLE !== false },
      mananaDesde: { tipo: 'hora', paso: 15, def: man.desde || '06:30' },
      viajeMinutos: { tipo: 'numero', min: 0, max: 90, paso: 5, def: man.viajeMinutos !== undefined ? man.viajeMinutos : 20 },
      salidaPorDefecto: { tipo: 'hora', paso: 5, def: man.salida || '07:20' }
    };
  }

  /* Deja un valor dentro de lo permitido (o el de por defecto si no sirve). */
  function validar(d, v) {
    if (d.tipo === 'si') return typeof v === 'boolean' ? v : d.def;
    if (d.tipo === 'numero') {
      var n = Number(v);
      if (!isFinite(n)) return d.def;
      n = Math.round(n / d.paso) * d.paso;
      return Math.max(d.min, Math.min(d.max, n));
    }
    if (d.tipo === 'hora') return /^\d{1,2}:\d{2}$/.test(String(v)) ? hhmm(minutosDe(v)) : d.def;
    if (d.tipo === 'opcion') return d.opciones.indexOf(v) >= 0 ? v : d.def;
    return d.def;
  }

  /* Un paso para arriba o para abajo (botones − / +). Las horas van de a media hora (o de a `paso` minutos). */
  function pasar(d, actual, sentido) {
    if (d.tipo === 'numero') return validar(d, actual + sentido * d.paso);
    if (d.tipo === 'hora') return hhmm(minutosDe(actual) + sentido * (d.paso || 30));
    if (d.tipo === 'opcion') {
      var i = d.opciones.indexOf(actual);
      return d.opciones[(i + sentido + d.opciones.length) % d.opciones.length];
    }
    return !actual;
  }

  function crear(config, almacen) {
    var defs = definicion(config);
    var guardados = {};
    try { guardados = JSON.parse((almacen && almacen.getItem(CLAVE)) || '{}') || {}; } catch (e) { guardados = {}; }
    var valores = {};
    Object.keys(defs).forEach(function (k) {
      valores[k] = guardados[k] === undefined ? defs[k].def : validar(defs[k], guardados[k]);
    });
    var oyentes = [];
    function guardar() {
      try { if (almacen) almacen.setItem(CLAVE, JSON.stringify(valores)); } catch (e) { /* sin almacenamiento */ }
      oyentes.forEach(function (f) { f(valores); });
    }
    return {
      definicion: defs,
      valor: function (k) { return valores[k]; },
      todos: function () { return Object.assign({}, valores); },
      poner: function (k, v) { if (defs[k]) { valores[k] = validar(defs[k], v); guardar(); } return valores[k]; },
      pasar: function (k, sentido) { return this.poner(k, pasar(defs[k], valores[k], sentido)); },
      restablecer: function () {
        Object.keys(defs).forEach(function (k) { valores[k] = defs[k].def; });
        guardar();
      },
      alCambiar: function (f) { oyentes.push(f); },
      // Lo que entiende Manana.plan (ver manana.js), sin el horario
      manana: function () {
        return { activo: valores.mananaCole, desde: valores.mananaDesde,
          viajeMinutos: valores.viajeMinutos, salidaPorDefecto: valores.salidaPorDefecto };
      },
      // Lo que entiende Descanso.estado (ver descanso.js)
      descanso: function () {
        return {
          noche: valores.noche ? { desde: valores.nocheDesde, hasta: valores.nocheHasta, modo: valores.nocheModo } : false,
          despiertoMinutos: valores.despiertoMinutos,
          sinMovimientoMinutos: valores.sinMovimientoMinutos,
          sinMovimientoModo: valores.sinMovimientoModo
        };
      }
    };
  }

  var api = { crear: crear, definicion: definicion, validar: validar, pasar: pasar, hhmm: hhmm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ajustes = api;
})(typeof window !== 'undefined' ? window : this);
