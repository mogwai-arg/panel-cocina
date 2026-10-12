/**
 * Panel de Cocina · Classroom de Thi.
 *
 * Este proyecto va en la CUENTA DE GMAIL DE THI (la que usa para Classroom), no en
 * la tuya. Lee sus materias, tareas (con fecha de entrega y si las entregó) y
 * avisos de los profes, y se los manda al Apps Script del panel cada hora.
 * Solo lee: no entrega, no comenta, no marca nada.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   PANEL_URL   la URL /exec del Apps Script del panel (la misma de config.js)
 *   TOKEN       el mismo TOKEN del panel
 *
 * Una vez: ejecutá `probarClassroom` (pide permisos y muestra lo que encontró)
 * y después `activarClassroom` (lo manda solo cada hora).
 */

var DIAS_ATRAS = 45;          // tareas entregadas/vencidas que se muestran
var TAREAS_POR_MATERIA = 25;
var AVISOS_POR_MATERIA = 5;

function leerClassroom_() {
  var ahora = new Date();
  var desde = new Date(ahora.getTime() - DIAS_ATRAS * 86400000);
  var cursos = listarTodo_(function (token) {
    return Classroom.Courses.list({ studentId: 'me', courseStates: ['ACTIVE'], pageSize: 50, pageToken: token });
  }, 'courses');

  var datos = { actualizado: ahora.toISOString(), cursos: [], tareas: [], avisos: [] };
  cursos.forEach(function (c) {
    var curso = { id: c.id, nombre: c.name || '', seccion: c.section || '' };
    datos.cursos.push(curso);

    var trabajos = [];
    try {
      trabajos = (Classroom.Courses.CourseWork.list(c.id, { orderBy: 'updateTime desc', pageSize: TAREAS_POR_MATERIA }).courseWork) || [];
    } catch (e) { Logger.log('No se pudieron leer las tareas de ' + c.name + ': ' + e.message); }
    var entregas = {};
    try {
      listarTodo_(function (token) {
        return Classroom.Courses.CourseWork.StudentSubmissions.list(c.id, '-', { userId: 'me', pageSize: 100, pageToken: token });
      }, 'studentSubmissions').forEach(function (s) { entregas[s.courseWorkId] = s; });
    } catch (e) { Logger.log('No se pudieron leer las entregas de ' + c.name + ': ' + e.message); }

    trabajos.forEach(function (w) {
      var t = tareaDe_(w, entregas[w.id], curso, ahora);
      var fecha = t.vence || t.creada;
      if (t.estado === 'pendiente' || t.estado === 'atrasada' || (fecha && new Date(fecha) >= desde)) datos.tareas.push(t);
    });

    try {
      ((Classroom.Courses.Announcements.list(c.id, { orderBy: 'updateTime desc', pageSize: AVISOS_POR_MATERIA }).announcements) || [])
        .forEach(function (a) {
          if (new Date(a.updateTime || a.creationTime) < desde) return;
          datos.avisos.push({
            id: a.id, curso: curso.nombre, texto: corto_(a.text, 600),
            fecha: a.updateTime || a.creationTime, link: a.alternateLink || ''
          });
        });
    } catch (e) { Logger.log('No se pudieron leer los avisos de ' + c.name + ': ' + e.message); }
  });
  return datos;
}

/*
 * Estado de una tarea para el panel:
 *   entregada · devuelta (corregida, con nota si hay) · pendiente · atrasada
 * Classroom guarda la fecha y hora de entrega en UTC; sin hora, vence a las 23:59 de acá.
 */
function tareaDe_(w, s, curso, ahora) {
  var vence = null;
  if (w.dueDate) {
    var d = w.dueDate;
    vence = w.dueTime
      ? new Date(Date.UTC(d.year, d.month - 1, d.day, w.dueTime.hours || 0, w.dueTime.minutes || 0))
      : new Date(Date.UTC(d.year, d.month - 1, d.day, 26, 59)); // 23:59 en Argentina (UTC-3)
  }
  var estadoClassroom = s ? s.state : 'NEW';
  var estado;
  if (estadoClassroom === 'RETURNED') estado = 'devuelta';
  else if (estadoClassroom === 'TURNED_IN') estado = 'entregada';
  else estado = vence && vence < ahora ? 'atrasada' : 'pendiente';
  var nota = s && (s.assignedGrade !== undefined ? s.assignedGrade : null);
  return {
    id: w.id,
    curso: curso.nombre,
    titulo: corto_(w.title, 140),
    descripcion: corto_(w.description, 400),
    vence: vence ? vence.toISOString() : null,
    creada: w.creationTime || null,
    estado: estado,
    tarde: !!(s && s.late),
    nota: nota === null || nota === undefined ? null : nota,
    notaMax: w.maxPoints || null,
    link: w.alternateLink || ''
  };
}

function corto_(t, n) {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function listarTodo_(pedir, campo) {
  var out = [];
  var token = null;
  do {
    var r = pedir(token) || {};
    out = out.concat(r[campo] || []);
    token = r.nextPageToken;
  } while (token);
  return out;
}

/** Lee Classroom y lo manda al panel. Es lo que corre cada hora. */
function enviarClassroom() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('PANEL_URL');
  var token = props.getProperty('TOKEN');
  if (!url || !token) throw new Error('Faltan las propiedades PANEL_URL y TOKEN');
  var datos = leerClassroom_();
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'text/plain;charset=utf-8',
    payload: JSON.stringify({ action: 'classroom', token: token, datos: datos }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  var texto = resp.getContentText();
  var r;
  try { r = JSON.parse(texto); } catch (e) { throw new Error('El panel no devolvió datos (¿la URL es la /exec?): ' + texto.slice(0, 200)); }
  if (r.error) throw new Error('El panel respondió: ' + r.error);
  return datos;
}

/** Para probar: muestra lo que encontró y lo manda una vez. */
function probarClassroom() {
  var datos = leerClassroom_();
  Logger.log('Materias: ' + datos.cursos.map(function (c) { return c.nombre; }).join(', '));
  var cuenta = {};
  datos.tareas.forEach(function (t) { cuenta[t.estado] = (cuenta[t.estado] || 0) + 1; });
  Logger.log('Tareas: ' + JSON.stringify(cuenta) + ' · avisos: ' + datos.avisos.length);
  datos.tareas.filter(function (t) { return t.estado === 'pendiente' || t.estado === 'atrasada'; })
    .slice(0, 10).forEach(function (t) {
      Logger.log('  ' + t.estado + ' · ' + t.curso + ' · ' + t.titulo + ' · vence ' + (t.vence || 'sin fecha'));
    });
  enviarClassroom();
  Logger.log('Enviado al panel ✓');
}

/** Ejecutar una vez: manda los datos al panel cada hora. */
function activarClassroom() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarClassroom') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarClassroom').timeBased().everyHours(1).create();
  Logger.log('Listo: Classroom se manda al panel cada hora.');
}
