/**
 * Panel de Cocina · backend en Google Apps Script.
 *
 * Corre con tu cuenta de Google, gratis y sin servidor propio.
 * Por ahora entrega las fotos de una carpeta de Drive al marco.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   CARPETAS  IDs de carpetas de Drive separados por coma (se incluyen subcarpetas)
 *   TOKEN     clave secreta; el marco la manda en cada pedido
 *
 *   CALENDARIOS  (opcional) IDs de calendarios separados por coma. Si no está,
 *                se usan todos los calendarios visibles de tu Google Calendar.
 *
 * Pedidos:
 *   ?action=lista&token=...            → { fotos: [{ id, ancho, alto, fecha }] }
 *   ?action=img&id=...&ancho=1600&token=...  → { mime, data (base64) }  (de un video: su miniatura)
 *   ?action=girar&id=...&grados=90&token=...   → gira a mano una foto (queda guardado)
 *   ?action=video&id=...&parte=0&token=...   → { parte, partes, total, data (base64) }
 *   ?action=agenda&dias=7&token=...    → { eventos: [{ titulo, inicio, fin, todoElDia,
 *                                          lugar, calendario, color }] }
 *   ?action=basquet&token=...          → { equipo, actualizado, partidos: [{ fecha, cancha,
 *                                          local: { nombre, escudo, puntos }, visitante }] }
 *   ?action=listas | compra | tarea     → ver Listas.gs
 *   ?action=colegium y POST colegium   → ver Colegium.gs
 *   ?action=classroom y POST classroom → ver Colegium.gs y apps-script-classroom/
 *   ?action=mails                      → ver Mails.gs
 *   ?action=ubicacion (GET y POST)     → ver Ubicacion.gs (OwnTracks)
 *   ?action=agentes                    → ver Agentes.gs (calendario automático y registro)
 *   ?action=ia                         → ver IA.gs (resumen de la semana y repasos)
 */

var MINUTOS_CACHE_LISTA = 30;

// Subir este número con cada cambio: ?action=version muestra qué versión está publicada.
var VERSION = '2026-10-16.1';

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (!p.token || p.token !== propiedad_('TOKEN')) return json_({ error: 'Token inválido' });
    if (p.action === 'lista') {
      if (p.refrescar) CacheService.getScriptCache().remove('lista_n'); // "Buscar fotos nuevas ahora"
      return json_({ fotos: listarFotos_() });
    }
    if (p.action === 'img') return json_(imagen_(p.id, Number(p.ancho) || 1600));
    if (p.action === 'girar') return json_(girarFoto_(p.id, Number(p.grados) || 0));
    if (p.action === 'video') return json_(videoParte_(p.id, Number(p.parte) || 0));
    if (p.action === 'agenda') return json_({ eventos: agenda_(Number(p.dias) || 7) });
    if (p.action === 'basquet') return json_(basquet_());
    if (p.action === 'listas') return json_(listas_());     // Listas.gs
    if (p.action === 'compra') return json_(compra_(p));
    if (p.action === 'tarea') return json_(tarea_(p));
    if (p.action === 'colegium') return json_(leerColegium_()); // Colegium.gs
    if (p.action === 'classroom') return json_(leerClassroom_());
    if (p.action === 'mails') return json_(mails_()); // Mails.gs
    if (p.action === 'ubicacion') return json_(ubicaciones_()); // Ubicacion.gs
    if (p.action === 'agentes') return json_(agentes_()); // Agentes.gs
    if (p.action === 'ia') return json_(leerIA_()); // IA.gs
    if (p.action === 'reglasMails') return json_(reglasMailsPara_(p.cuenta));
    if (p.action === 'version') return json_({ version: VERSION });
    return json_({ error: 'Acción desconocida: ' + p.action + ' (versión publicada: ' + VERSION + ')' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

/** Pedidos POST: por ahora, los datos de Colegium que manda la extensión de Chrome. */
function doPost(e) {
  try {
    // OwnTracks: el token y la acción van en la URL (la app no deja agregar campos al cuerpo).
    var q = (e && e.parameter) || {};
    if (q.action === 'ubicacion') {
      var contenido = (e.postData && e.postData.contents) || '{}';
      var tokenOk = !!q.token && q.token === propiedad_('TOKEN');
      anotarLlegada_(q.quien, contenido, tokenOk); // Ubicacion.gs: para diagnosticar
      if (!tokenOk) return json_({ error: 'Token inválido' });
      return json_(recibirUbicacion_(q.quien, JSON.parse(contenido)));
    }
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body.token || body.token !== propiedad_('TOKEN')) return json_({ error: 'Token inválido' });
    if (body.action === 'colegium') return json_(guardarColegium_(body.datos));
    if (body.action === 'classroom') return json_(guardarClassroom_(body.datos)); // desde la cuenta de Thi
    return json_({ error: 'Acción desconocida: ' + body.action + ' (versión publicada: ' + VERSION + ')' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function propiedad_(nombre) {
  var v = PropertiesService.getScriptProperties().getProperty(nombre);
  if (!v) throw new Error('Falta la propiedad del script ' + nombre);
  return v;
}

function json_(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Lista todas las fotos de las carpetas configuradas, con tamaño y fecha. */
function listarFotos_() {
  var cache = CacheService.getScriptCache();
  var guardada = leerCacheGrande_(cache, 'lista');
  if (guardada) return guardada;

  var pendientes = propiedad_('CARPETAS').split(',').map(function (s) { return s.trim(); });
  var vistas = {};
  var fotos = [];
  var sinTamano = [];
  var sinGiro = []; // Drive dice "sin giro": se confirma leyendo el archivo
  ultimoResumen_ = { porTipo: {}, sinTamano: 0, recuperadas: 0, descartadas: [], videosSalteados: 0 };

  while (pendientes.length) {
    var carpeta = pendientes.shift();
    if (!carpeta || vistas[carpeta]) continue;
    vistas[carpeta] = true;

    var token = null;
    do {
      var r = Drive.Files.list({
        q: "'" + carpeta + "' in parents and trashed = false and " +
           "(mimeType contains 'image/' or mimeType contains 'video/' or " +
           "mimeType = 'application/vnd.google-apps.folder')",
        fields: 'nextPageToken, files(id, mimeType, createdTime, size, ' +
                'imageMediaMetadata(width, height, rotation, time, location), ' +
                'videoMediaMetadata(width, height, durationMillis))',
        pageSize: 1000,
        pageToken: token,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      (r.files || []).forEach(function (f) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          pendientes.push(f.id);
          return;
        }
        ultimoResumen_.porTipo[f.mimeType] = (ultimoResumen_.porTipo[f.mimeType] || 0) + 1;
        if (/^video\//.test(f.mimeType)) {
          var v = videoDeArchivo_(f);
          if (v) fotos.push(v); else ultimoResumen_.videosSalteados++;
          return;
        }
        var m = f.imageMediaMetadata || {};
        var foto = { id: f.id, fecha: fechaExif_(m.time) || f.createdTime };
        if (m.location && m.location.latitude) foto._coord = [m.location.latitude, m.location.longitude]; // LugaresFotos.gs
        if (m.width && m.height) {
          var girada = m.rotation === 1 || m.rotation === 3;
          foto.ancho = girada ? m.height : m.width;
          foto.alto = girada ? m.width : m.height;
          if (m.rotation) foto.rotacion = m.rotation; // para diagnosticar fotos giradas
          else if (PUEDE_TENER_GIRO_.test(f.mimeType)) sinGiro.push(foto);
          fotos.push(foto);
        } else {
          sinTamano.push(foto);
        }
      });
      token = r.nextPageToken;
    } while (token);
  }

  // A algunas fotos (a veces HEIC) Drive no les informa el tamaño:
  // se mide la miniatura JPG que genera Drive y se guarda para no repetirlo.
  ultimoResumen_.sinTamano = sinTamano.length;
  var props = PropertiesService.getScriptProperties();
  sinTamano.forEach(function (foto) {
    var t = tamanoGuardado_(props, foto.id) || medirMiniatura_(props, foto.id);
    if (t) {
      foto.ancho = t.ancho;
      foto.alto = t.alto;
      fotos.push(foto);
      ultimoResumen_.recuperadas++;
    } else {
      ultimoResumen_.descartadas.push(foto.id);
    }
  });

  aplicarGiros_(props, sinGiro, SEGUNDOS_GIROS_POR_LISTA);
  aplicarGirosManuales_(props, fotos);
  ponerLugares_(fotos, SEGUNDOS_LUGARES_POR_LISTA);
  guardarDatosFotos_();

  guardarCacheGrande_(cache, 'lista', fotos, MINUTOS_CACHE_LISTA * 60);
  return fotos;
}

/*
 * Algunas fotos del iPhone (HEIC) guardan el giro de una forma que Drive no lee:
 * Drive dice "sin giro" y su miniatura sale acostada o boca abajo. Para esas se lee
 * el comienzo del archivo y se manda `girar` (grados, sentido horario): el panel
 * gira la miniatura antes de mostrarla. El resultado queda guardado (gir_<id>, ver DatosFotos.gs).
 */
var PUEDE_TENER_GIRO_ = /^image\/(heic|heif|jpeg)/;
var SEGUNDOS_GIROS_POR_LISTA = 10;

function aplicarGiros_(props, fotos, segundos) {
  var hasta = Date.now() + segundos * 1000;
  var pendientes = 0;
  fotos.forEach(function (foto) {
    var g = datoFoto_('gir_' + foto.id);
    if (g === undefined || g === null) {
      if (Date.now() > hasta) { pendientes++; return; }
      g = leerGiro_(foto.id);
      if ((g === 90 || g === 270) && miniaturaYaGirada_(foto)) g = 0;
      g = String(g);
      guardarDatoFoto_('gir_' + foto.id, g);
    }
    g = Number(g);
    if (!g) return;
    foto.girar = g;
    if (g === 90 || g === 270) {
      var a = foto.ancho; foto.ancho = foto.alto; foto.alto = a;
    }
  });
  if (ultimoResumen_) ultimoResumen_.girosPendientes = pendientes;
  return pendientes;
}

/*
 * Giros hechos a mano desde el panel (mantener apretada la foto). Sirven para las
 * fotos que perdieron el dato de giro (pasadas por WhatsApp, editadas, etc.).
 */
function girarFoto_(id, grados) {
  if (!id) throw new Error('Falta el id de la foto');
  if (grados % 90) throw new Error('Los grados tienen que ser múltiplo de 90');
  var total = (((Number(datoFoto_('man_' + id)) || 0) + grados) % 360 + 360) % 360;
  guardarDatoFoto_('man_' + id, total ? String(total) : null);
  guardarDatosFotos_();
  CacheService.getScriptCache().remove('lista_n');
  return { id: id, manual: total };
}

function aplicarGirosManuales_(props, fotos) {
  fotos.forEach(function (foto) {
    var m = Number(datoFoto_('man_' + foto.id)) || 0;
    if (!m || foto.video) return;
    foto.girar = ((foto.girar || 0) + m) % 360;
    if (!foto.girar) delete foto.girar;
    if (m === 90 || m === 270) {
      var a = foto.ancho; foto.ancho = foto.alto; foto.alto = a;
    }
  });
}

/** ¿Drive ya giró la miniatura? (entonces no hay que girarla de nuevo) */
function miniaturaYaGirada_(foto) {
  try {
    var f = Drive.Files.get(foto.id, { fields: 'thumbnailLink', supportsAllDrives: true });
    if (!f.thumbnailLink) return false;
    var resp = UrlFetchApp.fetch(f.thumbnailLink.replace(/=s\d+$/, '') + '=s200', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    var t = resp.getResponseCode() === 200 && tamanoImagen_(resp.getContent());
    if (!t || t.ancho === t.alto || foto.ancho === foto.alto) return false;
    return (t.ancho > t.alto) !== (foto.ancho > foto.alto);
  } catch (e) {
    return false;
  }
}

/** Grados (horario) que hay que girar la foto, leyendo los primeros 128 KB. */
function leerGiro_(id) {
  try {
    var resp = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
      '?alt=media&supportsAllDrives=true', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=0-131071' },
      muteHttpExceptions: true
    });
    var c = resp.getResponseCode();
    if (c !== 200 && c !== 206) return 0;
    return giroDeBytes_(resp.getContent());
  } catch (e) {
    return 0;
  }
}

function giroDeBytes_(bytes) {
  var b = function (i) { return bytes[i] & 255; };
  if (b(0) === 0xFF && b(1) === 0xD8) return giroDeOrientacion_(orientacionJpeg_(bytes));
  return giroDeHeic_(bytes);
}

/** Orientación EXIF (1-8) → grados en sentido horario (los espejados, aproximados). */
function giroDeOrientacion_(o) {
  return { 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 }[o] || 0;
}

function orientacionJpeg_(bytes) {
  var b = function (i) { return bytes[i] & 255; };
  var i = 2;
  while (i + 4 < bytes.length && b(i) === 0xFF) {
    var marca = b(i + 1);
    var largo = b(i + 2) << 8 | b(i + 3);
    if (marca === 0xE1 && b(i + 4) === 0x45 && b(i + 5) === 0x78 && b(i + 6) === 0x69 && b(i + 7) === 0x66) {
      return orientacionTiff_(bytes, i + 10);
    }
    if (marca === 0xDA) break; // empieza la imagen: no hay EXIF
    i += 2 + largo;
  }
  return 1;
}

function orientacionTiff_(bytes, t) {
  var b = function (i) { return bytes[i] & 255; };
  var le = b(t) === 0x49;
  var u16 = function (i) { return le ? b(i) | b(i + 1) << 8 : b(i) << 8 | b(i + 1); };
  var u32 = function (i) { return le ? (b(i) | b(i + 1) << 8 | b(i + 2) << 16 | b(i + 3) << 24) >>> 0 : (b(i) << 24 | b(i + 1) << 16 | b(i + 2) << 8 | b(i + 3)) >>> 0; };
  var ifd = t + u32(t + 4);
  var n = u16(ifd);
  for (var k = 0; k < n; k++) {
    var e = ifd + 2 + k * 12;
    if (e + 12 > bytes.length) break;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return 1;
}

/*
 * HEIC: cajas ISO (tamaño + tipo). El giro está en meta → iprp → ipco → irot
 * (vueltas de 90° en sentido antihorario). Si no está, se busca la orientación EXIF.
 */
function giroDeHeic_(bytes) {
  var b = function (i) { return bytes[i] & 255; };
  var tipo = function (i) { return String.fromCharCode(b(i + 4), b(i + 5), b(i + 6), b(i + 7)); };
  var largo = function (i) { return (b(i) << 24 | b(i + 1) << 16 | b(i + 2) << 8 | b(i + 3)) >>> 0; };
  function buscar(desde, hasta, nombre) {
    var i = desde;
    while (i + 8 <= hasta && i + 8 <= bytes.length) {
      var l = largo(i);
      if (tipo(i) === nombre) return { inicio: i, fin: Math.min(i + (l || hasta - i), hasta) };
      if (l < 8) return null;
      i += l;
    }
    return null;
  }
  if (tipo(0) !== 'ftyp') return 0;
  var meta = buscar(0, bytes.length, 'meta');
  if (!meta) return 0;
  var iprp = buscar(meta.inicio + 12, meta.fin, 'iprp'); // meta es "full box": 4 bytes más
  var ipco = iprp && buscar(iprp.inicio + 8, iprp.fin, 'ipco');
  var irot = ipco && buscar(ipco.inicio + 8, ipco.fin, 'irot');
  if (irot) return ((4 - (b(irot.inicio + 8) & 3)) % 4) * 90;
  // Sin irot: orientación EXIF, si quedó dentro de lo leído.
  for (var i = 0; i + 10 < bytes.length; i++) {
    if (b(i) === 0x45 && b(i + 1) === 0x78 && b(i + 2) === 0x69 && b(i + 3) === 0x66 && b(i + 4) === 0 && b(i + 5) === 0) {
      return giroDeOrientacion_(orientacionTiff_(bytes, i + 6));
    }
  }
  return 0;
}

/**
 * Para correr una vez desde el editor: revisa el giro de todas las fotos
 * (al listar se revisan de a poco). Si se corta por tiempo, correrla de nuevo.
 */
function revisarGiros() {
  CacheService.getScriptCache().remove('lista_n');
  var props = PropertiesService.getScriptProperties();
  ultimoResumen_ = null;
  var fotos = listarFotosSinGiros_();
  var pendientes = aplicarGiros_(props, fotos, 300);
  guardarDatosFotos_();
  var giradas = fotos.filter(function (f) { return f.girar; });
  Logger.log('Fotos revisadas: ' + (fotos.length - pendientes) + ' de ' + fotos.length +
    '. Con giro que Drive no informa: ' + giradas.length +
    (pendientes ? '. Faltan ' + pendientes + ': volvé a ejecutar revisarGiros.' : '. Listo.'));
  CacheService.getScriptCache().remove('lista_n');
}

/** Fotos que Drive informa "sin giro" (para revisarGiros). */
function listarFotosSinGiros_() {
  var pendientes = propiedad_('CARPETAS').split(',').map(function (s) { return s.trim(); });
  var vistas = {};
  var out = [];
  while (pendientes.length) {
    var carpeta = pendientes.shift();
    if (!carpeta || vistas[carpeta]) continue;
    vistas[carpeta] = true;
    var token = null;
    do {
      var r = Drive.Files.list({
        q: "'" + carpeta + "' in parents and trashed = false and " +
           "(mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder')",
        fields: 'nextPageToken, files(id, mimeType, imageMediaMetadata(width, height, rotation))',
        pageSize: 1000, pageToken: token, supportsAllDrives: true, includeItemsFromAllDrives: true
      });
      (r.files || []).forEach(function (f) {
        if (f.mimeType === 'application/vnd.google-apps.folder') { pendientes.push(f.id); return; }
        var m = f.imageMediaMetadata || {};
        if (!m.rotation && PUEDE_TENER_GIRO_.test(f.mimeType)) out.push({ id: f.id, ancho: m.width, alto: m.height });
      });
      token = r.nextPageToken;
    } while (token);
  }
  return out;
}

var ultimoResumen_ = null;

var VIDEO_MIN_SEGUNDOS = 4;       // más cortos son Live Photos del iPhone: se saltean
var VIDEO_MAX_MB = 100;           // más pesados tardarían demasiado en bajar al marco
var VIDEO_PARTE_BYTES = 6 * 1024 * 1024;

/**
 * Un video de Drive como item de la lista, o null si no conviene mostrarlo.
 * Drive tarda un rato en procesar los videos recién subidos: hasta entonces
 * no informa la duración y el video aparece en una próxima vuelta.
 */
function videoDeArchivo_(f) {
  var m = f.videoMediaMetadata || {};
  var segundos = Number(m.durationMillis) / 1000;
  var bytes = Number(f.size) || 0;
  if (!segundos || segundos < VIDEO_MIN_SEGUNDOS) return null;
  if (!bytes || bytes > VIDEO_MAX_MB * 1024 * 1024) return null;
  return {
    id: f.id,
    video: true,
    mime: f.mimeType,
    ancho: Number(m.width) || 1920,
    alto: Number(m.height) || 1080,
    segundos: Math.round(segundos),
    bytes: bytes,
    fecha: f.createdTime
  };
}

/**
 * Una parte del video, en base64. El marco pide las partes de a una y las junta.
 * Apps Script no puede devolver binario ni respuestas muy grandes, por eso las partes.
 */
function videoParte_(id, parte) {
  if (!id) throw new Error('Falta el id del video');
  parte = Math.max(0, Math.floor(parte) || 0);
  var desde = parte * VIDEO_PARTE_BYTES;
  var resp = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
    '?alt=media&supportsAllDrives=true', {
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      Range: 'bytes=' + desde + '-' + (desde + VIDEO_PARTE_BYTES - 1)
    },
    muteHttpExceptions: true
  });
  var codigo = resp.getResponseCode();
  if (codigo === 416) return { parte: parte, total: desde, partes: parte, data: '' };
  if (codigo !== 200 && codigo !== 206) throw new Error('Drive respondió ' + codigo + ' al bajar el video');
  var bytes = resp.getContent();
  var total = totalDeRango_(resp.getHeaders()['Content-Range']) || (codigo === 200 ? bytes.length : null);
  if (codigo === 200 && bytes.length > VIDEO_PARTE_BYTES) bytes = bytes.slice(desde, desde + VIDEO_PARTE_BYTES);
  return {
    parte: parte,
    total: total,
    partes: total ? Math.ceil(total / VIDEO_PARTE_BYTES) : null,
    data: Utilities.base64Encode(bytes)
  };
}

/** "bytes 0-99/1234" → 1234 */
function totalDeRango_(rango) {
  var m = String(rango || '').match(/\/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function tamanoGuardado_(props, id) {
  var v = datoFoto_('tam_' + id);
  if (!v) return null;
  var p = v.split('x');
  return { ancho: Number(p[0]), alto: Number(p[1]) };
}

function medirMiniatura_(props, id) {
  try {
    var f = Drive.Files.get(id, { fields: 'thumbnailLink', supportsAllDrives: true });
    if (!f.thumbnailLink) return null;
    var url = f.thumbnailLink.replace(/=s\d+$/, '') + '=s400';
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) return null;
    var t = tamanoImagen_(resp.getContent());
    if (t) guardarDatoFoto_('tam_' + id, t.ancho + 'x' + t.alto);
    return t;
  } catch (e) {
    return null;
  }
}

/** Lee ancho y alto de los bytes de un JPG o PNG, sin decodificar la imagen. */
function tamanoImagen_(bytes) {
  var b = function (i) { return bytes[i] & 255; };
  if (b(0) === 0x89 && b(1) === 0x50) { // PNG
    return { ancho: (b(16) << 24 | b(17) << 16 | b(18) << 8 | b(19)) >>> 0,
             alto: (b(20) << 24 | b(21) << 16 | b(22) << 8 | b(23)) >>> 0 };
  }
  if (b(0) !== 0xFF || b(1) !== 0xD8) return null; // no es JPG
  var i = 2;
  while (i + 9 < bytes.length) {
    if (b(i) !== 0xFF) return null;
    var marca = b(i + 1);
    var largo = b(i + 2) << 8 | b(i + 3);
    var esSOF = marca >= 0xC0 && marca <= 0xCF && marca !== 0xC4 && marca !== 0xC8 && marca !== 0xCC;
    if (esSOF) return { alto: b(i + 5) << 8 | b(i + 6), ancho: b(i + 7) << 8 | b(i + 8) };
    i += 2 + largo;
  }
  return null;
}

/** Eventos desde el comienzo de hoy hasta dentro de `dias` días. */
function agenda_(dias) {
  dias = Math.max(1, Math.min(dias, 31));
  var cache = CacheService.getScriptCache();
  var clave = 'agenda_' + dias;
  var guardada = cache.get(clave);
  if (guardada) return JSON.parse(guardada);

  var ids = PropertiesService.getScriptProperties().getProperty('CALENDARIOS');
  var calendarios = ids
    ? ids.split(',').map(function (s) { return CalendarApp.getCalendarById(s.trim()); })
        .filter(function (c) { return c; })
    : CalendarApp.getAllCalendars().filter(function (c) { return c.isSelected() && !c.isHidden(); });
  // El calendario de los agentes es para los teléfonos: el panel ya muestra todo eso.
  var auto = PropertiesService.getScriptProperties().getProperty('AGENDA_AUTO_ID');
  calendarios = calendarios.filter(function (c) { return c.getId() !== auto; });

  var desde = new Date();
  desde.setHours(0, 0, 0, 0);
  var hasta = new Date(desde.getTime() + dias * 86400000);

  var eventos = [];
  calendarios.forEach(function (cal) {
    cal.getEvents(desde, hasta).forEach(function (e) {
      eventos.push({
        titulo: e.getTitle(),
        inicio: e.getStartTime().toISOString(),
        fin: e.getEndTime().toISOString(),
        todoElDia: e.isAllDayEvent(),
        lugar: e.getLocation(),
        calendario: cal.getName(),
        calendarioId: cal.getId(),
        color: cal.getColor()
      });
    });
  });
  eventos.sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
  cache.put(clave, JSON.stringify(eventos), 300);
  return eventos;
}

/** Para probar desde el editor: muestra los calendarios y los próximos eventos. */
function probarAgenda() {
  CacheService.getScriptCache().remove('agenda_7');
  var eventos = agenda_(7);
  var porCalendario = {};
  eventos.forEach(function (e) { porCalendario[e.calendario] = (porCalendario[e.calendario] || 0) + 1; });
  Logger.log('Eventos en los próximos 7 días: ' + eventos.length);
  Logger.log('Por calendario: ' + JSON.stringify(porCalendario));
  Logger.log('Calendarios que ve tu cuenta: ' + CalendarApp.getAllCalendars().map(function (c) {
    return c.getName() + (c.isSelected() && !c.isHidden() ? '' : ' (destildado: no se usa)');
  }).join(' · '));
  Logger.log('Próximos: ' + JSON.stringify(eventos.slice(0, 3), null, 2));
}

/**
 * Partidos del equipo de básquet desde el sitio de la federación (sistema Gesdeportiva).
 *
 * Sigue a Thiago aunque cambie de categoría: con su año de nacimiento calcula la
 * categoría de cada temporada (Cadetes, Juveniles...), busca en el sitio el torneo
 * del año (por ejemplo "formativas-2027") y dentro de esa categoría el equipo del club.
 *
 * Propiedades del script:
 *   BASQUET_NACIMIENTO   año de nacimiento de Thiago (ej. 2011). Sin esto se usa
 *                        la categoría fija de abajo.
 *   BASQUET_CLUB         ARGENTINO DE CASTELAR
 *   BASQUET_EQUIPO       ARGENTINO DE CASTELAR NORTE A  (si el club tiene varios
 *                        equipos en la categoría, se usa este)
 *   BASQUET_RAMA         MASCULINO
 *   BASQUET_TORNEO       formativas  (como aparece en la URL del torneo)
 *   BASQUET_SITIO        https://www.febamba.com
 *   BASQUET_COMPETICION / BASQUET_CATEGORIA  para fijar torneo y categoría a mano
 *                        (los números de la URL y del selector de la página).
 */
var CATEGORIAS_POR_EDAD_ = [
  { desde: 10, hasta: 11, nombre: 'MINI' },
  { desde: 12, hasta: 13, nombre: 'INFANTILES' },
  { desde: 14, hasta: 15, nombre: 'CADETES' },
  { desde: 16, hasta: 17, nombre: 'JUVENILES' }
];

function configBasquet_() {
  var p = PropertiesService.getScriptProperties();
  return {
    sitio: p.getProperty('BASQUET_SITIO') || 'https://www.febamba.com',
    club: p.getProperty('BASQUET_CLUB') || 'ARGENTINO DE CASTELAR',
    equipo: p.getProperty('BASQUET_EQUIPO') || 'ARGENTINO DE CASTELAR NORTE A',
    rama: p.getProperty('BASQUET_RAMA') || 'MASCULINO',
    torneo: p.getProperty('BASQUET_TORNEO') || 'formativas',
    nacimiento: Number(p.getProperty('BASQUET_NACIMIENTO')) || null,
    competicion: p.getProperty('BASQUET_COMPETICION'),
    categoria: p.getProperty('BASQUET_CATEGORIA'),
    calendarioId: p.getProperty('BASQUET_CALENDARIO_ID')
  };
}

/** La categoría según la edad que cumple en el año de la temporada. */
function categoriaPorEdad_(nacimiento, anio) {
  var edad = anio - nacimiento;
  for (var i = 0; i < CATEGORIAS_POR_EDAD_.length; i++) {
    var c = CATEGORIAS_POR_EDAD_[i];
    if (edad >= c.desde && edad <= c.hasta) return c.nombre;
  }
  return null;
}

function hoyMas_(dias) {
  return Utilities.formatDate(new Date(Date.now() + dias * 86400000), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
}

function bajar_(url) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('El sitio de la federación respondió ' + resp.getResponseCode());
  return resp.getContentText();
}

function urlFixture_(sitio, competicion, categoria) {
  return sitio + '/detalle-torneo?handler=CargarSubPagina&competicionId=' + competicion +
    '&compCatId=' + categoria + '&fechaIni=' + hoyMas_(-45) + '&fechaFin=' + hoyMas_(45) +
    '&faseId=0&grupoId=0&seccion=fixture';
}

/** IDs de los torneos cuyo enlace es /detalle-torneo/{id}/{torneo}-{anio}. */
function competicionesDelAnio_(html, torneo, anio) {
  var patron = new RegExp('/detalle-torneo/(\\d+)/' + torneo + '-' + anio + '(?=["/?])', 'gi');
  var ids = {};
  var m;
  while ((m = patron.exec(html))) ids[m[1]] = true;
  return Object.keys(ids);
}

/** Opciones del selector de categoría de la página de un torneo: [{ id, nombre }]. */
function categoriasDeTorneo_(html) {
  var select = (html.match(/<select[^>]*CompeticionHasCategoriaId[\s\S]*?<\/select>/i) || [''])[0];
  return todas_(select, /<option value="(\d+)">\s*([^<]*?)\s*<\/option>/g, 2).map(function (m) {
    return { id: m[0], nombre: decodificarHtml_(m[1]).trim() };
  });
}

/** Nombres de los equipos del club que aparecen en un fixture. */
function equiposDelClub_(html, club) {
  var buscado = normalizarTexto_(club);
  var vistos = {};
  todas_(html, /<strong class="nombre-equipo">([^<]*)<\/strong>/g).forEach(function (n) {
    var nombre = normalizarTexto_(n);
    if (nombre.indexOf(buscado) >= 0) vistos[nombre] = true;
  });
  return Object.keys(vistos).sort();
}

/**
 * Decide qué torneo, categoría y equipo mirar. Devuelve
 * { competicion, categoria, categoriaNombre, equipo, aviso, html (del fixture) }.
 */
function resolverEquipo_(cfg) {
  if (cfg.competicion && cfg.categoria) {
    return { competicion: cfg.competicion, categoria: cfg.categoria, categoriaNombre: '',
             equipo: cfg.equipo, aviso: null,
             html: bajar_(urlFixture_(cfg.sitio, cfg.competicion, cfg.categoria)) };
  }
  if (!cfg.nacimiento) {
    // Sin año de nacimiento: Cadetes Masculino de Formativas 2026, como al principio.
    return { competicion: '2015', categoria: '5077', categoriaNombre: 'CADETES MASCULINO',
             equipo: cfg.equipo, aviso: 'Falta el año de nacimiento (BASQUET_NACIMIENTO)',
             html: bajar_(urlFixture_(cfg.sitio, '2015', '5077')) };
  }

  var portada = bajar_(cfg.sitio + '/');
  var anio = Number(Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy'));
  // Primero la temporada de este año; si todavía no empezó, la anterior.
  for (var a = anio; a >= anio - 1; a--) {
    var catNombre = categoriaPorEdad_(cfg.nacimiento, a);
    if (!catNombre) continue;
    var comps = competicionesDelAnio_(portada, cfg.torneo, a);
    for (var i = 0; i < comps.length; i++) {
      var pagina = bajar_(cfg.sitio + '/detalle-torneo/' + comps[i] + '/' + cfg.torneo + '-' + a);
      var cat = categoriasDeTorneo_(pagina).filter(function (c) {
        var n = normalizarTexto_(c.nombre);
        return n.indexOf(catNombre) >= 0 && n.indexOf(normalizarTexto_(cfg.rama)) >= 0;
      })[0];
      if (!cat) continue;
      var html = bajar_(urlFixture_(cfg.sitio, comps[i], cat.id));
      var equipos = equiposDelClub_(html, cfg.club);
      if (!equipos.length) continue;
      var preferido = normalizarTexto_(cfg.equipo);
      var elegido = equipos.indexOf(preferido) >= 0 ? preferido : equipos[0];
      var aviso = null;
      if (elegido !== preferido && equipos.length > 1) {
        aviso = 'El club tiene varios equipos en ' + cat.nombre + ': ' + equipos.join(', ') +
          '. Poné el de Thiago en BASQUET_EQUIPO.';
      }
      return { competicion: comps[i], categoria: cat.id, categoriaNombre: cat.nombre,
               equipo: elegido, aviso: aviso, html: html };
    }
  }
  return null;
}

function basquet_() {
  var cache = CacheService.getScriptCache();
  var guardada = cache.get('basquet');
  if (guardada) return JSON.parse(guardada);

  var cfg = configBasquet_();
  var r = resolverEquipo_(cfg);
  var datos = r ? {
    equipo: r.equipo,
    categoria: r.categoriaNombre,
    aviso: r.aviso,
    partidos: partidosDelEquipo_(r.html, r.equipo, cfg.sitio)
  } : {
    equipo: cfg.equipo,
    categoria: '',
    aviso: 'No encontré equipos de ' + cfg.club + ' en los torneos de este año.',
    partidos: []
  };
  // Si los partidos se copian a Google Calendar, el panel no los agrega de nuevo.
  datos.sincronizado = !!cfg.calendarioId;
  datos.actualizado = new Date().toISOString();
  cache.put('basquet', JSON.stringify(datos), 3600);
  return datos;
}

/** "PEDRO ECHAGÜE AZUL" → "Pedro Echagüe Azul" */
function nombreLindo_(s) {
  var chicas = { DE: 'de', DEL: 'del', LA: 'la', LAS: 'las', LOS: 'los', Y: 'y', EL: 'el' };
  return String(s || '').trim().split(/\s+/).map(function (p, i) {
    var may = p.toUpperCase();
    if (i > 0 && chicas[may]) return chicas[may];
    if (p.length <= 2) return may;
    return may.charAt(0) + may.slice(1).toLowerCase();
  }).join(' ');
}

/** Título, descripción y lugar del evento de calendario de un partido. */
function eventoDePartido_(p, equipo) {
  var esLocal = normalizarTexto_(p.local.nombre) === normalizarTexto_(equipo);
  var propio = esLocal ? p.local : p.visitante;
  var rival = esLocal ? p.visitante : p.local;
  var jugado = propio.puntos !== null && rival.puntos !== null;
  var titulo = jugado
    ? '🏀 ' + (propio.puntos > rival.puntos ? 'Ganaron ' : 'Perdieron ') + propio.puntos + '–' + rival.puntos +
      ' vs ' + nombreLindo_(rival.nombre)
    : '🏀 Básquet vs ' + nombreLindo_(rival.nombre);
  return {
    clave: normalizarTexto_(p.local.nombre) + ' | ' + normalizarTexto_(p.visitante.nombre),
    titulo: titulo,
    inicio: new Date(p.fecha),
    fin: new Date(new Date(p.fecha).getTime() + 2 * 3600000),
    lugar: p.cancha,
    descripcion: nombreLindo_(p.local.nombre) + ' vs ' + nombreLindo_(p.visitante.nombre) +
      (esLocal ? ' (de local)' : ' (de visitante)') + '\nActualizado automáticamente desde FeBAMBA.'
  };
}

/**
 * Copia los partidos a un calendario "Básquet Thiago" de tu Google Calendar y los
 * mantiene al día (horario, cancha y resultado). Lo corre solo cada 3 horas
 * una vez que ejecutás activarSincronizacionBasquet.
 */
function sincronizarCalendarioBasquet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('BASQUET_CALENDARIO_ID');
  var cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    cal = CalendarApp.createCalendar('Básquet Thiago', { color: CalendarApp.Color.YELLOW });
    props.setProperty('BASQUET_CALENDARIO_ID', cal.getId());
  }
  CacheService.getScriptCache().remove('basquet');
  var datos = basquet_();

  var existentes = {};
  cal.getEvents(new Date(Date.now() - 60 * 86400000), new Date(Date.now() + 90 * 86400000)).forEach(function (e) {
    var clave = e.getTag('basquet');
    if (clave) existentes[clave] = e;
  });

  var usadas = {};
  var creados = 0, actualizados = 0;
  datos.partidos.forEach(function (p) {
    var ev = eventoDePartido_(p, datos.equipo);
    // Si se enfrentan dos veces con la misma localía, la segunda lleva " #2".
    var clave = ev.clave, n = 2;
    while (usadas[clave]) clave = ev.clave + ' #' + n++;
    usadas[clave] = true;

    var e = existentes[clave];
    if (!e) {
      e = cal.createEvent(ev.titulo, ev.inicio, ev.fin, { location: ev.lugar, description: ev.descripcion });
      e.setTag('basquet', clave);
      creados++;
      if (typeof registrar_ === 'function') registrar_('Básquet', 'Agendé ' + ev.titulo + ' (' +
        Utilities.formatDate(ev.inicio, 'America/Argentina/Buenos_Aires', "EEE d/M HH:mm") + ').');
      return;
    }
    var cambio = false;
    if (e.getTitle() !== ev.titulo) { e.setTitle(ev.titulo); cambio = true; }
    if (e.getStartTime().getTime() !== ev.inicio.getTime()) { e.setTime(ev.inicio, ev.fin); cambio = true; }
    if (e.getLocation() !== ev.lugar) { e.setLocation(ev.lugar); cambio = true; }
    if (cambio) {
      actualizados++;
      if (typeof registrar_ === 'function') registrar_('Básquet', 'Cambió ' + ev.titulo + ': lo actualicé en el calendario.');
    }
  });
  Logger.log('Calendario "' + cal.getName() + '": ' + creados + ' partidos nuevos, ' + actualizados + ' actualizados.');
}

/** Ejecutalo una vez: crea el calendario, copia los partidos y deja la actualización automática. */
function activarSincronizacionBasquet() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarCalendarioBasquet') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizarCalendarioBasquet').timeBased().everyHours(3).create();
  sincronizarCalendarioBasquet();
}

/** Lee las filas del fixture (HTML) y devuelve los partidos donde juega `equipo`. */
function partidosDelEquipo_(html, equipo, sitio) {
  var buscado = normalizarTexto_(equipo);
  var partidos = [];
  (html.match(/<tr[^>]*datos-estadisticos[\s\S]*?<\/tr>/gi) || []).forEach(function (fila) {
    var nombres = todas_(fila, /<strong class="nombre-equipo">([^<]*)<\/strong>/g);
    if (nombres.length < 2) return;
    if (normalizarTexto_(nombres[0]) !== buscado && normalizarTexto_(nombres[1]) !== buscado) return;
    var escudos = todas_(fila, /<img src="([^"]+)"/g);
    var puntos = todas_(fila, /<td class="resultados">\s*<strong>([^<]*)<\/strong>/g);
    var cuando = fila.match(/fecha-campo[\s\S]*?<strong>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s*<\/strong>(?:\s*<small>([^<]*)<\/small>)?/);
    if (!cuando) return;
    var lado = function (i) {
      return {
        nombre: decodificarHtml_(nombres[i]).trim(),
        escudo: escudos[i] ? (/^https?:/.test(escudos[i]) ? escudos[i] : sitio + escudos[i]) : null,
        puntos: /^\d+$/.test((puntos[i] || '').trim()) ? Number(puntos[i]) : null
      };
    };
    var local = lado(0), visitante = lado(1);
    // El sitio muestra "0 – 0" en los partidos que todavía no se jugaron.
    if (local.puntos === 0 && visitante.puntos === 0) local.puntos = visitante.puntos = null;
    partidos.push({
      // Argentina no tiene horario de verano: siempre UTC-3.
      fecha: cuando[3] + '-' + cuando[2] + '-' + cuando[1] + 'T' + cuando[4] + ':' + cuando[5] + ':00-03:00',
      cancha: cuando[6] ? decodificarHtml_(cuando[6]).trim() : '',
      local: local,
      visitante: visitante
    });
  });
  partidos.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  return partidos;
}

/** Todas las coincidencias del primer grupo, o de los `grupos` primeros grupos como lista. */
function todas_(texto, patron, grupos) {
  var res = [], m;
  while ((m = patron.exec(texto))) res.push(grupos ? m.slice(1, grupos + 1) : m[1]);
  return res;
}

function normalizarTexto_(s) {
  return decodificarHtml_(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

function decodificarHtml_(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); })
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Para probar desde el editor: muestra los partidos encontrados. */
function probarBasquet() {
  CacheService.getScriptCache().remove('basquet');
  var d = basquet_();
  Logger.log('Equipo: ' + d.equipo + ' · ' + (d.categoria || '') + ' · partidos encontrados: ' + d.partidos.length);
  if (d.aviso) Logger.log('Aviso: ' + d.aviso);
  d.partidos.forEach(function (p) {
    Logger.log(p.fecha.slice(0, 16) + '  ' + p.local.nombre + ' ' + (p.local.puntos === null ? '-' : p.local.puntos) +
      ' – ' + (p.visitante.puntos === null ? '-' : p.visitante.puntos) + ' ' + p.visitante.nombre + '  (' + p.cancha + ')');
  });
}

/** "2024:07:15 18:22:01" (EXIF) → "2024-07-15T18:22:01" */
function fechaExif_(t) {
  if (!t) return null;
  var m = String(t).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] : null;
}

/** Devuelve la foto achicada al ancho pedido, en base64. */
function imagen_(id, ancho) {
  if (!id) throw new Error('Falta el id de la foto');
  ancho = Math.max(200, Math.min(ancho, 2400));
  var f = Drive.Files.get(id, { fields: 'thumbnailLink, mimeType', supportsAllDrives: true });
  if (!f.thumbnailLink) throw new Error('Drive todavía no generó la miniatura de ' + id);
  var url = f.thumbnailLink.replace(/=s\d+$/, '') + '=s' + ancho;
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  var tipo = resp.getHeaders()['Content-Type'] || 'image/jpeg';
  return { mime: tipo, data: Utilities.base64Encode(resp.getContent()) };
}

/* CacheService admite hasta 100 KB por clave: la lista se parte en trozos. */
function guardarCacheGrande_(cache, clave, valor, segundos) {
  var texto = JSON.stringify(valor);
  var trozo = 90000;
  var partes = {};
  var n = Math.ceil(texto.length / trozo);
  for (var i = 0; i < n; i++) partes[clave + '_' + i] = texto.slice(i * trozo, (i + 1) * trozo);
  partes[clave + '_n'] = String(n);
  cache.putAll(partes, segundos);
}

function leerCacheGrande_(cache, clave) {
  var n = Number(cache.get(clave + '_n'));
  if (!n) return null;
  var claves = [];
  for (var i = 0; i < n; i++) claves.push(clave + '_' + i);
  var partes = cache.getAll(claves);
  var texto = '';
  for (var j = 0; j < n; j++) {
    if (partes[claves[j]] == null) return null;
    texto += partes[claves[j]];
  }
  return JSON.parse(texto);
}

/** Para probar desde el editor: muestra cuántas fotos encontró y las primeras 3. */
function probar() {
  CacheService.getScriptCache().remove('lista_n');
  var fotos = listarFotos_();
  var r = ultimoResumen_;
  Logger.log('Fotos que se van a mostrar: ' + fotos.length);
  Logger.log('Por tipo de archivo: ' + JSON.stringify(r.porTipo));
  Logger.log('Sin tamaño informado por Drive: ' + r.sinTamano +
             ' (recuperadas midiendo la miniatura: ' + r.recuperadas + ')');
  if (r.descartadas.length) Logger.log('No se pudieron mostrar: ' + r.descartadas.join(', '));
  Logger.log('Fotos con lugar: ' + fotos.filter(function (f) { return f.lugar; }).length +
    (r.lugaresPendientes ? ' · faltan buscar ' + r.lugaresPendientes + ' lugares (se completan en las próximas vueltas)' : ''));
  var giradas = fotos.filter(function (f) { return f.girar; }).length;
  Logger.log('Fotos con giro que Drive no informa (las gira el panel): ' + giradas +
    (r.girosPendientes ? ' · faltan revisar ' + r.girosPendientes + ' (ejecutá revisarGiros)' : ''));
  var videos = fotos.filter(function (f) { return f.video; });
  Logger.log('Videos: ' + videos.length + ' (salteados por cortos —Live Photos—, pesados o sin procesar: ' +
             r.videosSalteados + ')');
  Logger.log('Ejemplo: ' + JSON.stringify(fotos.slice(0, 2), null, 2));
}
