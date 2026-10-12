/*
 * De dónde salen las fotos.
 *
 *   Fuentes.demo()          → imágenes de ejemplo en web/demo/ (sin configurar nada)
 *   Fuentes.drive(url, tk)  → tu carpeta de Drive, a través del Apps Script
 *
 * Las dos devuelven el mismo formato:
 *   { listar(): Promise<foto[]>, url(foto): Promise<string> }
 * con foto = { id, ancho, alto, fecha }.
 */
(function (root) {
  'use strict';

  function hace(anios, mes, dia) {
    var hoy = new Date();
    var d = new Date(hoy.getFullYear() - anios, mes === undefined ? hoy.getMonth() : mes,
      dia === undefined ? hoy.getDate() : dia, 12);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T12:00';
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function demo() {
    // "Un día como hoy" se arma con fechas relativas a hoy, para que siempre se vea.
    var fotos = [
      { id: 'playa', ancho: 1600, alto: 1200, fecha: hace(3) },
      { id: 'montana', ancho: 1920, alto: 1080, fecha: hace(1, 6, 14) },
      { id: 'cumple-1', ancho: 1080, alto: 1920, fecha: hace(1, 2, 3) },
      { id: 'cumple-2', ancho: 1080, alto: 1920, fecha: hace(1, 2, 3) },
      { id: 'cumple-3', ancho: 1080, alto: 1920, fecha: hace(1, 2, 3) },
      { id: 'plaza-1', ancho: 1200, alto: 1600, fecha: hace(0, 0, 20) },
      { id: 'plaza-2', ancho: 1200, alto: 1600, fecha: hace(0, 0, 20) },
      { id: 'perro', ancho: 1200, alto: 1600, fecha: hace(2, 4, 9) },
      { id: 'asado', ancho: 1200, alto: 1200, fecha: hace(0, 1, 11) },
      { id: 'glaciar', ancho: 3600, alto: 1200, fecha: hace(2, 0, 28) },
      { id: 'lago', ancho: 1600, alto: 1200, fecha: hace(6) },
      { id: 'primer-dia', ancho: 1200, alto: 1600, fecha: hace(4, 2, 1) }
    ];
    return {
      listar: function () { return Promise.resolve(fotos); },
      url: function (foto) { return Promise.resolve('demo/' + foto.id + '.svg'); }
    };
  }

  function drive(urlScript, token, opciones) {
    opciones = opciones || {};
    var ancho = opciones.ancho || 1600;
    var maxCache = opciones.maxCache || 40;
    var cache = new Map(); // id → blob URL, en orden de uso

    function pedir(params) {
      var qs = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      return fetch(urlScript + '?' + qs).catch(function () {
        throw new Error('No hay conexión con el Apps Script. Revisá la URL en config.js');
      }).then(function (r) {
        if (!r.ok) throw new Error('El Apps Script respondió con el error ' + r.status);
        return r.text();
      }).then(function (texto) {
        try {
          return JSON.parse(texto);
        } catch (e) {
          throw new Error('El Apps Script devolvió una página en vez de datos. ' +
            'Revisá que la implementación tenga acceso "Cualquier persona"');
        }
      }).then(function (datos) {
        if (datos.error) throw new Error(datos.error);
        return datos;
      });
    }

    function guardar(id, url) {
      cache.set(id, url);
      if (cache.size > maxCache) {
        var viejo = cache.keys().next().value;
        URL.revokeObjectURL(cache.get(viejo));
        cache.delete(viejo);
      }
    }

    return {
      listar: function () {
        return pedir({ action: 'lista', token: token }).then(function (d) { return d.fotos; });
      },
      url: function (foto) {
        if (cache.has(foto.id)) {
          var u = cache.get(foto.id);
          cache.delete(foto.id); cache.set(foto.id, u); // marcar como recién usada
          return Promise.resolve(u);
        }
        return pedir({ action: 'img', id: foto.id, ancho: ancho, token: token }).then(function (d) {
          var bytes = atob(d.data);
          var arr = new Uint8Array(bytes.length);
          for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          var url = URL.createObjectURL(new Blob([arr], { type: d.mime }));
          guardar(foto.id, url);
          return url;
        });
      }
    };
  }

  root.Fuentes = { demo: demo, drive: drive };
})(window);
