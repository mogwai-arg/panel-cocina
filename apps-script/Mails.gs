/**
 * Mails importantes de tu Gmail, por categoría, sin IA: búsquedas de Gmail.
 *
 * Las búsquedas están en la hoja "Mails" de la planilla (se crea sola con ejemplos):
 *   categoria   Cole, Salud, Pagos...
 *   busqueda    lo mismo que escribirías en el buscador de Gmail
 *               (ej. from:osde.com.ar OR subject:turno)
 *   activa      casilla: destildada = no se busca
 *   cuenta      en qué Gmail: Javi, Thi o Ambas. Los de Thi los busca el script de su
 *               cuenta (apps-script-classroom/) y llegan con lo de Classroom.
 * Siempre se agrega: últimas 3 semanas, sin promociones, social ni spam.
 *
 * De cada mail se manda asunto, remitente, un resumen corto y, si el texto tiene una
 * fecha futura ("20/10 a las 10:30", "lunes 20 de octubre"), esa fecha: el panel la pone
 * en la agenda. Solo lee: no marca como leído ni mueve nada.
 *
 *   ?action=mails&token=...   → { mails: [{ id, categoria, asunto, de, recibido, resumen,
 *                                           link, cuando: { fecha, conHora } | null, sinLeer }] }
 */

var MAILS_POR_CATEGORIA = 12;
var MINUTOS_CACHE_MAILS = 10;

/*
 * Búsquedas por defecto: en el ASUNTO (buscar en todo el mail encuentra palabras del pie,
 * como "consultas" o "reserva", y se cuela publicidad). cuenta: Javi, Thi o Ambas.
 */
var REGLAS_MAILS_ = [
  ['Salud', 'subject:(turno OR turnos OR "recordatorio de turno" OR "confirmación de turno" OR "orden médica" OR laboratorio OR resultados OR vacuna OR autorización OR receta OR consulta)', 'Ambas'],
  ['Cole', 'subject:(colegio OR escuela OR alberdi OR "reunión de padres" OR "cuota escolar" OR acto OR excursión OR "salida educativa") -from:classroom.google.com', 'Ambas'],
  ['Pagos', 'subject:(vencimiento OR vence OR VEP OR VEPS OR expensas OR "factura vencida" OR "aviso de deuda" OR "saldo total" OR "pagar tu tarjeta" OR monotributo)', 'Javi'],
  ['Viajes', 'subject:(reserva OR "check-in" OR "tarjeta de embarque" OR vuelo OR itinerario OR boarding)', 'Javi'],
  ['Básquet', 'subject:(básquet OR basquet OR entrenamiento OR partido OR convocatoria OR torneo OR febamba)', 'Thi']
];

// Las búsquedas de la primera versión (si siguen sin tocar, se reemplazan por las nuevas).
var REGLAS_VIEJAS_ = {
  'osde OR turno OR turnos OR "recordatorio de turno" OR "confirmación de turno" OR consulta OR laboratorio OR "orden médica" OR receta OR vacuna': 'Salud',
  'colegio OR escuela OR alberdi OR colegium OR "reunión de padres" OR "cuota escolar"': 'Cole',
  'vencimiento OR "vence el" OR "fecha de vencimiento" OR "aviso de deuda" OR VEP OR ARCA OR AFIP OR expensas OR "tu factura"': 'Pagos',
  'reserva OR "check-in" OR "tarjeta de embarque" OR vuelo OR boarding': 'Viajes'
};

var FILTRO_MAILS_ = ' newer_than:21d -category:promotions -category:social -in:spam -in:trash';

function hojaMails_() {
  var libro = planilla_();
  var hoja = libro.getSheetByName('Mails');
  if (!hoja) {
    hoja = libro.insertSheet('Mails');
    hoja.getRange(1, 1, 1, 4).setValues([['categoria', 'busqueda', 'activa', 'cuenta']]).setFontWeight('bold');
    hoja.setFrozenRows(1);
    hoja.getRange(2, 1, REGLAS_MAILS_.length, 1).setValues(REGLAS_MAILS_.map(function (r) { return [r[0]]; }));
    hoja.getRange(2, 2, REGLAS_MAILS_.length, 1).setValues(REGLAS_MAILS_.map(function (r) { return [r[1]]; }));
    hoja.getRange(2, 3, REGLAS_MAILS_.length, 1).insertCheckboxes().setValue(true);
    hoja.getRange(2, 4, REGLAS_MAILS_.length, 1).setValues(REGLAS_MAILS_.map(function (r) { return [r[2]]; }));
    prepararHojaMails_(hoja);
    return hoja;
  }
  actualizarHojaMails_(hoja);
  return hoja;
}

function prepararHojaMails_(hoja) {
  hoja.setColumnWidth(2, 640);
  hoja.getRange(1, 2).setNote('Igual que en el buscador de Gmail. Ej.: from:osde.com.ar OR subject:turno. ' +
    'Se agrega solo: últimas 3 semanas, sin promociones, social ni spam.');
  hoja.getRange(1, 4).setNote('En qué Gmail se busca: Javi, Thi o Ambas.');
  hoja.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Javi', 'Thi', 'Ambas'], true).setAllowInvalid(false).build());
}

/* La hoja de la primera versión: agrega la columna "cuenta" y mejora las búsquedas sin tocar. */
function actualizarHojaMails_(hoja) {
  if (String(hoja.getRange(1, 4).getValue()) === 'cuenta') return;
  hoja.getRange(1, 4).setValue('cuenta').setFontWeight('bold');
  var filas = hoja.getDataRange().getValues();
  var categorias = {};
  for (var i = 1; i < filas.length; i++) {
    var vieja = REGLAS_VIEJAS_[String(filas[i][1]).trim()];
    var nueva = REGLAS_MAILS_.filter(function (r) { return r[0] === vieja; })[0];
    if (nueva) hoja.getRange(i + 1, 2).setValue(nueva[1]);
    hoja.getRange(i + 1, 4).setValue(nueva ? nueva[2] : 'Javi');
    categorias[String(filas[i][0]).trim()] = true;
  }
  REGLAS_MAILS_.forEach(function (r) {
    if (categorias[r[0]]) return;
    var fila = hoja.getLastRow() + 1;
    hoja.getRange(fila, 1, 1, 2).setValues([[r[0], r[1]]]);
    hoja.getRange(fila, 3).insertCheckboxes().setValue(true);
    hoja.getRange(fila, 4).setValue(r[2]);
  });
  prepararHojaMails_(hoja);
}

/** Búsquedas activas para una cuenta ('Javi' o 'Thi'). */
function reglasMails_(cuenta) {
  var filas = hojaMails_().getDataRange().getValues().slice(1);
  return filas.filter(function (f) {
    var c = String(f[3] || 'Javi').trim().toLowerCase();
    return f[0] && f[1] && f[2] !== false && (c === 'ambas' || c === cuenta.toLowerCase());
  }).map(function (f) { return { categoria: String(f[0]).trim(), busqueda: String(f[1]).trim() }; });
}

/* Para el script de la cuenta de Thi: qué tiene que buscar. */
function reglasMailsPara_(cuenta) {
  return { reglas: reglasMails_(cuenta || 'Thi'), filtro: FILTRO_MAILS_, porCategoria: MAILS_POR_CATEGORIA };
}

function mails_() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('mails');
  if (guardado) return JSON.parse(guardado);

  var ahora = new Date();
  var vistos = {};
  var mails = [];
  reglasMails_('Javi').forEach(function (r) {
    var hilos = GmailApp.search('(' + r.busqueda + ')' + FILTRO_MAILS_, 0, MAILS_POR_CATEGORIA);
    hilos.forEach(function (h) {
      if (vistos[h.getId()]) return; // un mail va en la primera categoría que lo encuentra
      vistos[h.getId()] = true;
      var m = h.getMessages().pop(); // el último del hilo
      mails.push(mailParaPanel_({
        id: h.getId(), categoria: r.categoria, asunto: m.getSubject(), de: m.getFrom(),
        recibido: m.getDate().toISOString(), cuerpo: m.getPlainBody(),
        link: 'https://mail.google.com/mail/u/0/#all/' + h.getId(), sinLeer: h.isUnread()
      }, ahora, 'Javi'));
    });
  });
  // Los de Thi llegan con lo de Classroom (los busca el script de su cuenta, cada hora).
  var aula = leerClassroom_().datos;
  var yaEstan = {};
  mails.forEach(function (m) { yaEstan[m.asunto + '|' + m.recibido.slice(0, 16)] = true; });
  ((aula && aula.mails) || []).forEach(function (crudo) {
    var m = mailParaPanel_(crudo, ahora, 'Thi');
    if (!yaEstan[m.asunto + '|' + m.recibido.slice(0, 16)]) mails.push(m);
  });
  mails.sort(function (a, b) { return a.recibido < b.recibido ? 1 : -1; });
  var datos = { mails: mails, actualizado: ahora.toISOString() };
  cache.put('mails', JSON.stringify(datos), MINUTOS_CACHE_MAILS * 60);
  return datos;
}

/* Un mail (de cualquiera de las dos cuentas) como lo muestra el panel. */
function mailParaPanel_(crudo, ahora, cuenta) {
  var cuerpo = limpiarCuerpo_(crudo.cuerpo);
  var recibido = new Date(crudo.recibido);
  return {
    id: crudo.id,
    cuenta: cuenta,
    categoria: crudo.categoria,
    asunto: corto_(crudo.asunto || '(sin asunto)', 160),
    de: nombreRemitente_(crudo.de),
    recibido: recibido.toISOString(),
    resumen: corto_(cuerpo, 280),
    link: crudo.link || '',
    cuando: primeraFechaFutura_((crudo.asunto || '') + '\n' + cuerpo.slice(0, 4000), ahora, recibido),
    sinLeer: !!crudo.sinLeer
  };
}

function corto_(t, n) {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/** "OSDE <turnos@osde.com.ar>" → "OSDE" */
function nombreRemitente_(de) {
  var m = String(de || '').match(/^\s*"?([^"<]+?)"?\s*</);
  return corto_(m ? m[1] : String(de || '').replace(/[<>]/g, ''), 60);
}

/* Sin las respuestas citadas ni los enlaces largos. */
function limpiarCuerpo_(texto) {
  return String(texto || '')
    .split(/\n(?:El .{5,80} escribió:|On .{5,80} wrote:|-{2,} ?Mensaje original|De: .+\n)/)[0]
    .split('\n').filter(function (l) { return !/^\s*>/.test(l); }).join('\n')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ \t]+/g, ' ');
}

var MESES_MAIL_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/*
 * La primera fecha del texto que todavía no pasó (hasta 1 año adelante), con hora si
 * la tiene cerca: "20/10", "20/10/2026", "20-10-26", "20 de octubre", "lunes 20 de octubre de 2026",
 * seguidas de "a las 10:30", "10:30 hs", "10.30 h", "10 hs".
 * `recibido` sirve de referencia para el año cuando no lo dice.
 */
function primeraFechaFutura_(texto, ahora, recibido) {
  var t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  var ref = recibido || ahora;
  var hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  var limite = new Date(hoy.getTime() + 366 * 86400000);
  // Con barra: "20/10" o "20/10/2026". Con guion o punto solo con año ("20-10-2026"),
  // para no confundir porcentajes o números como "12.5".
  var patrones = [
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g,
    /\b(\d{1,2})[\-.](\d{1,2})[\-.](\d{2,4})\b/g,
    new RegExp('\\b(\\d{1,2})\\s+de\\s+(' + MESES_MAIL_.join('|') + '|setiembre)(?:\\s+(?:de|del)\\s+(\\d{4}))?', 'g')
  ];
  var hallazgos = [];
  patrones.forEach(function (re, tipo) {
    var m;
    while ((m = re.exec(t))) {
      var dia = Number(m[1]);
      var mes = tipo < 2 ? Number(m[2]) : m[2] === 'setiembre' ? 9 : MESES_MAIL_.indexOf(m[2]) + 1;
      var anio = m[3] ? Number(m[3]) : null;
      if (anio !== null && anio < 100) anio += 2000;
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
      if (anio === null) {
        anio = ref.getFullYear();
        // "5/1" recibido en diciembre es del año que viene (pero "1/10" recibido el 12/10, no)
        if (new Date(anio, mes - 1, dia) < new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 90)) anio++;
      }
      var fecha = new Date(anio, mes - 1, dia);
      if (fecha.getMonth() !== mes - 1) continue; // 31/2 no existe
      var despues = t.slice(re.lastIndex, re.lastIndex + 40);
      var h = despues.match(/^[^\d\n]{0,14}?(\d{1,2})(?:[:.](\d{2}))?\s*(hs|h\b|horas|am|pm)?/);
      var conHora = false;
      if (h && (h[2] || h[3]) && Number(h[1]) < 24 && (!h[2] || Number(h[2]) < 60)) {
        var hora = Number(h[1]);
        if (h[3] === 'pm' && hora < 12) hora += 12;
        fecha.setHours(hora, Number(h[2] || 0));
        conHora = true;
      }
      hallazgos.push({ fecha: fecha, conHora: conHora, pos: m.index });
    }
  });
  hallazgos.sort(function (a, b) { return a.pos - b.pos; });
  for (var i = 0; i < hallazgos.length; i++) {
    var f = hallazgos[i];
    var fin = f.conHora ? f.fecha : new Date(f.fecha.getTime() + 86400000 - 1);
    if (fin >= ahora && f.fecha <= limite) return { fecha: f.fecha.toISOString(), conHora: f.conHora };
  }
  return null;
}

/** Para probar desde el editor (la primera vez pide permiso para leer Gmail). */
function probarMails() {
  CacheService.getScriptCache().remove('mails');
  var d = mails_();
  var porCat = {};
  d.mails.forEach(function (m) { porCat[m.categoria] = (porCat[m.categoria] || 0) + 1; });
  Logger.log('Mails encontrados: ' + d.mails.length + ' ' + JSON.stringify(porCat));
  d.mails.slice(0, 15).forEach(function (m) {
    Logger.log((m.cuenta === 'Thi' ? '[Thi] ' : '') + m.categoria + ' · ' + m.asunto + ' · ' + m.de +
      (m.cuando ? ' · 📅 ' + m.cuando.fecha.slice(0, m.cuando.conHora ? 16 : 10) : ''));
  });
}
