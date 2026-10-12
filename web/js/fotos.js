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
    triptico: '3 verticales → tríptico',
    video: 'Video'
  };
  var CLAVE_NO_SOPORTADOS = 'panel-videos-no-soportados';

  // Videos que este navegador no pudo reproducir (p. ej. HEVC en un Chrome viejo):
  // se recuerdan para no volver a bajarlos.
  function leerNoSoportados() {
    try { return JSON.parse(localStorage.getItem(CLAVE_NO_SOPORTADOS) || '{}') || {}; } catch (e) { return {}; }
  }
  function guardarNoSoportado(id) {
    var m = leerNoSoportados();
    m[id] = true;
    try { localStorage.setItem(CLAVE_NO_SOPORTADOS, JSON.stringify(m)); } catch (e) { /* sin almacenamiento */ }
  }

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
    var maxSegundosVideo = opciones.maxSegundosVideo || 90;
    var hayVideos = typeof fuente.video === 'function' && opciones.videos !== false;
    var fallidosSeguidos = 0;

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
        var malos = leerNoSoportados();
        fotos = fotos.filter(function (f) { return !(f.video && malos[f.id]); });
        var ds = Layout.armarDiapositivas(fotos, { proporcionPantalla: proporcionPantalla(), sinVideos: !hayVideos });
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

      if (diapo.tipo === 'centrada' || diapo.tipo === 'video') {
        var fondo = document.createElement('div');
        fondo.className = 'diapo__fondo';
        fondo.style.backgroundImage = 'url("' + urls[0] + '")';
        el.appendChild(fondo);
      }
      if (diapo.tipo === 'video') {
        var v = document.createElement('video');
        v.className = 'diapo__video';
        v.muted = true;
        v.setAttribute('muted', '');
        v.setAttribute('playsinline', '');
        v.preload = 'auto';
        el.appendChild(v);
        urls = [];
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

    function entrar(nueva) {
      // Un video ya agregado no se vuelve a mover: sacarlo del documento lo pausa.
      if (nueva.parentNode !== contenedor) contenedor.appendChild(nueva);
      contenedor.removeAttribute('data-estado');
      // forzar reflow para que el fundido arranque desde opacidad 0
      void nueva.offsetWidth;
      nueva.classList.add('diapo--visible');
      var vieja = actual;
      actual = nueva;
      if (vieja) {
        var vv = vieja.querySelector('video');
        if (vv) vv.pause();
        setTimeout(function () { vieja.remove(); }, 1200);
      }
    }

    // Precargar la siguiente mientras se ve esta.
    function precargarSiguiente() {
      var sig = secuencia[(posicion + 1) % secuencia.length];
      if (!sig) return;
      sig.fotos.forEach(function (f) { fuente.url(f).then(precargar, function () {}); });
      if (sig.tipo === 'video') fuente.video(sig.fotos[0]).catch(function () {});
    }

    // Espera a que el video arranque; si no puede (formato no soportado) rechaza.
    function arrancar(v, src) {
      return new Promise(function (ok, mal) {
        var listo = false;
        function fin(error) {
          if (listo) return;
          listo = true;
          clearTimeout(t);
          if (error) mal(error); else ok();
        }
        var t = setTimeout(function () { fin(new Error('El video no arrancó')); }, 20000);
        v.addEventListener('error', function () { fin(new Error('Formato de video no soportado')); });
        v.addEventListener('playing', function () {
          // Si solo se decodifica el audio, no hay imagen: es como no soportado.
          fin(v.videoWidth ? null : new Error('Formato de video no soportado'));
        });
        v.src = src;
        var p = v.play();
        if (p && p.catch) p.catch(function (e) { if (e && e.name !== 'AbortError') fin(e); });
      });
    }

    function mostrarVideo(diapo) {
      var foto = diapo.fotos[0];
      var poster = fuente.url(foto).then(precargar, function () { return null; });
      return Promise.all([poster, fuente.video(foto)]).then(function (r) {
        var el = construir(diapo, [r[0]]);
        if (!r[0]) el.querySelector('.diapo__fondo').remove();
        var v = el.querySelector('video');
        contenedor.appendChild(el); // invisible hasta que entra con el fundido
        return arrancar(v, r[1]).then(function () {
          if (pausado) v.pause();
          // El tamaño real (ya girado) se sabe recién al reproducir.
          var r = v.videoWidth / v.videoHeight;
          if (r >= 1.15 && r < 2.2) el.classList.add('diapo--video-completo');
          entrar(el);
          fallidosSeguidos = 0;
          v.addEventListener('ended', function () { if (actual === el && !pausado) mostrar(1); });
          programar(maxSegundosVideo * 1000);
          precargarSiguiente();
        }, function (err) {
          el.remove();
          if (/no soportado/.test(err.message)) guardarNoSoportado(foto.id);
          throw err;
        });
      }).catch(function (err) {
        // Un video que no se puede ver no frena la presentación: se pasa al siguiente.
        console.warn('Video salteado', foto.id, err);
        secuencia.splice(posicion, 1);
        posicion--;
        fallidosSeguidos++;
        if (fallidosSeguidos > 3 || !secuencia.length) { fallidosSeguidos = 0; programar(segundos * 1000); return; }
        return avanzar(1);
      });
    }

    function videoActual() { return actual && actual.querySelector('video'); }

    // Si ya hay una diapositiva cargándose, no se pide otra encima.
    // (Con un límite de 2 minutos, por si un pedido quedó colgado.)
    var ocupado = 0;
    function mostrar(paso) {
      if (ocupado && Date.now() - ocupado < 120000) return Promise.resolve();
      var yo = ocupado = Date.now();
      return avanzar(paso).then(function () { if (ocupado === yo) ocupado = 0; });
    }

    function avanzar(paso) {
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
        if (diapo.tipo === 'video') return mostrarVideo(diapo);
        return Promise.all(diapo.fotos.map(fuente.url)).then(function (urls) {
          return Promise.all(urls.map(precargar));
        }).then(function (urls) {
          entrar(construir(diapo, urls));
          programar(segundos * 1000);
          precargarSiguiente();
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
      pausar: function () {
        pausado = true;
        clearTimeout(temporizador);
        var v = videoActual();
        if (v) v.pause();
      },
      reanudar: function () {
        if (!pausado) return;
        pausado = false;
        var v = videoActual();
        if (v && !v.ended) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
          programar(maxSegundosVideo * 1000);
        } else if (actual) programar(segundos * 1000); else mostrar(1);
      },
      // Para el recuadro de recuerdos del panel "Hoy".
      fuente: fuente
    };
  }

  root.Fotos = { crearSlideshow: crearSlideshow, fechaLarga: fechaLarga };
})(window);
