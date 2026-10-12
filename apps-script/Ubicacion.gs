/**
 * Ubicación de Thi (o de quien quieras) con OwnTracks, gratis y sin servidor propio.
 *
 * OwnTracks (app del iPhone) manda la posición por HTTP a esta URL:
 *   <URL /exec>?action=ubicacion&quien=Thi&token=<TOKEN>
 *
 * Los lugares están en la hoja "Lugares" de la planilla (se crea sola):
 *   nombre       Casa, Colegio, Club...
 *   coordenadas  como las copia Google Maps (clic derecho sobre el lugar): -34.6521, -58.6443
 *   radio_m      qué tan cerca cuenta como "estar ahí" (por defecto 150 m)
 *   avisar       casilla: te llega un mail cuando llega o se va de ese lugar
 *
 *   ?action=ubicacion&token=...   → { personas: [{ quien, lat, lon, precision, bateria, cuando,
 *                                     lugar, desde, cercano: { nombre, metros }, historial }] }
 */

var RADIO_POR_DEFECTO_ = 150;

function hojaLugares_() {
  var libro = planilla_();
  var hoja = libro.getSheetByName('Lugares');
  if (hoja) return hoja;
  hoja = libro.insertSheet('Lugares');
  hoja.getRange(1, 1, 1, 4).setValues([['nombre', 'coordenadas', 'radio_m', 'avisar']]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.getRange(2, 1, 3, 3).setValues([['Casa', '', 150], ['Colegio', '', 150], ['Club', '', 150]]);
  hoja.getRange(2, 4, 3, 1).insertCheckboxes();
  hoja.getRange(3, 4).setValue(true);
  hoja.getRange(1, 2).setNote('En Google Maps: clic derecho sobre el lugar → el primer renglón son las ' +
    'coordenadas (se copian con un clic). Pegalas acá, ej.: -34.6521, -58.6443');
  hoja.getRange(1, 4).setNote('Tildado: te llega un mail cuando llega o se va de este lugar.');
  hoja.setColumnWidth(2, 220);
  return hoja;
}

function lugares_() {
  return hojaLugares_().getDataRange().getValues().slice(1).map(function (f) {
    var c = String(f[1] || '').match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/);
    if (!f[0] || !c) return null;
    return { nombre: String(f[0]).trim(), lat: Number(c[1]), lon: Number(c[2]),
             radio: Number(f[2]) || RADIO_POR_DEFECTO_, avisar: f[3] === true };
  }).filter(function (l) { return l; });
}

/** Distancia en metros entre dos puntos. */
function metros_(lat1, lon1, lat2, lon2) {
  var r = 6371000, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/*
 * En qué lugar está: el más cercano cuyo radio lo incluye (sumando un poco de la
 * imprecisión del GPS). Si no está en ninguno, el más cercano para decir "a 1,2 km de Casa".
 */
function ubicarEnLugares_(lat, lon, precision, lugares) {
  var cercano = null;
  lugares.forEach(function (l) {
    var d = metros_(lat, lon, l.lat, l.lon);
    if (!cercano || d < cercano.metros) cercano = { nombre: l.nombre, metros: d, radio: l.radio, avisar: l.avisar };
  });
  var dentro = cercano && cercano.metros <= cercano.radio + Math.min(precision || 0, 100);
  return { lugar: dentro ? cercano.nombre : null, cercano: cercano, avisar: dentro && cercano.avisar };
}

/*
 * Mensaje de OwnTracks → estado guardado. Devuelve el estado nuevo y, si cambió de
 * lugar, el cambio ({ llego, seFue }) para avisar. Puro (sin servicios) para los tests.
 */
function nuevoEstado_(previo, msg, quien, lugares, ahora) {
  if (!msg || (msg._type !== 'location' && msg._type !== 'transition') || msg.lat === undefined) return null;
  var cuando = msg.tst ? new Date(msg.tst * 1000) : ahora;
  if (previo && previo.cuando && new Date(previo.cuando) > cuando) return null; // llegó tarde uno viejo
  var u = ubicarEnLugares_(msg.lat, msg.lon, msg.acc, lugares);
  // Si en la planilla no hay lugares, se usan las regiones definidas en OwnTracks.
  var lugar = u.lugar || (!lugares.length && msg.inregions && msg.inregions[0]) || null;
  var estado = {
    quien: quien,
    lat: msg.lat, lon: msg.lon,
    precision: msg.acc || null,
    bateria: msg.batt !== undefined ? msg.batt : (previo && previo.bateria) || null,
    velocidad: msg.vel !== undefined ? msg.vel : null, // km/h
    cuando: cuando.toISOString(),
    lugar: lugar,
    desde: previo && previo.lugar === lugar && previo.desde ? previo.desde : cuando.toISOString(),
    cercano: u.cercano ? { nombre: u.cercano.nombre, metros: u.cercano.metros } : null,
    historial: (previo && previo.historial) || []
  };
  var cambio = null;
  if (previo && previo.lugar !== lugar) {
    if (previo.lugar) estado.historial.unshift({ lugar: previo.lugar, desde: previo.desde, hasta: cuando.toISOString() });
    estado.historial = estado.historial.slice(0, 12);
    cambio = { llego: lugar, seFue: previo.lugar };
  }
  return { estado: estado, cambio: cambio };
}

function recibirUbicacion_(quien, msg) {
  quien = String(quien || 'Thi').trim();
  var props = PropertiesService.getScriptProperties();
  return conLock_(function () {
    var clave = 'UBI_' + quien;
    var previo = props.getProperty(clave) ? JSON.parse(props.getProperty(clave)) : null;
    var lugares = lugares_();
    var r = nuevoEstado_(previo, msg, quien, lugares, new Date());
    if (!r) return [];
    props.setProperty(clave, JSON.stringify(r.estado));
    if (r.cambio) avisarCambio_(quien, r.cambio, lugares, r.estado);
    return []; // OwnTracks espera una lista (de comandos para el teléfono): ninguno
  });
}

/* Mail cuando llega o se va de un lugar con "avisar" tildado. */
function avisarCambio_(quien, cambio, lugares, estado) {
  var avisar = {};
  lugares.forEach(function (l) { if (l.avisar) avisar[l.nombre] = true; });
  var hora = Utilities.formatDate(new Date(estado.cuando), 'America/Argentina/Buenos_Aires', 'HH:mm');
  var textos = [];
  if (cambio.seFue && avisar[cambio.seFue]) textos.push(quien + ' salió de ' + cambio.seFue);
  if (cambio.llego && avisar[cambio.llego]) textos.push(quien + ' llegó a ' + cambio.llego);
  if (!textos.length) return;
  var asunto = '📍 ' + textos.join(' · ') + ' (' + hora + ')';
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), asunto,
      asunto + '\n\nVer en el mapa: https://maps.google.com/?q=' + estado.lat + ',' + estado.lon +
      (estado.bateria ? '\nBatería: ' + estado.bateria + '%' : ''));
  } catch (e) { Logger.log('No se pudo mandar el aviso: ' + e.message); }
}

function ubicaciones_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  return {
    personas: Object.keys(props).filter(function (k) { return k.indexOf('UBI_') === 0; })
      .map(function (k) { return JSON.parse(props[k]); })
  };
}

/** Para probar desde el editor: lugares cargados y última ubicación recibida. */
function probarUbicacion() {
  var l = lugares_();
  Logger.log('Lugares con coordenadas: ' + (l.length ? l.map(function (x) {
    return x.nombre + ' (' + x.radio + ' m' + (x.avisar ? ', avisa' : '') + ')';
  }).join(', ') : 'ninguno: completá la hoja Lugares'));
  var p = ubicaciones_().personas;
  if (!p.length) Logger.log('Todavía no llegó ninguna ubicación de OwnTracks.');
  p.forEach(function (x) {
    Logger.log(x.quien + ': ' + (x.lugar ? 'en ' + x.lugar : x.cercano ? 'a ' + x.cercano.metros + ' m de ' + x.cercano.nombre : 'sin lugar') +
      ' · ' + x.cuando + (x.bateria ? ' · batería ' + x.bateria + '%' : ''));
  });
  // Desde el editor getUrl() da la URL de prueba (/dev), que no sirve para OwnTracks.
  Logger.log('URL para OwnTracks: la APPS_SCRIPT_URL de tu config.js (termina en /exec) + ' +
    '?action=ubicacion&quien=Thi&token=<TU TOKEN>');
}
