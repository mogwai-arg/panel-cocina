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
  var avisoConfig = document.getElementById('aviso-config');
  if (window.ERROR_CONFIG || window.CONFIG === undefined) {
    avisoConfig.textContent = 'Modo demo: config.js tiene un error y no se pudo leer — ' +
      (window.ERROR_CONFIG || 'revisá que esté bien escrito');
    avisoConfig.hidden = false;
  } else if (!usarDrive) {
    avisoConfig.textContent = window.CONFIG ? 'Modo demo (?demo=1)' : 'Modo demo: no hay config.js';
    avisoConfig.className += ' aviso-config--suave';
    avisoConfig.hidden = false;
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
    basquet: config.BASQUET || { calendario: 'Thi', color: '#d39b1e' },
    // Las entregas de Classroom de la semana también van a la agenda
    classroom: config.CLASSROOM || { calendario: 'Thi', color: '#d39b1e' }
  });

  // Aviso abajo de la pantalla, con "Deshacer" opcional.
  var aviso = document.getElementById('aviso');
  var avisoTexto = document.getElementById('aviso-texto');
  var avisoDeshacer = document.getElementById('aviso-deshacer');
  var avisoTimer = null;
  var avisoAccion = null;
  function avisar(texto, deshacer) {
    avisoTexto.textContent = texto;
    avisoAccion = deshacer || null;
    avisoDeshacer.hidden = !deshacer;
    aviso.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { aviso.hidden = true; }, 4000);
  }
  avisoDeshacer.addEventListener('click', function () {
    if (avisoAccion) avisoAccion();
    aviso.hidden = true;
  });

  var listas = VistasListas.crearListas(fuente, { avisar: avisar });
  var vistas = {
    tareas: VistasListas.crearTareas(document.getElementById('vista-tareas'), listas, {
      // Mismos colores que en la agenda
      colores: config.PERSONAS || { Thi: '#d39b1e', Javi: '#2f5fd0', Dan: '#7b4fc4' }
    }),
    compras: VistasListas.crearCompras(document.getElementById('vista-compras'), listas, { avisar: avisar }),
    cole: VistaCole.crearCole(document.getElementById('vista-cole'), fuente, {
      apodo: config.APODO_ALUMNO || 'Thi',
      alCambiar: function (d, entregas) {
        var n = document.querySelector('[data-num="cole"]');
        var total = Cole.sinLeer(d) + (entregas || 0);
        n.textContent = total;
        n.hidden = !total;
      }
    })
  };

  // Números en la barra lateral: compras pendientes y tareas de hoy sin hacer.
  listas.alCambiar(function (d) {
    var compras = Listas.pendientes(d.compras || []).length;
    var tareas = Listas.progresoDelDia(d.tareas || [], new Date())
      .reduce(function (s, p) { return s + p.total - p.hechas; }, 0);
    [['compras', compras], ['tareas', tareas]].forEach(function (x) {
      var n = document.querySelector('[data-num="' + x[0] + '"]');
      n.textContent = x[1];
      n.hidden = !x[1];
    });
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
    if (vista === 'tareas' || vista === 'compras') listas.cargar();
    if (vistas[vista]) vistas[vista].alMostrar();
  }

  document.querySelectorAll('.nav [data-ir]').forEach(function (b) {
    b.addEventListener('click', function () { irA(b.getAttribute('data-ir')); });
  });

  // En las fotos: deslizar cambia de foto; tocar vuelve al panel.
  var vistaFotos = document.getElementById('vista-fotos');
  // Mantener apretada una foto: botones para girarla (por si quedó acostada).
  var inicioX = null;
  var inicioT = 0;
  vistaFotos.addEventListener('pointerdown', function (e) { inicioX = e.clientX; inicioT = Date.now(); });
  vistaFotos.addEventListener('pointerup', function (e) {
    if (inicioX === null) return;
    var dx = e.clientX - inicioX;
    inicioX = null;
    if (dx < -60) fotos.siguiente();
    else if (dx > 60) fotos.anterior();
    else if (Date.now() - inicioT > 700 && fotos.menuGiro(e.target)) return;
    else irA('hoy');
  });
  vistaFotos.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if (vistaActual !== 'fotos') return;
    if (e.key === 'ArrowRight') fotos.siguiente();
    if (e.key === 'ArrowLeft') fotos.anterior();
    if (e.key === 'Escape') irA('hoy');
    if (e.key === 'g') fotos.menuGiro(null);
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

  listas.cargar();
  vistas.cole.cargar();
  // Mantener las listas al día por si alguien las cambia desde el celular.
  // Cada minuto si se están mirando; si no, cada 5 (para los números de la barra).
  var minutosSinRecargar = 0;
  setInterval(function () {
    minutosSinRecargar++;
    if (vistaActual === 'tareas' || vistaActual === 'compras' || minutosSinRecargar >= 5) listas.cargar();
    if (vistaActual === 'cole' || minutosSinRecargar >= 5) vistas.cole.cargar();
    if (minutosSinRecargar >= 5) minutosSinRecargar = 0;
  }, 60000);

  fotos.iniciar();
  fotos.pausar();
  hoy.iniciar();
  irA(['fotos', 'tareas', 'compras', 'cole'].indexOf(params.get('vista')) >= 0 ? params.get('vista') : 'hoy');
  actividad();
})();
