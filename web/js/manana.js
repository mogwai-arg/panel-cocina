/*
 * Modo "mañana de cole": los días de clase, desde temprano hasta un rato después de
 * la hora de salir, el panel Hoy muestra lo de la mañana (tareas de la mañana, hora de
 * salida con cuenta regresiva, materias del día, qué entregar y qué llevar por el clima).
 * Sin DOM, con tests.
 */
(function (root) {
  'use strict';

  var CLAVES = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  // Después de la hora de salir, la tarjeta sigue un rato ("¡Hora de salir!").
  var MINUTOS_DESPUES = 20;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function minutos(hhmm) {
    var p = String(hhmm || '').split(':');
    if (p.length < 2 || isNaN(Number(p[0]))) return null;
    return Number(p[0]) * 60 + Number(p[1]);
  }
  function hhmm(min) { min = ((min % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function diaIso(f) { return f.getFullYear() + '-' + pad(f.getMonth() + 1) + '-' + pad(f.getDate()); }

  /* Las clases del día (del horario de Colegium), en orden: [{ inicio, fin, materia }]. */
  function clasesDelDia(horario, fecha) {
    if (!horario) return [];
    return (horario[CLAVES[fecha.getDay()]] || []).filter(function (b) {
      return b && b.materias && b.materias.length && minutos(b.inicio) !== null;
    }).map(function (b) {
      return { inicio: b.inicio, fin: b.fin || '', materia: b.materias.join(' / ') };
    }).sort(function (a, b) { return minutos(a.inicio) - minutos(b.inicio); });
  }

  /* ¿Hay cole ese día? Con horario, si tiene clases; sin horario, de lunes a viernes. */
  function hayCole(horario, fecha) {
    var conHorario = horario && CLAVES.some(function (k) { return (horario[k] || []).length; });
    if (conHorario) return clasesDelDia(horario, fecha).length > 0;
    return fecha.getDay() >= 1 && fecha.getDay() <= 5;
  }

  /*
   * El plan de la mañana, o null si ahora no corresponde mostrarlo.
   * op: { activo, horario, desde '06:30', viajeMinutos 20, salidaPorDefecto '07:20', listoEl 'YYYY-MM-DD' }
   * La hora de salir es la primera clase menos el viaje (si hay horario); si no, la de por defecto.
   */
  function plan(ahora, op) {
    op = op || {};
    if (op.activo === false || !hayCole(op.horario, ahora)) return null;
    if (op.listoEl === diaIso(ahora)) return null;
    var clases = clasesDelDia(op.horario, ahora);
    var primera = clases[0] || null;
    var salida = primera
      ? minutos(primera.inicio) - (Number(op.viajeMinutos) || 0)
      : minutos(op.salidaPorDefecto || '07:20');
    var desde = minutos(op.desde || '06:30');
    var m = ahora.getHours() * 60 + ahora.getMinutes();
    if (m < desde || m >= salida + MINUTOS_DESPUES || desde >= salida) return null;
    return {
      salida: hhmm(salida),
      faltan: salida - m,          // minutos (negativo: ya es hora)
      primera: primera,
      clases: clases
    };
  }

  /* "faltan 25 min" / "¡Hora de salir!" */
  function cuentaRegresiva(faltan) {
    if (faltan <= 0) return { grande: '¡YA!', chico: 'HORA DE SALIR', tarde: true };
    if (faltan >= 60) return { grande: Math.floor(faltan / 60) + ':' + pad(faltan % 60), chico: 'PARA SALIR', tarde: false };
    return { grande: String(faltan), chico: 'MIN PARA SALIR', tarde: false };
  }

  /*
   * Qué llevar según el clima de la mañana (de la salida hasta el mediodía).
   * clima: lo de js/clima.js (horas: [{ hora, temp, lluvia }]).
   */
  function consejosClima(clima, salida) {
    if (!clima || !clima.horas || !clima.horas.length) return [];
    var hs = minutos(salida);
    var hSalida = hs === null ? clima.horas[0].hora : Math.floor(hs / 60);
    var manana = clima.horas.filter(function (h) { return h.hora >= hSalida && h.hora <= 14; });
    if (!manana.length) manana = clima.horas.slice(0, 6);
    var alSalir = manana[0].temp;
    var lluvia = Math.max.apply(null, manana.map(function (h) { return h.lluvia || 0; }));
    var maxima = Math.max(clima.max || -99, Math.max.apply(null, manana.map(function (h) { return h.temp; })));
    var lista = [];
    if (lluvia >= 50) lista.push({ icono: '☔', texto: 'Llevá paraguas o campera de lluvia' });
    else if (lluvia >= 30) lista.push({ icono: '🌂', texto: 'Puede llover: paraguas chico por las dudas' });
    if (alSalir <= 10) lista.push({ icono: '🧣', texto: 'Hace frío al salir: ' + alSalir + '°. Bien abrigado' });
    else if (alSalir <= 15) lista.push({ icono: '🧥', texto: 'Fresco al salir: ' + alSalir + '°. Llevá campera' });
    if (maxima >= 28) lista.push({ icono: '💧', texto: 'Llega a ' + maxima + '°: llevá agua' });
    if (!lista.length) lista.push({ icono: '🙂', texto: alSalir + '° al salir. Lindo para ir' });
    return lista;
  }

  /*
   * Lo que hay que tener en cuenta hoy: entregas de Classroom (hoy o mañana a primera hora),
   * pruebas y pendientes que encontró el asistente para hoy.
   * aula: datos de Classroom (tareas: [{ titulo, vence, estado }]); ia: { pendientes, repasos }.
   */
  function paraHoy(aula, ia, ahora) {
    var hoy = diaIso(ahora);
    var manana = diaIso(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1));
    var lista = [];
    ((ia && ia.repasos) || []).forEach(function (r) {
      if (r.fecha === hoy) lista.push({ tipo: 'prueba', texto: 'Hoy: prueba de ' + r.materia });
    });
    ((aula && aula.tareas) || []).forEach(function (t) {
      if (t.estado !== 'pendiente' && t.estado !== 'atrasada') return;
      if (!t.vence) return;
      var dia = diaIso(new Date(t.vence));
      if (t.estado === 'atrasada') lista.push({ tipo: 'atrasada', texto: 'Atrasada: ' + t.titulo });
      else if (dia === hoy) lista.push({ tipo: 'entrega', texto: 'Entregar hoy: ' + t.titulo });
      else if (dia === manana) lista.push({ tipo: 'entrega', texto: 'Para mañana: ' + t.titulo });
    });
    ((ia && ia.pendientes) || []).forEach(function (p) {
      if (p.para === hoy) lista.push({ tipo: 'pendiente', texto: p.texto });
    });
    return lista;
  }

  /* Las tareas de la mañana de una persona (de la planilla de Tareas). */
  function tareasDeLaManana(tareas, persona, ahora, tocaHoy) {
    var p = String(persona || '').toLowerCase().trim();
    return (tareas || []).filter(function (t) {
      return String(t.persona || '').toLowerCase().trim() === p &&
        String(t.momento || '').toLowerCase().replace('ñ', 'n') === 'manana' &&
        (!tocaHoy || tocaHoy(t, ahora));
    });
  }

  var api = {
    clasesDelDia: clasesDelDia, hayCole: hayCole, plan: plan, cuentaRegresiva: cuentaRegresiva,
    consejosClima: consejosClima, paraHoy: paraHoy, tareasDeLaManana: tareasDeLaManana,
    diaIso: diaIso, MINUTOS_DESPUES: MINUTOS_DESPUES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Manana = api;
})(typeof window !== 'undefined' ? window : this);
