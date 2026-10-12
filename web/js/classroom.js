/*
 * Lógica de las tareas de Classroom (sin DOM, con tests).
 * Los datos los manda apps-script-classroom/ (corre en la cuenta de Thi).
 */
(function (root) {
  'use strict';

  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  function inicioDelDia(f) { var d = new Date(f.getTime()); d.setHours(0, 0, 0, 0); return d; }
  function diasEntre(a, b) { return Math.round((inicioDelDia(b) - inicioDelDia(a)) / 86400000); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function hora(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  // Sin hora en Classroom = vence a las 23:59: no hace falta decir la hora.
  function finDelDia(d) { return d.getHours() === 23 && d.getMinutes() === 59; }

  /* Cuándo vence, en palabras, y qué tan urgente es. */
  function cuando(iso, ahora) {
    if (!iso) return { texto: 'Sin fecha', urgencia: 'sin-fecha' };
    var d = new Date(iso);
    var dias = diasEntre(ahora, d);
    var conHora = finDelDia(d) ? '' : ' · ' + hora(d);
    if (d < ahora) {
      if (dias === 0) return { texto: 'Venció hoy' + conHora, urgencia: 'vencida' };
      if (dias === -1) return { texto: 'Venció ayer', urgencia: 'vencida' };
      return { texto: 'Venció el ' + d.getDate() + '/' + (d.getMonth() + 1), urgencia: 'vencida' };
    }
    if (dias === 0) return { texto: 'Hoy' + (conHora || ' · hasta las 23:59'), urgencia: 'hoy' };
    if (dias === 1) return { texto: 'Mañana' + conHora, urgencia: 'manana' };
    if (dias < 7) return { texto: DIAS[d.getDay()] + ' ' + d.getDate() + conHora, urgencia: 'semana' };
    return { texto: d.getDate() + '/' + (d.getMonth() + 1) + conHora, urgencia: 'mas' };
  }

  function porVence(a, b) {
    if (!a.vence && !b.vence) return 0;
    if (!a.vence) return 1;
    if (!b.vence) return -1;
    return a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0;
  }

  /*
   * Para la pantalla: lo que falta entregar (vencidas primero, después por fecha),
   * lo entregado o corregido en los últimos días y los avisos recientes.
   */
  function resumen(datos, ahora, diasRecientes) {
    diasRecientes = diasRecientes || 7;
    var tareas = (datos && datos.tareas) || [];
    var desde = new Date(ahora.getTime() - diasRecientes * 86400000).toISOString();
    var faltan = tareas.filter(function (t) { return t.estado === 'pendiente' || t.estado === 'atrasada'; });
    var atrasadas = faltan.filter(function (t) { return t.estado === 'atrasada'; }).sort(porVence).reverse();
    var pendientes = faltan.filter(function (t) { return t.estado === 'pendiente'; }).sort(porVence);
    var hechas = tareas.filter(function (t) {
      return (t.estado === 'entregada' || t.estado === 'devuelta') && (t.vence || t.creada || '') >= desde;
    }).sort(porVence).reverse();
    var avisos = ((datos && datos.avisos) || []).filter(function (a) { return (a.fecha || '') >= desde; })
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    return { atrasadas: atrasadas, pendientes: pendientes, hechas: hechas, avisos: avisos };
  }

  /* Cuántas hay que entregar ya (vencidas, hoy o mañana): el número de la pestaña. */
  function urgentes(datos, ahora) {
    var r = resumen(datos, ahora);
    return r.atrasadas.length + r.pendientes.filter(function (t) {
      var u = cuando(t.vence, ahora).urgencia;
      return u === 'hoy' || u === 'manana';
    }).length;
  }

  /*
   * Las entregas de los próximos días como eventos de la agenda del panel "Hoy".
   * Las que vencen a las 23:59 van como "todo el día".
   */
  function comoEventos(datos, ahora, calendario, color, dias) {
    dias = dias || 7;
    var hasta = new Date(ahora.getTime() + dias * 86400000);
    return resumen(datos, ahora).pendientes.filter(function (t) {
      return t.vence && new Date(t.vence) <= hasta;
    }).map(function (t) {
      var v = new Date(t.vence);
      var todoElDia = finDelDia(v);
      // Con hora: se muestra a la hora de entrega.
      var inicio = todoElDia ? inicioDelDia(v) : v;
      var fin = todoElDia ? new Date(inicioDelDia(v).getTime() + 86400000) : new Date(v.getTime() + 15 * 60000);
      return {
        titulo: 'Entregar: ' + t.titulo,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        todoElDia: todoElDia,
        lugar: t.curso,
        calendario: calendario,
        color: color
      };
    });
  }

  var api = { cuando: cuando, resumen: resumen, urgentes: urgentes, comoEventos: comoEventos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Classroom = api;
})(typeof window !== 'undefined' ? window : this);
