/*
 * De dónde salen las fotos.
 *
 *   Fuentes.demo()          → imágenes de ejemplo en web/demo/ (sin configurar nada)
 *   Fuentes.drive(url, tk)  → tu carpeta de Drive, a través del Apps Script
 *
 * Las dos devuelven el mismo formato:
 *   listar(): Promise<foto[]>      foto = { id, ancho, alto, fecha }
 *   url(foto): Promise<string>
 *   agenda(): Promise<evento[]>    ver js/agenda.js
 *   clima(): Promise<clima>        ver js/clima.js
 *   basquet(): Promise<partidos>   ver js/basquet.js
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
      url: function (foto) { return Promise.resolve('demo/' + foto.id + '.svg'); },
      agenda: function () { return Promise.resolve(agendaEjemplo(new Date())); },
      clima: function () { return Promise.resolve(Clima.ejemplo(new Date())); },
      basquet: function () { return Promise.resolve(basquetEjemplo(new Date())); }
    };
  }

  // Escudo de ejemplo: un círculo con las iniciales.
  function escudoEjemplo(letras, fondo, texto) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="46" fill="' + fondo + '" stroke="#141414" stroke-width="4"/>' +
      '<text x="50" y="62" font-family="Arial" font-weight="700" font-size="34" text-anchor="middle" fill="' +
      texto + '">' + letras + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function basquetEjemplo(ahora) {
    var EQUIPO = 'ARGENTINO DE CASTELAR NORTE A';
    function sabado(semanas) {
      var d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 11, 0);
      d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7) + semanas * 7);
      return d.toISOString();
    }
    function equipo(nombre, escudo, puntos) { return { nombre: nombre, escudo: escudo, puntos: puntos }; }
    var castelar = escudoEjemplo('A', '#8fb8de', '#141414');
    var p = function (fecha, local, visitante, cancha) {
      return { fecha: fecha, cancha: cancha, local: local, visitante: visitante };
    };
    return {
      equipo: EQUIPO,
      categoria: 'CADETES MASCULINO',
      partidos: [
        p(sabado(-3), equipo(EQUIPO, castelar, 73), equipo('LANUS A', escudoEjemplo('L', '#7a1f2b', '#fff'), 75), 'Argentino de Castelar'),
        p(sabado(-2), equipo('RIVER PLATE', escudoEjemplo('R', '#fff', '#d0302b'), 60), equipo(EQUIPO, castelar, 81), 'River Plate'),
        p(sabado(-1), equipo(EQUIPO, castelar, 82), equipo('MIDLAND', escudoEjemplo('M', '#1f3f8f', '#fff'), 65), 'Argentino de Castelar'),
        p(sabado(1), equipo(EQUIPO, castelar, null), equipo('PEDRO ECHAGÜE AZUL', escudoEjemplo('PE', '#f2c230', '#1f3f8f'), null), 'Argentino de Castelar'),
        p(sabado(2), equipo('OBRAS', escudoEjemplo('O', '#e6e6e6', '#141414'), null), equipo(EQUIPO, castelar, null), 'Obras Sanitarias')
      ]
    };
  }

  // Eventos de ejemplo relativos a ahora, para que la demo siempre tenga algo que mostrar.
  function agendaEjemplo(ahora) {
    var CAL = {
      javi: ['Javi', '#2f5fd0'],
      thiago: ['Thiago', '#d39b1e'],
      familia: ['Familia', '#2e7d4f'],
      cumples: ['Cumpleaños', '#c2306b']
    };
    function en(min) { return new Date(ahora.getTime() + min * 60000).toISOString(); }
    function dia(sumar, h, m) {
      return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + sumar, h, m || 0).toISOString();
    }
    function ev(titulo, inicio, fin, cal, extra) {
      return Object.assign({ titulo: titulo, inicio: inicio, fin: fin, todoElDia: false, lugar: '',
        calendario: CAL[cal][0], color: CAL[cal][1] }, extra || {});
    }
    return [
      ev('Fútbol', en(26), en(116), 'thiago', { lugar: 'Club Arquitectura' }),
      ev('Llamada con el contador', en(140), en(170), 'javi'),
      ev('Inglés', en(200), en(260), 'thiago'),
      ev('Cena con los abuelos', en(330), en(450), 'familia', { lugar: 'Casa de los abuelos' }),
      ev('Acto del colegio · ir de blanco', dia(1, 8), dia(1, 9, 30), 'thiago'),
      ev('Dentista', dia(1, 18, 30), dia(1, 19, 15), 'javi'),
      ev('Pagar expensas', dia(1, 0), dia(2, 0), 'familia', { todoElDia: true }),
      ev('Prueba de matemática', dia(2, 8), dia(2, 9), 'thiago'),
      ev('Cumple de la abuela Marta', dia(3, 0), dia(4, 0), 'cumples', { todoElDia: true }),
      ev('Reunión de padres', dia(4, 19), dia(4, 20), 'familia'),
      ev('Partido de fútbol', dia(5, 10), dia(5, 12), 'thiago')
    ];
  }

  function drive(urlScript, token, opciones) {
    opciones = opciones || {};
    var latitud = opciones.latitud, longitud = opciones.longitud;
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
      },
      agenda: function () {
        var nombres = opciones.nombresCalendarios || {};
        return pedir({ action: 'agenda', dias: 7, token: token }).then(function (d) {
          return d.eventos.map(function (e) {
            if (nombres[e.calendario]) e.calendario = nombres[e.calendario];
            return e;
          });
        });
      },
      clima: function () { return Clima.obtener(latitud, longitud); },
      basquet: function () { return pedir({ action: 'basquet', token: token }); }
    };
  }

  root.Fuentes = { demo: demo, drive: drive };
})(window);
