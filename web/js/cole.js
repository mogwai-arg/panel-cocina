/*
 * Lógica de la pantalla "Cole" con los datos de Colegium (sin DOM, con tests).
 */
(function (root) {
  'use strict';

  var CLAVES = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  var NOMBRES = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function inicioDelDia(f) { var d = new Date(f.getTime()); d.setHours(0, 0, 0, 0); return d; }

  /* "Hoy 14:26", "Ayer", "Lun 5", "7 oct" */
  function fechaCorta(iso, ahora) {
    if (!iso) return '';
    var f = new Date(iso);
    var dias = Math.round((inicioDelDia(ahora) - inicioDelDia(f)) / 86400000);
    var hh = (f.getHours() < 10 ? '0' : '') + f.getHours() + ':' + (f.getMinutes() < 10 ? '0' : '') + f.getMinutes();
    if (dias === 0) return 'Hoy ' + hh;
    if (dias === 1) return 'Ayer';
    if (dias > 1 && dias < 7) return NOMBRES[CLAVES[f.getDay()]].slice(0, 3) + ' ' + f.getDate();
    return f.getDate() + ' ' + MESES[f.getMonth()];
  }

  /*
   * El horario que conviene mostrar: el de hoy si todavía no terminaron las clases;
   * si no, el del próximo día con clases. → { titulo, bloques } o null.
   */
  function horarioParaMostrar(horario, ahora) {
    if (!horario) return null;
    for (var i = 0; i < 7; i++) {
      var d = new Date(ahora.getTime() + i * 86400000);
      var clave = CLAVES[d.getDay()];
      var bloques = (horario[clave] || []).filter(function (b) { return b.materias && b.materias.length; });
      if (!bloques.length) continue;
      if (i === 0) {
        var ultimo = bloques[bloques.length - 1].fin || '23:59';
        var hhmm = (ahora.getHours() < 10 ? '0' : '') + ahora.getHours() + ':' + (ahora.getMinutes() < 10 ? '0' : '') + ahora.getMinutes();
        if (hhmm >= ultimo) continue;
      }
      return { titulo: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : NOMBRES[clave], bloques: bloques };
    }
    return null;
  }

  function sinLeer(datos) {
    return ((datos && datos.comunicados) || []).filter(function (c) { return !c.leido; }).length;
  }

  function detalleDe(datos, id) {
    return ((datos && datos.detalles) || []).filter(function (d) { return d.id === id; })[0] || null;
  }

  /*
   * Faltas que no están justificadas. Ojo: "justificacion: pendiente" es el trámite
   * de la familia y aparece también en faltas que el colegio ya marcó "Justificada".
   */
  function faltasPorJustificar(datos) {
    return ((datos && datos.faltas) || []).filter(function (f) {
      return !/^justificad/i.test(String(f.tipo || '').trim());
    });
  }

  function archivosNuevos(datos) {
    return ((datos && datos.archivos) || []).filter(function (a) { return !a.leido; });
  }

  var api = {
    fechaCorta: fechaCorta,
    horarioParaMostrar: horarioParaMostrar,
    sinLeer: sinLeer,
    detalleDe: detalleDe,
    faltasPorJustificar: faltasPorJustificar,
    archivosNuevos: archivosNuevos
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cole = api;
})(typeof window !== 'undefined' ? window : this);
