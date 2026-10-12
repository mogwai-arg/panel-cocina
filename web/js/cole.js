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

  // Conceptos y notas que conviene mirar (regular, malo, insuficiente o menos de 4).
  var CONCEPTOS_BAJOS = /^(R|M|I|D|INS|NS|TED|DESAPROBADO|INSUFICIENTE|REGULAR)$/i;

  function esBaja(ev) {
    if (!ev) return false;
    var n = parseFloat(String(ev.nota).replace(',', '.'));
    if (!isNaN(n)) return n < 4;
    return CONCEPTOS_BAJOS.test(String(ev.concepto || '').trim());
  }

  function esAlta(ev) {
    var n = parseFloat(String(ev && ev.nota || '').replace(',', '.'));
    if (!isNaN(n)) return n >= 8;
    return /^(EXC|EX|MB|S|SOBRESALIENTE|EXCELENTE)$/i.test(String(ev && ev.concepto || '').trim());
  }

  /* Nombre de una materia: del horario (cruzando ids), del título visto, o genérico. */
  function nombreMateria(datos, cal) {
    var indice = (datos && datos.horario && datos.horario._indice) || {};
    if (indice[cal.relId]) return indice[cal.relId];
    if (cal.materiaId && indice[cal.materiaId]) return indice[cal.materiaId];
    var tiny = (datos && datos.tiny) || {};
    for (var numero in tiny) {
      if (tiny[numero] === cal.relId && indice[numero]) return indice[numero];
    }
    return cal.titulo || 'Materia';
  }

  /*
   * Resumen de notas por materia: el período más reciente con notas, sus últimas
   * evaluaciones y si hay alguna baja. Las materias con notas bajas van primero.
   */
  function resumenNotas(datos, cuantas) {
    cuantas = cuantas || 4;
    var cals = (datos && datos.calificaciones) || {};
    return Object.keys(cals).map(function (relId) {
      var cal = cals[relId];
      var periodos = cal.periodos || [];
      var actual = periodos[periodos.length - 1] || null;
      var evals = actual ? actual.evaluaciones : [];
      var ultima = evals[0] && evals[0].fecha || '';
      return {
        relId: relId,
        nombre: nombreMateria(datos, cal),
        periodo: actual ? actual.nombre : '',
        final: actual ? actual.final : null,
        ultimas: evals.slice(0, cuantas),
        alerta: evals.some(esBaja) || esBaja(actual && actual.final),
        ultimaFecha: ultima
      };
    }).sort(function (a, b) {
      if (a.alerta !== b.alerta) return a.alerta ? -1 : 1;
      return a.ultimaFecha < b.ultimaFecha ? 1 : -1;
    });
  }

  var api = {
    esBaja: esBaja,
    esAlta: esAlta,
    nombreMateria: nombreMateria,
    resumenNotas: resumenNotas,
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
