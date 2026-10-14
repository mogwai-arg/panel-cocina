/**
 * Agentes: lo que el panel hace solo, sin que nadie lo pida, y el registro de lo que hizo.
 *
 * Agente "Calendario": cada hora pasa a un calendario de Google "Familia · automático":
 *   - turnos y vencimientos detectados en los mails (Mails.gs),
 *   - entregas de Classroom de Thi (y las borra cuando las entrega),
 *   - eventos que publica el colegio en Colegium,
 *   - fechas que encontró el asistente con IA en los comunicados (IA.gs).
 * Así llegan al celular con los avisos de Google Calendar. El panel no muestra ese
 * calendario (ya muestra todo eso por su cuenta): es para los teléfonos.
 *
 * Registro: hoja "Registro" de la planilla (fecha, agente, texto). El panel la muestra
 * en la pantalla Agentes.
 *
 *   ?action=agentes&token=...  → { registro: [{ fecha, agente, texto }], calendario, ultimaCorrida }
 *
 * Una vez: ejecutá `activarAgentes` (crea el calendario y lo corre cada hora).
 */

var NOMBRE_AGENDA_AUTO_ = 'Familia · automático';
var DIAS_AGENDA_AUTO_ = 60;

/* ---------- Registro ---------- */

function hojaRegistro_() {
  var libro = planilla_();
  var hoja = libro.getSheetByName('Registro');
  if (hoja) return hoja;
  hoja = libro.insertSheet('Registro');
  hoja.getRange(1, 1, 1, 3).setValues([['fecha', 'agente', 'texto']]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.setColumnWidth(3, 600);
  return hoja;
}

function registrar_(agente, texto) {
  try {
    var hoja = hojaRegistro_();
    hoja.insertRowAfter(1);
    hoja.getRange(2, 1, 1, 3).setValues([[new Date(), agente, texto]]);
    if (hoja.getLastRow() > 301) hoja.deleteRows(302, hoja.getLastRow() - 301);
  } catch (e) { Logger.log('No se pudo anotar en el registro: ' + e.message); }
}

function agentes_() {
  var filas = hojaRegistro_().getDataRange().getValues().slice(1, 61);
  var props = PropertiesService.getScriptProperties();
  return {
    registro: filas.filter(function (f) { return f[0]; }).map(function (f) {
      return { fecha: new Date(f[0]).toISOString(), agente: String(f[1]), texto: String(f[2]) };
    }),
    calendario: props.getProperty('AGENDA_AUTO_ID') ? NOMBRE_AGENDA_AUTO_ : null,
    ia: props.getProperty('GEMINI_API_KEY') ? { generado: props.getProperty('IA_RECIBIDO') } : null,
    ultimaCorrida: props.getProperty('AGENTES_ULTIMA_CORRIDA')
  };
}

/* ---------- Agente Calendario ---------- */

/** "2026-10-15 08:00", "2026-10-15T08:00:00", "15/10/2026 08:00", "15/10/2026" → { fecha, conHora } */
function parsearFecha_(s) {
  s = String(s || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  var d, conHora;
  if (m) {
    conHora = m[4] !== undefined;
    d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
  } else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    conHora = m[4] !== undefined;
    d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
  }
  if (isNaN(d)) return null;
  if (conHora && d.getHours() === 0 && d.getMinutes() === 0) conHora = false; // 00:00 = sin hora
  return { fecha: d, conHora: conHora };
}

function diaSiguiente_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/*
 * Qué tiene que haber en el calendario automático, a partir de los mails, Classroom y
 * Colegium. Puro (sin servicios) para los tests. Devuelve { eventos, borrar }:
 * `borrar` son claves de entregas que Thi ya hizo (su evento se saca).
 */
function eventosAutomaticos_(mails, aula, cole, ahora, ia) {
  var hasta = new Date(ahora.getTime() + DIAS_AGENDA_AUTO_ * 86400000);
  var eventos = [];
  var borrar = [];
  function agregar(ev) {
    var fin = ev.todoElDia ? diaSiguiente_(ev.inicio) : ev.fin;
    if (fin < ahora || ev.inicio > hasta) return;
    eventos.push(ev);
  }

  ((mails && mails.mails) || []).forEach(function (m) {
    if (!m.cuando) return;
    var inicio = new Date(m.cuando.fecha);
    agregar({
      clave: 'mail:' + m.id, agente: 'Mails',
      titulo: m.asunto, inicio: inicio,
      fin: new Date(inicio.getTime() + 60 * 60000), todoElDia: !m.cuando.conHora,
      lugar: '', descripcion: 'Detectado en un mail de ' + m.de + (m.cuenta === 'Thi' ? ' (para Thi)' : '') +
        '.\n' + (m.resumen || '') + (m.link ? '\n' + m.link : '')
    });
  });

  ((aula && aula.tareas) || []).forEach(function (t) {
    if (!t.vence) return;
    var clave = 'aula:' + t.id;
    if (t.estado === 'entregada' || t.estado === 'devuelta') { borrar.push(clave); return; }
    var v = new Date(t.vence);
    var finDelDia = v.getHours() === 23 && v.getMinutes() === 59;
    agregar({
      clave: clave, agente: 'Classroom',
      titulo: '📚 Entregar: ' + t.titulo, inicio: finDelDia ? new Date(v.getFullYear(), v.getMonth(), v.getDate()) : v,
      fin: new Date(v.getTime() + 15 * 60000), todoElDia: finDelDia,
      lugar: t.curso || '', descripcion: 'Tarea de Classroom de Thi' + (t.curso ? ' (' + t.curso + ')' : '') + '.' +
        (t.link ? '\n' + t.link : '')
    });
  });

  ((cole && cole.eventos) || []).forEach(function (e, i) {
    var p = parsearFecha_(e.inicio);
    if (!p || !e.titulo) return;
    var f = parsearFecha_(e.fin);
    agregar({
      clave: 'cole:' + (e.id || (e.titulo + '|' + e.inicio)), agente: 'Colegio',
      titulo: '🎒 ' + e.titulo, inicio: p.fecha,
      fin: f && f.conHora ? f.fecha : new Date(p.fecha.getTime() + 60 * 60000), todoElDia: !p.conHora,
      lugar: '', descripcion: 'Evento del colegio publicado en Colegium' + (e.categoria ? ' (' + e.categoria + ')' : '') + '.'
    });
  });
  // Fechas que encontró la IA en los comunicados (las que ya trae Colegium como evento no se repiten).
  var diasCole = {};
  eventos.forEach(function (e) { if (e.agente === 'Colegio') diasCole[e.inicio.toDateString()] = true; });
  ((ia && ia.fechas) || []).forEach(function (f) {
    var p = parsearFecha_(f.fecha + (f.hora ? ' ' + f.hora : ''));
    if (!p) return;
    if (diasCole[p.fecha.toDateString()]) return;
    agregar({
      clave: 'ia:' + f.fecha + '|' + String(f.titulo).toLowerCase(), agente: 'IA',
      titulo: '🎒 ' + f.titulo, inicio: p.fecha,
      fin: new Date(p.fecha.getTime() + 60 * 60000), todoElDia: !p.conHora,
      lugar: '', descripcion: (f.detalle ? f.detalle + '\n' : '') + 'Lo encontró el asistente en los comunicados del cole.'
    });
  });
  return { eventos: eventos, borrar: borrar };
}

function agendaAutomatica_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('AGENDA_AUTO_ID');
  var cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    cal = CalendarApp.createCalendar(NOMBRE_AGENDA_AUTO_, { color: CalendarApp.Color.TEAL });
    props.setProperty('AGENDA_AUTO_ID', cal.getId());
    registrar_('Calendario', 'Creé el calendario "' + NOMBRE_AGENDA_AUTO_ + '" en tu Google Calendar.');
  }
  return cal;
}

/** Lo que corre cada hora. */
function sincronizarAgentes() {
  var ahora = new Date();
  var cal = agendaAutomatica_();
  var mails = null, aula = null, cole = null;
  try { mails = mails_(); } catch (e) { Logger.log('Mails: ' + e.message); }
  try { aula = leerClassroom_().datos; } catch (e) { Logger.log('Classroom: ' + e.message); }
  try { cole = leerColegium_().datos; } catch (e) { Logger.log('Colegium: ' + e.message); }
  var ia = null;
  try { ia = leerJson_('IA', 'IA_RECIBIDO').datos; } catch (e) { Logger.log('IA: ' + e.message); }
  var plan = eventosAutomaticos_(mails, aula, cole, ahora, ia);

  var existentes = {};
  cal.getEvents(new Date(ahora.getTime() - 86400000), new Date(ahora.getTime() + (DIAS_AGENDA_AUTO_ + 1) * 86400000))
    .forEach(function (e) { var c = e.getTag('auto'); if (c) existentes[c] = e; });

  var creados = 0, cambiados = 0, borrados = 0;
  plan.eventos.forEach(function (ev) {
    var e = existentes[ev.clave];
    var cuando = ev.todoElDia
      ? Utilities.formatDate(ev.inicio, 'America/Argentina/Buenos_Aires', "EEE d/M")
      : Utilities.formatDate(ev.inicio, 'America/Argentina/Buenos_Aires', "EEE d/M 'a las' HH:mm");
    if (!e) {
      e = ev.todoElDia
        ? cal.createAllDayEvent(ev.titulo, ev.inicio, { description: ev.descripcion, location: ev.lugar })
        : cal.createEvent(ev.titulo, ev.inicio, ev.fin, { description: ev.descripcion, location: ev.lugar });
      e.setTag('auto', ev.clave);
      creados++;
      registrar_(ev.agente, 'Agendé "' + ev.titulo + '" para el ' + cuando + '.');
      return;
    }
    var antes = e.isAllDayEvent() ? 'dia' : e.getStartTime().getTime();
    var ahoraEs = ev.todoElDia ? 'dia' : ev.inicio.getTime();
    if (e.getTitle() !== ev.titulo || antes !== ahoraEs ||
        (ev.todoElDia && e.getAllDayStartDate().getTime() !== ev.inicio.getTime())) {
      e.setTitle(ev.titulo);
      if (ev.todoElDia) e.setAllDayDate(ev.inicio); else e.setTime(ev.inicio, ev.fin);
      cambiados++;
      registrar_(ev.agente, 'Actualicé "' + ev.titulo + '": ahora es el ' + cuando + '.');
    }
  });
  plan.borrar.forEach(function (clave) {
    var e = existentes[clave];
    if (!e) return;
    registrar_('Classroom', 'Thi entregó "' + e.getTitle().replace(/^📚 Entregar: /, '') + '": lo saqué del calendario.');
    e.deleteEvent();
    borrados++;
  });
  PropertiesService.getScriptProperties().setProperty('AGENTES_ULTIMA_CORRIDA', ahora.toISOString());
  Logger.log('Calendario automático: ' + creados + ' nuevos, ' + cambiados + ' actualizados, ' + borrados + ' sacados.');
}

/** Ejecutar una vez: crea el calendario automático y lo actualiza cada hora. */
function activarAgentes() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarAgentes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizarAgentes').timeBased().everyHours(1).create();
  sincronizarAgentes();
  Logger.log('Listo: los agentes corren cada hora. Mirá el calendario "' + NOMBRE_AGENDA_AUTO_ + '".');
}
