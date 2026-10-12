/*
 * Lógica de los mails importantes (sin DOM, con tests).
 * Los datos los arma apps-script/Mails.gs con búsquedas de Gmail.
 */
(function (root) {
  'use strict';

  var CATEGORIAS = {
    salud: { color: '#c4453a', icono: '🩺' },
    cole: { color: '#2e7d6d', icono: '🎒' },
    pagos: { color: '#8a6d1f', icono: '💳' },
    viajes: { color: '#3b7bbf', icono: '✈️' }
  };
  var OTRA = { color: '#6d6b66', icono: '✉️' };
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  function clave(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function categoria(nombre) { return CATEGORIAS[clave(nombre)] || OTRA; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function inicioDelDia(f) { var d = new Date(f.getTime()); d.setHours(0, 0, 0, 0); return d; }

  /* Mails abiertos en el panel (cada aparato recuerda los suyos). */
  var CLAVE_VISTOS = 'panel-mails-vistos';
  function vistos() {
    try { return JSON.parse(root.localStorage.getItem(CLAVE_VISTOS) || '{}') || {}; } catch (e) { return {}; }
  }
  function marcarVistos(ids) {
    var v = vistos();
    ids.forEach(function (id) { v[id] = Date.now(); });
    var corto = {};
    Object.keys(v).sort(function (a, b) { return v[b] - v[a]; }).slice(0, 300).forEach(function (k) { corto[k] = v[k]; });
    try { root.localStorage.setItem(CLAVE_VISTOS, JSON.stringify(corto)); } catch (e) { /* sin almacenamiento */ }
  }

  /* Nuevos: de la última semana y todavía no vistos en el panel. */
  function nuevos(datos, ahora, vistosYa) {
    vistosYa = vistosYa || vistos();
    var desde = new Date(ahora.getTime() - 7 * 86400000).toISOString();
    return ((datos && datos.mails) || []).filter(function (m) { return m.recibido >= desde && !vistosYa[m.id]; });
  }

  /* "Lun 20/10 · 10:30", "Hoy · 10:30", "Mañana" */
  function textoCuando(c, ahora) {
    if (!c) return '';
    var d = new Date(c.fecha);
    var dias = Math.round((inicioDelDia(d) - inicioDelDia(ahora)) / 86400000);
    var dia = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : DIAS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
    return dia + (c.conHora ? ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '');
  }

  /* Los que tienen una fecha por delante, la más cercana primero. */
  function conFecha(datos, ahora) {
    return ((datos && datos.mails) || []).filter(function (m) {
      if (!m.cuando) return false;
      var d = new Date(m.cuando.fecha);
      var fin = m.cuando.conHora ? d : new Date(inicioDelDia(d).getTime() + 86400000);
      return fin > ahora;
    }).sort(function (a, b) { return a.cuando.fecha < b.cuando.fecha ? -1 : 1; });
  }

  /* Para la agenda de Hoy: un evento por mail con fecha (dentro de `dias`). */
  function comoEventos(datos, ahora, calendario, dias) {
    var hasta = new Date(ahora.getTime() + (dias || 14) * 86400000);
    return conFecha(datos, ahora).filter(function (m) { return new Date(m.cuando.fecha) <= hasta; }).map(function (m) {
      var d = new Date(m.cuando.fecha);
      var c = categoria(m.categoria);
      return {
        titulo: c.icono + ' ' + m.asunto,
        inicio: (m.cuando.conHora ? d : inicioDelDia(d)).toISOString(),
        fin: new Date(m.cuando.conHora ? d.getTime() + 30 * 60000 : inicioDelDia(d).getTime() + 86400000).toISOString(),
        todoElDia: !m.cuando.conHora,
        lugar: m.de,
        calendario: calendario,
        color: c.color
      };
    });
  }

  /* Categorías en el orden en que aparecen (para los filtros). */
  function categorias(datos) {
    var vistas = {};
    var out = [];
    ((datos && datos.mails) || []).forEach(function (m) {
      if (!vistas[m.categoria]) { vistas[m.categoria] = true; out.push(m.categoria); }
    });
    return out;
  }

  var api = {
    categoria: categoria, nuevos: nuevos, marcarVistos: marcarVistos, vistos: vistos,
    textoCuando: textoCuando, conFecha: conFecha, comoEventos: comoEventos, categorias: categorias
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mails = api;
})(typeof window !== 'undefined' ? window : this);
