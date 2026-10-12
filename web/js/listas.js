/*
 * Lógica de Tareas y Compras (sin DOM, con tests).
 *
 * tarea  = { id, tarea, persona, momento ('Mañana'|'Tarde'|'Noche'|''), estrellas,
 *            dias ('lun,mié,vie' o vacío = todos), hecha }
 * compra = { id, item, cantidad, categoria, comprado }
 */
(function (root) {
  'use strict';

  var MOMENTOS = ['Mañana', 'Tarde', 'Noche'];
  var DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

  function sinAcentos(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function momentoActual(fecha) {
    var h = fecha.getHours();
    if (h < 12) return 'Mañana';
    if (h < 19) return 'Tarde';
    return 'Noche';
  }

  /* ¿Le toca hoy? Vacío = todos los días. Acepta "lun,mié" o "lunes, miércoles". */
  function tocaHoy(tarea, fecha) {
    var dias = sinAcentos(tarea.dias);
    if (!dias) return true;
    var hoy = DIAS[fecha.getDay()];
    return dias.split(/[\s,;]+/).some(function (d) { return d.slice(0, 3) === hoy; });
  }

  function delMomento(tarea, momento) {
    return !momento || !tarea.momento || sinAcentos(tarea.momento) === sinAcentos(momento);
  }

  /*
   * Columnas de la vista Tareas: una por persona, con las tareas que tocan hoy
   * en ese momento del día. "Cualquiera" va última.
   */
  function columnasDeTareas(tareas, fecha, momento) {
    var grupos = {};
    var orden = [];
    tareas.forEach(function (t) {
      if (!tocaHoy(t, fecha) || !delMomento(t, momento)) return;
      if (!grupos[t.persona]) { grupos[t.persona] = []; orden.push(t.persona); }
      grupos[t.persona].push(t);
    });
    orden.sort(function (a, b) {
      var ca = sinAcentos(a) === 'cualquiera', cb = sinAcentos(b) === 'cualquiera';
      return ca === cb ? 0 : ca ? 1 : -1;
    });
    return orden.map(function (p) {
      var lista = grupos[p];
      return {
        persona: p,
        tareas: lista,
        hechas: lista.filter(function (t) { return t.hecha; }).length,
        total: lista.length
      };
    });
  }

  /* Progreso del día por persona (todas las tareas de hoy), para el panel Hoy. */
  function progresoDelDia(tareas, fecha) {
    return columnasDeTareas(tareas, fecha, null).map(function (c) {
      return { persona: c.persona, hechas: c.hechas, total: c.total };
    });
  }

  /* Compras agrupadas por categoría, con las pendientes primero en cada grupo. */
  function comprasPorCategoria(compras) {
    var grupos = {};
    var orden = [];
    compras.forEach(function (c) {
      var cat = c.categoria || 'Otros';
      if (!grupos[cat]) { grupos[cat] = []; orden.push(cat); }
      grupos[cat].push(c);
    });
    orden.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    return orden.map(function (cat) {
      var items = grupos[cat].slice().sort(function (a, b) {
        if (a.comprado !== b.comprado) return a.comprado ? 1 : -1;
        return a.item.localeCompare(b.item, 'es');
      });
      return { categoria: cat, items: items };
    });
  }

  function pendientes(compras) {
    return compras.filter(function (c) { return !c.comprado; });
  }

  /* Habituales, marcando los que ya están en la lista sin comprar. */
  function habitualesConEstado(habituales, compras) {
    var enLista = {};
    pendientes(compras).forEach(function (c) { enLista[sinAcentos(c.item)] = c.cantidad; });
    return habituales.map(function (h) {
      var cant = enLista[sinAcentos(h.item)];
      return { item: h.item, categoria: h.categoria, enLista: !!cant, cantidad: cant || 0 };
    });
  }

  var api = {
    MOMENTOS: MOMENTOS,
    momentoActual: momentoActual,
    tocaHoy: tocaHoy,
    columnasDeTareas: columnasDeTareas,
    progresoDelDia: progresoDelDia,
    comprasPorCategoria: comprasPorCategoria,
    pendientes: pendientes,
    habitualesConEstado: habitualesConEstado
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Listas = api;
})(typeof window !== 'undefined' ? window : this);
