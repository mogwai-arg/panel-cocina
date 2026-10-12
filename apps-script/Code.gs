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
 *   ?action=img&id=...&ancho=1600&token=...  → { mime, data (base64) }
 *   ?action=agenda&dias=7&token=...    → { eventos: [{ titulo, inicio, fin, todoElDia,
 *                                          lugar, calendario, color }] }
 *   ?action=basquet&token=...          → { equipo, actualizado, partidos: [{ fecha, cancha,
 *                                          local: { nombre, escudo, puntos }, visitante }] }
 */

var MINUTOS_CACHE_LISTA = 30;

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (!p.token || p.token !== propiedad_('TOKEN')) return json_({ error: 'Token inválido' });
    if (p.action === 'lista') return json_({ fotos: listarFotos_() });
    if (p.action === 'img') return json_(imagen_(p.id, Number(p.ancho) || 1600));
    if (p.action === 'agenda') return json_({ eventos: agenda_(Number(p.dias) || 7) });
    if (p.action === 'basquet') return json_(basquet_());
    return json_({ error: 'Acción desconocida: ' + p.action });
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
  ultimoResumen_ = { porTipo: {}, sinTamano: 0, recuperadas: 0, descartadas: [] };

  while (pendientes.length) {
    var carpeta = pendientes.shift();
    if (!carpeta || vistas[carpeta]) continue;
    vistas[carpeta] = true;

    var token = null;
    do {
      var r = Drive.Files.list({
        q: "'" + carpeta + "' in parents and trashed = false and " +
           "(mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder')",
        fields: 'nextPageToken, files(id, mimeType, createdTime, ' +
                'imageMediaMetadata(width, height, rotation, time))',
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
        var m = f.imageMediaMetadata || {};
        var foto = { id: f.id, fecha: fechaExif_(m.time) || f.createdTime };
        if (m.width && m.height) {
          var girada = m.rotation === 1 || m.rotation === 3;
          foto.ancho = girada ? m.height : m.width;
          foto.alto = girada ? m.width : m.height;
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

  guardarCacheGrande_(cache, 'lista', fotos, MINUTOS_CACHE_LISTA * 60);
  return fotos;
}

var ultimoResumen_ = null;

function tamanoGuardado_(props, id) {
  var v = props.getProperty('tam_' + id);
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
    if (t) props.setProperty('tam_' + id, t.ancho + 'x' + t.alto);
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
  Logger.log('Próximos: ' + JSON.stringify(eventos.slice(0, 3), null, 2));
}

/**
 * Partidos del equipo de básquet desde el sitio de la federación (sistema Gesdeportiva).
 * Lee el mismo fixture que muestra la página del torneo y se queda con los del equipo.
 *
 * Propiedades opcionales (los valores por defecto son los de Thiago):
 *   BASQUET_SITIO        https://www.febamba.com
 *   BASQUET_COMPETICION  2015  (Formativas 2026, sale de la URL del torneo)
 *   BASQUET_CATEGORIA    5077  (Cadetes Masculino)
 *   BASQUET_EQUIPO       ARGENTINO DE CASTELAR NORTE A
 */
function basquet_() {
  var cache = CacheService.getScriptCache();
  var guardada = cache.get('basquet');
  if (guardada) return JSON.parse(guardada);

  var props = PropertiesService.getScriptProperties();
  var sitio = props.getProperty('BASQUET_SITIO') || 'https://www.febamba.com';
  var competicion = props.getProperty('BASQUET_COMPETICION') || '2015';
  var categoria = props.getProperty('BASQUET_CATEGORIA') || '5077';
  var equipo = props.getProperty('BASQUET_EQUIPO') || 'ARGENTINO DE CASTELAR NORTE A';

  var fecha = function (dias) {
    return Utilities.formatDate(new Date(Date.now() + dias * 86400000), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  };
  var url = sitio + '/detalle-torneo?handler=CargarSubPagina&competicionId=' + competicion +
    '&compCatId=' + categoria + '&fechaIni=' + fecha(-45) + '&fechaFin=' + fecha(45) +
    '&faseId=0&grupoId=0&seccion=fixture';
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('El sitio de la federación respondió ' + resp.getResponseCode());

  var datos = {
    equipo: equipo,
    partidos: partidosDelEquipo_(resp.getContentText(), equipo, sitio),
    actualizado: new Date().toISOString()
  };
  cache.put('basquet', JSON.stringify(datos), 3600);
  return datos;
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
    partidos.push({
      // Argentina no tiene horario de verano: siempre UTC-3.
      fecha: cuando[3] + '-' + cuando[2] + '-' + cuando[1] + 'T' + cuando[4] + ':' + cuando[5] + ':00-03:00',
      cancha: cuando[6] ? decodificarHtml_(cuando[6]).trim() : '',
      local: lado(0),
      visitante: lado(1)
    });
  });
  partidos.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  return partidos;
}

function todas_(texto, patron) {
  var res = [], m;
  while ((m = patron.exec(texto))) res.push(m[1]);
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

/**
 * Diagnóstico temporal: busca a Thiago en las secciones de jugadores del torneo
 * para ver si el sitio tiene una página por jugador. Copiá el registro y pasáselo a Claude.
 */
function explorarJugador() {
  var sitio = 'https://www.febamba.com';
  var buscado = 'THIAGO';
  var fecha = function (dias) {
    return Utilities.formatDate(new Date(Date.now() + dias * 86400000), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  };
  ['comparativa-jugador', 'lideres', 'jugadores', 'equipos'].forEach(function (seccion) {
    var url = sitio + '/detalle-torneo?handler=CargarSubPagina&competicionId=2015&compCatId=5077' +
      '&fechaIni=' + fecha(-300) + '&fechaFin=' + fecha(60) + '&faseId=0&grupoId=0&seccion=' + seccion;
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var html = resp.getContentText();
    Logger.log('==== ' + seccion + ': respuesta ' + resp.getResponseCode() + ', ' + html.length + ' caracteres');
    var enlaces = {};
    (html.match(/href="([^"#]+)"/g) || []).forEach(function (h) {
      enlaces[h.replace(/href="|"/g, '').replace(/\d+/g, 'N')] = h;
    });
    Logger.log('Tipos de enlace (con un ejemplo): ' + JSON.stringify(enlaces).slice(0, 1500));
    var filas = (html.match(/<tr[\s\S]*?<\/tr>/gi) || []).filter(function (f) {
      return f.toUpperCase().indexOf(buscado) >= 0 && /castelar/i.test(f);
    });
    Logger.log('Filas con ' + buscado + ' y Castelar: ' + filas.length);
    filas.slice(0, 3).forEach(function (f) { Logger.log(f.replace(/\s+/g, ' ').slice(0, 2500)); });
  });
}

/** Para probar desde el editor: muestra los partidos encontrados. */
function probarBasquet() {
  CacheService.getScriptCache().remove('basquet');
  var d = basquet_();
  Logger.log('Equipo: ' + d.equipo + ' · partidos encontrados: ' + d.partidos.length);
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
  Logger.log('Ejemplo: ' + JSON.stringify(fotos.slice(0, 2), null, 2));
}
