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

  // Conceptos llevados a números para poder comparar (las notas numéricas se usan tal cual).
  var VALOR_CONCEPTO = { EXC: 10, EX: 10, S: 10, SOBRESALIENTE: 10, EXCELENTE: 10, MB: 8.5, B: 7, BUENO: 7,
    R: 5, REGULAR: 5, M: 3, I: 3, INS: 3, INSUFICIENTE: 3, D: 3, NS: 3 };

  function valor(ev) {
    if (!ev) return null;
    var n = parseFloat(String(ev.nota || '').replace(',', '.'));
    if (!isNaN(n)) return n;
    var v = VALOR_CONCEPTO[String(ev.concepto || '').trim().toUpperCase()];
    return v === undefined ? null : v;
  }

  function promedio(evals) {
    var vs = evals.map(valor).filter(function (v) { return v !== null; });
    if (!vs.length) return null;
    return vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
  }

  function hoyIso(ahora) {
    var d = ahora || new Date();
    return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
  }

  /*
   * Id del período en curso: el que Colegium marca como actual, o el que contiene la
   * fecha de hoy. Null si no se sabe (todavía no se pasó por Asistencia).
   */
  function periodoActualId(datos, ahora) {
    var ps = (datos && datos.periodos) || [];
    var marcado = ps.filter(function (p) { return p.actual; })[0];
    if (marcado) return marcado.id;
    var hoy = hoyIso(ahora);
    var enCurso = ps.filter(function (p) { return p.inicio && p.fin && p.inicio <= hoy && hoy <= p.fin; })[0];
    return enCurso ? enCurso.id : null;
  }

  /* Elige el período a mostrar de una materia: el actual; si no se sabe, el de la nota más reciente. */
  function elegirPeriodo(periodos, idActual) {
    if (!periodos.length) return { actual: null, anterior: null };
    var i = -1;
    if (idActual) i = periodos.map(function (p) { return p.id; }).indexOf(idActual);
    if (i < 0) {
      var mejor = '';
      periodos.forEach(function (p, j) {
        var f = (p.evaluaciones[0] && p.evaluaciones[0].fecha) || (p.final && p.final.fecha) || '';
        if (f && f >= mejor) { mejor = f; i = j; }
      });
    }
    if (i < 0) i = periodos.length - 1;
    return { actual: periodos[i], anterior: i > 0 ? periodos[i - 1] : null };
  }

  /* Cómo viene una materia comparada con el período anterior (o dentro del período). */
  function tendencia(actual, anterior) {
    var evals = (actual && actual.evaluaciones) || [];
    var hoy = promedio(evals);
    if (hoy === null) return null;
    var antes = null;
    var contra = '';
    if (anterior) {
      antes = valor(anterior.final);
      if (antes === null) antes = promedio(anterior.evaluaciones);
      contra = anterior.nombre;
    }
    if (antes === null && evals.length >= 4) {
      // Sin período anterior: las 2 más recientes contra las demás.
      antes = promedio(evals.slice(2));
      hoy = promedio(evals.slice(0, 2));
      contra = 'las notas anteriores';
    }
    var dif = antes === null ? 0 : hoy - antes;
    var estado = dif >= 1 ? 'mejora' : dif <= -1 ? 'baja' : hoy >= 8.5 ? 'excelente' : hoy < 6 ? 'atencion' : 'parejo';
    var mensajes = {
      mejora: '¡Viene mejorando respecto de ' + (contra || 'antes') + '! 💪',
      baja: 'Bajó un poco respecto de ' + contra + ': ¡a meterle, que se puede!',
      excelente: 'Sigue excelente 🌟',
      atencion: 'Le está costando: un empujoncito y sale.',
      parejo: 'Viene parejo 👍'
    };
    return { estado: estado, promedio: hoy, anterior: antes, mensaje: mensajes[estado] };
  }

  /*
   * Resumen de notas por materia: el período actual, sus últimas evaluaciones,
   * si hay alguna baja y cómo viene. Las materias con notas bajas van primero.
   */
  function resumenNotas(datos, cuantas, ahora) {
    cuantas = cuantas || 4;
    var cals = (datos && datos.calificaciones) || {};
    var idActual = periodoActualId(datos, ahora);
    return Object.keys(cals).map(function (relId) {
      var cal = cals[relId];
      var p = elegirPeriodo(cal.periodos || [], idActual);
      var evals = p.actual ? p.actual.evaluaciones : [];
      return {
        relId: relId,
        nombre: nombreMateria(datos, cal),
        periodo: p.actual ? p.actual.nombre : '',
        final: p.actual ? p.actual.final : null,
        ultimas: evals.slice(0, cuantas),
        alerta: evals.some(esBaja) || esBaja(p.actual && p.actual.final),
        tendencia: tendencia(p.actual, p.anterior),
        ultimaFecha: (evals[0] && evals[0].fecha) || ''
      };
    }).sort(function (a, b) {
      if (a.alerta !== b.alerta) return a.alerta ? -1 : 1;
      return a.ultimaFecha < b.ultimaFecha ? 1 : -1;
    });
  }

  /* Mensaje general de aliento a partir del resumen por materia. */
  function mensajeGeneral(materias, nombre) {
    var con = materias.filter(function (m) { return m.tendencia; });
    if (!con.length) return null;
    var mejoran = con.filter(function (m) { return m.tendencia.estado === 'mejora'; });
    var bajan = con.filter(function (m) { return m.tendencia.estado === 'baja'; });
    var excelentes = con.filter(function (m) { return m.tendencia.estado === 'excelente'; });
    var quien = nombre ? ', ' + nombre : '';
    var nombres = function (ms) { return ms.map(function (m) { return m.nombre; }).join(', '); };
    if (mejoran.length && !bajan.length) {
      return { tono: 'bien', texto: '¡Muy bien' + quien + '! Mejoraste en ' + nombres(mejoran) + '. Seguí así 🚀' };
    }
    if (mejoran.length && bajan.length) {
      return { tono: 'bien', texto: 'Mejoraste en ' + nombres(mejoran) + ' 💪. Ahora a darle una mano a ' + nombres(bajan) + '.' };
    }
    if (bajan.length) {
      return { tono: 'atencion', texto: 'Algunas materias bajaron un poco (' + nombres(bajan) + '). ¡Todavía hay tiempo para levantarlas' + quien + '!' };
    }
    if (excelentes.length >= con.length / 2) {
      return { tono: 'bien', texto: '¡Excelente cuatrimestre' + quien + '! 🌟' };
    }
    return { tono: 'neutro', texto: 'Viene parejo en todas las materias. ¡Bien' + quien + '!' };
  }

  var api = {
    esBaja: esBaja,
    esAlta: esAlta,
    nombreMateria: nombreMateria,
    resumenNotas: resumenNotas,
    mensajeGeneral: mensajeGeneral,
    tendencia: tendencia,
    periodoActualId: periodoActualId,
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
