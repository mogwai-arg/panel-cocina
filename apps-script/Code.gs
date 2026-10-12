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
 * Pedidos:
 *   ?action=lista&token=...            → { fotos: [{ id, ancho, alto, fecha }] }
 *   ?action=img&id=...&ancho=1600&token=...  → { mime, data (base64) }
 */

var MINUTOS_CACHE_LISTA = 30;

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (!p.token || p.token !== propiedad_('TOKEN')) return json_({ error: 'Token inválido' });
    if (p.action === 'lista') return json_({ fotos: listarFotos_() });
    if (p.action === 'img') return json_(imagen_(p.id, Number(p.ancho) || 1600));
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
