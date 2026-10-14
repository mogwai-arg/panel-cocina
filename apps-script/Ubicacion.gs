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
 *   avisar       casilla: te avisa cuando llega o se va de ese lugar
 *
 * Cómo avisa (propiedades del script):
 *   NTFY_TEMA        si está, notificación push con la app gratuita ntfy (iPhone/Android):
 *                    en la app te suscribís a ese mismo tema. Usá un nombre difícil de
 *                    adivinar (ej. thi-casa-8k2p9x): cualquiera que lo sepa ve los avisos.
 *   AVISOS_POR_MAIL  "si" para recibir también el mail (sin NTFY_TEMA, se manda mail siempre).
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
    return comandosParaTelefono_(props, quien, lugares, new Date());
  });
}

/*
 * OwnTracks acepta comandos en la respuesta. Le mandamos los lugares de la planilla como
 * "regiones": iOS las vigila por su cuenta y despierta a OwnTracks al entrar o salir,
 * aunque esté en segundo plano (más confiable y con menos batería que esperar a que se
 * mueva). Se mandan cuando cambian los lugares, y una vez por semana por las dudas.
 * (En OwnTracks tiene que estar prendido "Remote Control".)
 */
function comandosParaTelefono_(props, quien, lugares, ahora) {
  if (!lugares.length) return [];
  var firma = JSON.stringify(lugares.map(function (l) { return [l.nombre, l.lat, l.lon, l.radio]; }));
  var clave = 'REGIONES_' + quien;
  var previo = props.getProperty(clave) ? JSON.parse(props.getProperty(clave)) : {};
  if (previo.firma === firma && ahora - new Date(previo.cuando) < 7 * 86400000) return [];
  props.setProperty(clave, JSON.stringify({ firma: firma, cuando: ahora.toISOString() }));
  return [regionesOwnTracks_(lugares, ahora)];
}

function regionesOwnTracks_(lugares, ahora) {
  var tst = Math.floor(ahora.getTime() / 1000);
  return {
    _type: 'cmd',
    action: 'setWaypoints',
    waypoints: {
      _type: 'waypoints',
      waypoints: lugares.map(function (l, i) {
        return { _type: 'waypoint', desc: l.nombre, lat: l.lat, lon: l.lon, rad: l.radio, tst: tst + i };
      })
    }
  };
}

/* Aviso (push con ntfy y/o mail) cuando llega o se va de un lugar con "avisar" tildado. */
function avisarCambio_(quien, cambio, lugares, estado) {
  var avisar = {};
  lugares.forEach(function (l) { if (l.avisar) avisar[l.nombre] = true; });
  var hora = Utilities.formatDate(new Date(estado.cuando), 'America/Argentina/Buenos_Aires', 'HH:mm');
  var textos = [];
  if (cambio.seFue && avisar[cambio.seFue]) textos.push(quien + ' salió de ' + cambio.seFue);
  if (cambio.llego && avisar[cambio.llego]) textos.push(quien + ' llegó a ' + cambio.llego);
  if (!textos.length) return;
  var asunto = '📍 ' + textos.join(' · ') + ' (' + hora + ')';
  var mapa = 'https://maps.google.com/?q=' + estado.lat + ',' + estado.lon;
  var props = PropertiesService.getScriptProperties();
  var tema = props.getProperty('NTFY_TEMA');
  if (tema) {
    try {
      UrlFetchApp.fetch('https://ntfy.sh/', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({
          topic: tema, title: textos.join(' · '),
          message: hora + (estado.bateria ? ' · batería ' + estado.bateria + '%' : ''),
          tags: ['round_pushpin'], click: mapa
        })
      });
    } catch (e) { Logger.log('No se pudo mandar el aviso a ntfy: ' + e.message); }
    if (String(props.getProperty('AVISOS_POR_MAIL') || '').toLowerCase() !== 'si') return;
  }
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), asunto,
      asunto + '\n\nVer en el mapa: https://maps.google.com/?q=' + estado.lat + ',' + estado.lon +
      (estado.bateria ? '\nBatería: ' + estado.bateria + '%' : ''));
  } catch (e) { Logger.log('No se pudo mandar el aviso: ' + e.message); }
}

/* Lo último que llegó de OwnTracks (aunque no sirviera), para probarUbicacion. */
function anotarLlegada_(quien, contenido, tokenOk) {
  var tipo = '?';
  try { tipo = JSON.parse(contenido)._type || '?'; } catch (e) { tipo = 'no es JSON'; }
  PropertiesService.getScriptProperties().setProperty('ULTIMA_LLEGADA_OWNTRACKS', JSON.stringify({
    cuando: new Date().toISOString(), quien: quien || '(sin quien)', tipo: tipo, tokenOk: tokenOk
  }));
}

function ubicaciones_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  return {
    personas: Object.keys(props).filter(function (k) { return k.indexOf('UBI_') === 0; })
      .map(function (k) { return JSON.parse(props[k]); })
  };
}

/** Para probar el aviso (ntfy y/o mail) sin esperar a que Thi se mueva. */
function probarAviso() {
  avisarCambio_('Thi', { llego: 'Prueba', seFue: null }, [{ nombre: 'Prueba', avisar: true }],
    { cuando: new Date().toISOString(), lat: -34.6521, lon: -58.6443, bateria: 80 });
  Logger.log('Aviso de prueba enviado' + (PropertiesService.getScriptProperties().getProperty('NTFY_TEMA')
    ? ' a ntfy.' : ' por mail (para notificaciones push, agregá la propiedad NTFY_TEMA).'));
}

/** Para probar desde el editor: lugares cargados y última ubicación recibida. */
function probarUbicacion() {
  var l = lugares_();
  Logger.log('Lugares con coordenadas: ' + (l.length ? l.map(function (x) {
    return x.nombre + ' (' + x.radio + ' m' + (x.avisar ? ', avisa' : '') + ')';
  }).join(', ') : 'ninguno: completá la hoja Lugares'));
  var p = ubicaciones_().personas;
  var ultima = PropertiesService.getScriptProperties().getProperty('ULTIMA_LLEGADA_OWNTRACKS');
  if (ultima) {
    var u = JSON.parse(ultima);
    Logger.log('Último mensaje de OwnTracks: ' + u.cuando + ' · tipo ' + u.tipo + ' · quien ' + u.quien +
      (u.tokenOk ? '' : ' · ⚠️ TOKEN INVÁLIDO: revisá el token en la URL de OwnTracks'));
  } else {
    Logger.log('OwnTracks nunca llegó a este script: revisá la URL (la /exec de config.js) y que ' +
      'hayas publicado la versión nueva.');
  }
  if (!p.length) Logger.log('Todavía no llegó ninguna ubicación de OwnTracks.');
  p.forEach(function (x) {
    Logger.log(x.quien + ': ' + (x.lugar ? 'en ' + x.lugar : x.cercano ? 'a ' + x.cercano.metros + ' m de ' + x.cercano.nombre : 'sin lugar') +
      ' · ' + x.cuando + (x.bateria ? ' · batería ' + x.bateria + '%' : ''));
  });
  // Desde el editor getUrl() da la URL de prueba (/dev), que no sirve para OwnTracks.
  var reg = PropertiesService.getScriptProperties().getProperty('REGIONES_Thi');
  Logger.log(reg ? 'Regiones mandadas a OwnTracks: ' + JSON.parse(reg).cuando : 'Todavía no se mandaron las regiones a OwnTracks.');
  Logger.log('URL para OwnTracks: la APPS_SCRIPT_URL de tu config.js (termina en /exec) + ' +
    '?action=ubicacion&quien=Thi&token=<TU TOKEN>');
}
