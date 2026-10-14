/**
 * Asistente con IA (Gemini de Google, nivel gratuito).
 *
 * Una vez por día lee los comunicados del cole (Colegium) y lo de Classroom de Thi, y:
 *   - resume la semana en 2-3 líneas,
 *   - arma la lista de pendientes (firmar, llevar, pagar…),
 *   - saca las fechas que mencionan (pasan al calendario automático, ver Agentes.gs),
 *   - detecta pruebas próximas y arma un repaso de preguntas y respuestas para Thi.
 *
 * Propiedades del script:
 *   GEMINI_API_KEY   la clave de Google AI Studio (gratis): https://aistudio.google.com/apikey
 *   GEMINI_MODELO    (opcional) por defecto gemini-2.5-flash
 *
 * Ojo: en el nivel gratuito Google puede usar lo que se le manda para mejorar sus
 * productos. Se le mandan los textos de los comunicados y de Classroom (no notas, ni
 * asistencia, ni datos personales de la ficha).
 *
 *   ?action=ia&token=...   → { datos: { resumen, pendientes, fechas, repasos, generado }, recibido }
 */

var MODELO_POR_DEFECTO_ = 'gemini-2.5-flash';
var DIAS_DE_TEXTOS_IA_ = 21;
var MAX_REPASOS_ = 3;

function gemini_(prompt, esquema) {
  var props = PropertiesService.getScriptProperties();
  var clave = props.getProperty('GEMINI_API_KEY');
  if (!clave) throw new Error('Falta la propiedad GEMINI_API_KEY (sacala gratis en https://aistudio.google.com/apikey)');
  var modelo = props.getProperty('GEMINI_MODELO') || MODELO_POR_DEFECTO_;
  var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': clave },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, temperature: 0.3 }
    })
  });
  var codigo = resp.getResponseCode();
  var cuerpo = resp.getContentText();
  if (codigo === 404) throw new Error('Gemini no encontró el modelo "' + modelo + '": probá otro en la propiedad GEMINI_MODELO');
  if (codigo === 429) throw new Error('Gemini dice que se pasó el límite gratuito por hoy: se vuelve a intentar mañana');
  if (codigo !== 200) throw new Error('Gemini respondió ' + codigo + ': ' + cuerpo.slice(0, 300));
  var r = JSON.parse(cuerpo);
  var texto = r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts &&
    r.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
  if (!texto) throw new Error('Gemini no devolvió nada (¿bloqueado por sus filtros?)');
  return JSON.parse(texto);
}

var ESQUEMA_SEMANA_ = {
  type: 'OBJECT',
  properties: {
    resumen: { type: 'STRING', description: '2 o 3 oraciones cortas sobre lo importante de la semana' },
    pendientes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          texto: { type: 'STRING', description: 'qué hay que hacer, en pocas palabras (ej. "Firmar la autorización de la salida")' },
          para: { type: 'STRING', description: 'fecha límite AAAA-MM-DD si la dice, o vacío' }
        },
        required: ['texto']
      }
    },
    fechas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          fecha: { type: 'STRING', description: 'AAAA-MM-DD' },
          hora: { type: 'STRING', description: 'HH:MM en 24 h, o vacío si no la dice' },
          titulo: { type: 'STRING', description: 'corto, ej. "Salida al Planetario"' },
          detalle: { type: 'STRING', description: 'qué llevar o tener en cuenta, o vacío' }
        },
        required: ['fecha', 'titulo']
      }
    },
    pruebas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          materia: { type: 'STRING' },
          fecha: { type: 'STRING', description: 'AAAA-MM-DD o vacío' },
          temas: { type: 'STRING', description: 'los temas que entran, tal como los dicen los textos' }
        },
        required: ['materia', 'temas']
      }
    }
  },
  required: ['resumen', 'pendientes', 'fechas', 'pruebas']
};

var ESQUEMA_REPASO_ = {
  type: 'OBJECT',
  properties: {
    preguntas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { pregunta: { type: 'STRING' }, respuesta: { type: 'STRING' } },
        required: ['pregunta', 'respuesta']
      }
    }
  },
  required: ['preguntas']
};

function fechaCorta_(d) {
  return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'EEEE d/M/yyyy');
}

/* Los textos que lee la IA: comunicados recientes (con el texto completo si está) y Classroom. */
function textosParaIA_(cole, aula, ahora) {
  var desde = new Date(ahora.getTime() - DIAS_DE_TEXTOS_IA_ * 86400000).toISOString();
  var detalles = {};
  ((cole && cole.detalles) || []).forEach(function (d) { detalles[d.id] = d.mensaje; });
  var partes = [];
  ((cole && cole.comunicados) || []).filter(function (c) { return (c.fecha || '') >= desde; }).slice(0, 25)
    .forEach(function (c) {
      partes.push('COMUNICADO (' + String(c.fecha).slice(0, 10) + ', de ' + (c.remitente || '?') + '): ' + c.titulo +
        '\n' + String(detalles[c.id] || c.resumen || '').slice(0, 2500));
    });
  ((cole && cole.eventos) || []).slice(0, 20).forEach(function (e) {
    partes.push('EVENTO DEL CALENDARIO DEL COLEGIO: ' + e.titulo + ' · ' + e.inicio);
  });
  ((aula && aula.tareas) || []).filter(function (t) { return t.estado === 'pendiente' || t.estado === 'atrasada'; })
    .forEach(function (t) {
      partes.push('TAREA DE CLASSROOM (' + t.curso + ', ' + (t.vence ? 'vence ' + t.vence.slice(0, 10) : 'sin fecha') + '): ' +
        t.titulo + (t.descripcion ? '\n' + t.descripcion : ''));
    });
  ((aula && aula.avisos) || []).filter(function (a) { return (a.fecha || '') >= desde; }).forEach(function (a) {
    partes.push('AVISO DE CLASSROOM (' + String(a.fecha).slice(0, 10) + ', ' + a.curso + '): ' + a.texto);
  });
  return partes.join('\n\n---\n\n').slice(0, 60000);
}

function promptSemana_(textos, ahora, alumno) {
  return 'Sos un asistente para una familia de Buenos Aires. ' + alumno + ' está en 4° año de la secundaria.\n' +
    'Hoy es ' + fechaCorta_(ahora) + '.\n\n' +
    'Leé estos textos del colegio y de Google Classroom y devolvé:\n' +
    '- resumen: lo importante de los próximos días en 2 o 3 oraciones cortas, en castellano rioplatense, tono cálido.\n' +
    '- pendientes: lo que la familia o ' + alumno + ' tiene que HACER (firmar, llevar, pagar, entregar, traer). Solo lo que está por delante.\n' +
    '- fechas: eventos con fecha concreta de hoy en adelante (salidas, actos, reuniones, pruebas, entregas, feriados del cole). ' +
    'Si dice "el jueves" sin fecha, calculala a partir de la fecha del texto.\n' +
    '- pruebas: evaluaciones o pruebas que vienen, con la materia y los temas.\n' +
    'Usá SOLO lo que dicen los textos: no inventes fechas, horarios ni temas. Si no hay nada, devolvé listas vacías.\n\n' +
    'TEXTOS:\n\n' + textos;
}

function promptRepaso_(p, alumno) {
  return 'Armá un repaso para ' + alumno + ', alumno de 4° año de la secundaria en Argentina, para la prueba de ' +
    p.materia + '. Temas: ' + p.temas + '.\n' +
    'Devolvé 8 preguntas que ayuden a estudiar, de menor a mayor dificultad, con su respuesta breve y correcta ' +
    '(en ejercicios de cálculo, la respuesta con el resultado y el paso clave). Castellano rioplatense, sin vueltas.';
}

/* Deja solo lo que tiene sentido (fechas válidas y por delante, textos cortos). Puro, para los tests. */
function limpiarSemana_(r, ahora) {
  var hoy = Utilities.formatDate(ahora, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  var fechaOk = function (f) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f || '')); };
  var corto = function (t, n) { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  return {
    resumen: corto(r.resumen, 500),
    pendientes: (r.pendientes || []).filter(function (p) { return p.texto && (!fechaOk(p.para) || p.para >= hoy); })
      .slice(0, 8).map(function (p) { return { texto: corto(p.texto, 140), para: fechaOk(p.para) ? p.para : '' }; }),
    fechas: (r.fechas || []).filter(function (f) { return fechaOk(f.fecha) && f.fecha >= hoy && f.titulo; })
      .slice(0, 15).map(function (f) {
        return { fecha: f.fecha, hora: /^\d{1,2}:\d{2}$/.test(String(f.hora || '')) ? f.hora : '',
                 titulo: corto(f.titulo, 90), detalle: corto(f.detalle, 200) };
      }),
    pruebas: (r.pruebas || []).filter(function (p) { return p.materia && p.temas && (!fechaOk(p.fecha) || p.fecha >= hoy); })
      .slice(0, MAX_REPASOS_).map(function (p) {
        return { materia: corto(p.materia, 60), fecha: fechaOk(p.fecha) ? p.fecha : '', temas: corto(p.temas, 400) };
      })
  };
}

function claveRepaso_(p) {
  return String(p.materia).toLowerCase().trim() + '|' + (p.fecha || '') + '|' + String(p.temas).toLowerCase().slice(0, 60);
}

/** Lo que corre una vez por día (y con probarIA). */
function asistenteIA() {
  var ahora = new Date();
  var cole = null, aula = null;
  try { cole = leerColegium_().datos; } catch (e) { Logger.log('Colegium: ' + e.message); }
  try { aula = leerClassroom_().datos; } catch (e) { Logger.log('Classroom: ' + e.message); }
  var alumno = PropertiesService.getScriptProperties().getProperty('APODO_ALUMNO') || 'Thi';
  var textos = textosParaIA_(cole, aula, ahora);
  var previo = leerJson_('IA', 'IA_RECIBIDO').datos || {};
  if (!textos) {
    guardarJson_('IA', 'IA_RECIBIDO', { resumen: 'No hay comunicados ni novedades de Classroom en las últimas semanas.',
      pendientes: [], fechas: [], repasos: previo.repasos || [], generado: ahora.toISOString() });
    return;
  }
  var semana = limpiarSemana_(gemini_(promptSemana_(textos, ahora, alumno), ESQUEMA_SEMANA_), ahora);

  // Repasos: uno por prueba; si ya estaba hecho (misma prueba), no se vuelve a pedir.
  var hechos = {};
  (previo.repasos || []).forEach(function (r) { hechos[r.clave] = r; });
  var repasos = semana.pruebas.map(function (p) {
    var clave = claveRepaso_(p);
    if (hechos[clave]) return hechos[clave];
    var r = gemini_(promptRepaso_(p, alumno), ESQUEMA_REPASO_);
    registrar_('IA', 'Armé un repaso de ' + p.materia + ' para ' + alumno + (p.fecha ? ' (prueba del ' + p.fecha.slice(8) + '/' + Number(p.fecha.slice(5, 7)) + ')' : '') + '.');
    return { clave: clave, materia: p.materia, fecha: p.fecha, temas: p.temas,
             preguntas: (r.preguntas || []).slice(0, 10), creado: ahora.toISOString() };
  });

  guardarJson_('IA', 'IA_RECIBIDO', {
    resumen: semana.resumen, pendientes: semana.pendientes, fechas: semana.fechas,
    repasos: repasos, generado: ahora.toISOString()
  });
  registrar_('IA', 'Resumí la semana del cole: ' + semana.pendientes.length + ' pendientes y ' +
    semana.fechas.length + ' fechas.');
}

function leerIA_() {
  return leerJson_('IA', 'IA_RECIBIDO');
}

/** Para probar desde el editor: corre el asistente y muestra lo que armó. */
function probarIA() {
  asistenteIA();
  var d = leerIA_().datos;
  Logger.log('Resumen: ' + d.resumen);
  d.pendientes.forEach(function (p) { Logger.log('  ☐ ' + p.texto + (p.para ? ' (para el ' + p.para + ')' : '')); });
  d.fechas.forEach(function (f) { Logger.log('  📅 ' + f.fecha + (f.hora ? ' ' + f.hora : '') + ' · ' + f.titulo); });
  d.repasos.forEach(function (r) { Logger.log('  📖 Repaso de ' + r.materia + ': ' + r.preguntas.length + ' preguntas'); });
}

/** Ejecutar una vez: el asistente corre todos los días a las 6. */
function activarIA() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'asistenteIA') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('asistenteIA').timeBased().everyDays(1).atHour(6).create();
  probarIA();
  Logger.log('Listo: el asistente corre todos los días a las 6.');
}
