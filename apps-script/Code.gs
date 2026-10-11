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
        var m = f.imageMediaMetadata;
        if (!m || !m.width || !m.height) return;
        var girada = m.rotation === 1 || m.rotation === 3;
        fotos.push({
          id: f.id,
          ancho: girada ? m.height : m.width,
          alto: girada ? m.width : m.height,
          fecha: fechaExif_(m.time) || f.createdTime
        });
      });
      token = r.nextPageToken;
    } while (token);
  }

  guardarCacheGrande_(cache, 'lista', fotos, MINUTOS_CACHE_LISTA * 60);
  return fotos;
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
  Logger.log('Fotos encontradas: ' + fotos.length);
  Logger.log(JSON.stringify(fotos.slice(0, 3), null, 2));
}
