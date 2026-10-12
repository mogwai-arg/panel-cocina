/*
 * Arranque de la app: elige la fuente de datos, escala la pantalla de
 * 1280x800 a la ventana, maneja la barra lateral y vuelve a las fotos
 * cuando nadie la usa.
 */
(function () {
  'use strict';

  var ANCHO = 1280, ALTO = 800;
  var params = new URLSearchParams(location.search);
  var config = window.CONFIG || {};

  var usarDrive = config.APPS_SCRIPT_URL && params.get('demo') !== '1';
  var fuente = usarDrive
    ? Fuentes.drive(config.APPS_SCRIPT_URL, config.TOKEN, {
        ancho: config.ANCHO_FOTO,
        nombresCalendarios: config.NOMBRES_CALENDARIOS,
        latitud: config.LATITUD || -34.6037,
        longitud: config.LONGITUD || -58.3816
      })
    : Fuentes.demo();

  var pantalla = document.getElementById('pantalla');

  // Avisar en pantalla si se está usando el modo demo y por qué.
  var aviso = document.getElementById('aviso-config');
  if (window.ERROR_CONFIG || window.CONFIG === undefined) {
    aviso.textContent = 'Modo demo: config.js tiene un error y no se pudo leer — ' +
      (window.ERROR_CONFIG || 'revisá que esté bien escrito');
    aviso.hidden = false;
  } else if (!usarDrive) {
    aviso.textContent = window.CONFIG ? 'Modo demo (?demo=1)' : 'Modo demo: no hay config.js';
    aviso.className += ' aviso-config--suave';
    aviso.hidden = false;
  }
  var reloj = document.getElementById('reloj-lateral');

  // Escalar la pantalla de 1280x800 para que entre en la ventana (en el marco es 1:1).
  function ajustar() {
    var escala = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
    pantalla.style.transform = 'scale(' + escala + ')';
    pantalla.style.left = Math.round((window.innerWidth - ANCHO * escala) / 2) + 'px';
    pantalla.style.top = Math.round((window.innerHeight - ALTO * escala) / 2) + 'px';
  }
  ajustar();
  window.addEventListener('resize', ajustar);

  var fotos = Fotos.crearSlideshow(document.getElementById('fotos'), fuente, {
    segundos: Number(params.get('segundos')) || config.SEGUNDOS_POR_FOTO || 15,
    debug: params.get('debug') === '1'
  });

  var hoy = Hoy.crearHoy(document.getElementById('vista-hoy'), fuente, {
    alTocarRecuerdo: function () { irA('fotos'); },
    basquet: config.BASQUET || { calendario: 'Thiago', color: '#d39b1e' }
  });

  var vistaActual = null;
  function irA(vista) {
    if (vista === vistaActual) return;
    vistaActual = vista;
    pantalla.setAttribute('data-vista', vista);
    document.querySelectorAll('[data-vista-panel]').forEach(function (v) {
      v.hidden = v.getAttribute('data-vista-panel') !== vista;
    });
    document.querySelectorAll('.nav [data-ir]').forEach(function (b) {
      if (b.getAttribute('data-ir') === vista) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (vista === 'fotos') fotos.reanudar(); else fotos.pausar();
  }

  document.querySelectorAll('.nav [data-ir]').forEach(function (b) {
    b.addEventListener('click', function () { irA(b.getAttribute('data-ir')); });
  });

  // En las fotos: deslizar cambia de foto; tocar vuelve al panel.
  var vistaFotos = document.getElementById('vista-fotos');
  var inicioX = null;
  vistaFotos.addEventListener('pointerdown', function (e) { inicioX = e.clientX; });
  vistaFotos.addEventListener('pointerup', function (e) {
    if (inicioX === null) return;
    var dx = e.clientX - inicioX;
    inicioX = null;
    if (dx < -60) fotos.siguiente();
    else if (dx > 60) fotos.anterior();
    else irA('hoy');
  });
  document.addEventListener('keydown', function (e) {
    if (vistaActual !== 'fotos') return;
    if (e.key === 'ArrowRight') fotos.siguiente();
    if (e.key === 'ArrowLeft') fotos.anterior();
    if (e.key === 'Escape') irA('hoy');
  });

  // Sin tocar la pantalla por un rato → fotos.
  var minutos = Number(params.get('inactividad')) || config.MINUTOS_INACTIVIDAD || 3;
  var temporizador = null;
  function actividad() {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { irA('fotos'); }, minutos * 60000);
  }
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, actividad, { passive: true });
  });

  function pintarReloj() { reloj.textContent = hoy.reloj(); }
  setInterval(pintarReloj, 10000);
  pintarReloj();

  fotos.iniciar();
  fotos.pausar();
  hoy.iniciar();
  irA(params.get('vista') === 'fotos' ? 'fotos' : 'hoy');
  actividad();
})();
