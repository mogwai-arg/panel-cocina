/*
 * Slideshow: pide las fotos a la fuente, arma las diapositivas con Layout y
 * las muestra con un fundido. Precarga la siguiente para que no haya saltos.
 */
(function (root) {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var NOMBRES_TIPO = {
    completa: 'Horizontal → pantalla completa',
    centrada: 'Entera, con fondo desenfocado',
    par: '2 verticales → collage',
    triptico: '3 verticales → tríptico'
  };

  function fechaLarga(iso) {
    if (!iso) return '';
    var a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
    if (!a || !m || !d) return '';
    return d + ' de ' + MESES[m - 1] + ' de ' + a;
  }

  function crearSlideshow(contenedor, fuente, opciones) {
    opciones = opciones || {};
    var segundos = opciones.segundos || 15;
    var minutosLista = opciones.minutosLista || 30;
    var debug = !!opciones.debug;

    var secuencia = [];
    var posicion = -1;
    var actual = null;
    var temporizador = null;
    var ultimaLista = 0;
    var pausado = false;

    function programar(ms) {
      clearTimeout(temporizador);
      temporizador = setTimeout(function () { if (!pausado) mostrar(1); }, ms);
    }

    function proporcionPantalla() {
      return contenedor.clientWidth / Math.max(1, contenedor.clientHeight);
    }

    function cargarLista() {
      if (!actual) contenedor.setAttribute('data-estado', 'cargando');
      return fuente.listar().then(function (fotos) {
        var ds = Layout.armarDiapositivas(fotos, { proporcionPantalla: proporcionPantalla() });
        secuencia = Layout.ordenar(ds, new Date());
        posicion = -1;
        ultimaLista = Date.now();
      });
    }

    function precargar(url) {
      return new Promise(function (ok) {
        var img = new Image();
        img.onload = img.onerror = function () { ok(url); };
        img.src = url;
      });
    }

    function construir(diapo, urls) {
      var el = document.createElement('div');
      el.className = 'diapo diapo--' + diapo.tipo;

      if (diapo.tipo === 'centrada') {
        var fondo = document.createElement('div');
        fondo.className = 'diapo__fondo';
        fondo.style.backgroundImage = 'url("' + urls[0] + '")';
        el.appendChild(fondo);
      }
      urls.forEach(function (u) {
        var img = document.createElement('img');
        img.className = 'diapo__foto';
        img.src = u;
        img.alt = '';
        el.appendChild(img);
      });

      var pie = document.createElement('div');
      pie.className = 'diapo__pie';
      var fecha = fechaLarga(diapo.fotos[0].fecha);
      if (diapo.haceAnios) {
        pie.innerHTML = '<span class="diapo__recuerdo"></span><b class="diapo__fecha"></b>';
        pie.firstChild.textContent = 'Un día como hoy · hace ' + diapo.haceAnios +
          (diapo.haceAnios === 1 ? ' año' : ' años');
        pie.lastChild.textContent = fecha;
      } else if (fecha) {
        pie.innerHTML = '<span class="diapo__fecha-chica"></span>';
        pie.firstChild.textContent = fecha;
      }
      el.appendChild(pie);

      if (debug) {
        var etiqueta = document.createElement('div');
        etiqueta.className = 'diapo__debug';
        etiqueta.textContent = NOMBRES_TIPO[diapo.tipo];
        el.appendChild(etiqueta);
      }
      return el;
    }

    function mostrar(paso) {
      clearTimeout(temporizador);
      var recargar = !secuencia.length || Date.now() - ultimaLista > minutosLista * 60000;
      var listo = recargar ? cargarLista() : Promise.resolve();

      return listo.then(function () {
        if (!secuencia.length) {
          contenedor.setAttribute('data-estado', 'vacio');
          programar(60000);
          return;
        }
        posicion = (posicion + paso + secuencia.length) % secuencia.length;
        var diapo = secuencia[posicion];
        return Promise.all(diapo.fotos.map(fuente.url)).then(function (urls) {
          return Promise.all(urls.map(precargar));
        }).then(function (urls) {
          var nueva = construir(diapo, urls);
          contenedor.appendChild(nueva);
          contenedor.removeAttribute('data-estado');
          // forzar reflow para que el fundido arranque desde opacidad 0
          void nueva.offsetWidth;
          nueva.classList.add('diapo--visible');
          var vieja = actual;
          actual = nueva;
          if (vieja) setTimeout(function () { vieja.remove(); }, 1200);
          programar(segundos * 1000);
          // Precargar la siguiente mientras se ve esta.
          var sig = secuencia[(posicion + 1) % secuencia.length];
          sig.fotos.forEach(function (f) { fuente.url(f).then(precargar); });
        });
      }).catch(function (err) {
        console.error(err);
        contenedor.setAttribute('data-estado', 'error');
        contenedor.setAttribute('data-error', err.message);
        programar(60000);
      });
    }

    return {
      iniciar: function () { pausado = false; return mostrar(1); },
      siguiente: function () { return mostrar(1); },
      anterior: function () { return mostrar(-1); },
      // Mientras está pausado no cambia de foto ni descarga nada.
      pausar: function () { pausado = true; clearTimeout(temporizador); },
      reanudar: function () {
        if (!pausado) return;
        pausado = false;
        if (actual) programar(segundos * 1000); else mostrar(1);
      },
      // Para el recuadro de recuerdos del panel "Hoy".
      fuente: fuente
    };
  }

  root.Fotos = { crearSlideshow: crearSlideshow, fechaLarga: fechaLarga };
})(window);
