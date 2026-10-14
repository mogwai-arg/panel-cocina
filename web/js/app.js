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
    personas: config.PERSONAS || { Thi: '#d39b1e', Javi: '#2f5fd0', Dan: '#7b4fc4' },
    avisar: function (texto, deshacer, ms) { avisar(texto, deshacer, ms); },
    basquet: config.BASQUET || { calendario: 'Thi', color: '#d39b1e' },
    // Las entregas de Classroom de la semana también van a la agenda
    classroom: config.CLASSROOM || { calendario: 'Thi', color: '#d39b1e' },
    // Nombres cortos de calendarios: los de la cuenta de Thi que no estén acá van a su columna
    // Los mails con fecha (turnos, vencimientos) también van a la agenda
    mails: config.MAILS || { calendario: 'Avisos' },
    nombresCortos: Object.keys(config.NOMBRES_CALENDARIOS || {}).map(function (k) { return config.NOMBRES_CALENDARIOS[k]; })
  });

  // Aviso abajo de la pantalla, con "Deshacer" opcional.
  var aviso = document.getElementById('aviso');
  var avisoTexto = document.getElementById('aviso-texto');
  var avisoDeshacer = document.getElementById('aviso-deshacer');
  var avisoTimer = null;
  var avisoAccion = null;
  function avisar(texto, deshacer, ms) {
    avisoTexto.textContent = texto;
    avisoAccion = deshacer || null;
    avisoDeshacer.hidden = !deshacer;
    aviso.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { aviso.hidden = true; }, ms || 4000);
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
    }),
    agentes: VistaAgentes.crearAgentes(document.getElementById('vista-agentes'), fuente),
    avisos: VistaAvisos.crearAvisos(document.getElementById('vista-avisos'), fuente, {
      alCambiar: function (d) {
        var n = document.querySelector('[data-num="avisos"]');
        var nuevos = Mails.nuevos(d, new Date()).length;
        n.textContent = nuevos;
        n.hidden = !nuevos;
      }
    })
  };

  // Números en la barra lateral: compras pendientes y tareas de hoy sin hacer.
  listas.alCambiar(function (d) {
    var compras = Listas.pendientes(d.compras || []).length;
    var progreso = Listas.progresoDelDia(d.tareas || [], new Date());
    hoy.tareas(progreso);
    var tareas = progreso.reduce(function (s, p) { return s + p.total - p.hechas; }, 0);
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
    if (vista === 'fotos') enFotosDesde = Date.now();
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
  // En el marco (index.html?marco=1):
  //  - el primer toque pone la pantalla completa (Chrome no deja hacerlo sin un toque);
  //  - el sensor de movimiento llega como la tecla F12 (la manda marco/movimiento.sh).
  //    No cuenta como "tocar": no saca de las fotos, solo despierta o atenúa la pantalla.
  if (params.get('marco') === '1') {
    window.addEventListener('pointerdown', function () {
      var raiz = document.documentElement;
      if (!document.fullscreenElement && raiz.requestFullscreen) {
        raiz.requestFullscreen({ navigationUI: 'hide' }).catch(function () { /* nada */ });
      }
    }, true);
  }
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'F12' && e.keyCode !== 123) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.panelMovimiento();
  }, true);

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
    ultimaActividad = Date.now();
    // Si alguien toca mientras se muestra el panel automático, se queda en el panel.
    if (panelAutomatico) { panelAutomatico = false; clearTimeout(vueltaAFotos); }
    revisarDescanso();
  }

  // Ajustes que se cambian desde la pantalla (tocando la hora de la barra lateral).
  // Se guardan en este aparato; los valores iniciales salen de config.js.
  var alternarCfg = Object.assign({ activo: true, cadaMinutos: 10, segundosPanel: 30 }, config.ALTERNAR || {});
  var ajustes = (function () {
    var guardados = {};
    try { guardados = JSON.parse(localStorage.getItem('panel-ajustes') || '{}') || {}; } catch (e) { /* nada */ }
    return {
      alternar: guardados.alternar !== undefined ? guardados.alternar : alternarCfg.activo !== false,
      noche: guardados.noche !== undefined ? guardados.noche : !(config.DESCANSO && config.DESCANSO.noche === false),
      oscuro: guardados.oscuro !== undefined ? guardados.oscuro : !(config.TEMA_OSCURO === false)
    };
  })();
  function guardarAjustes() {
    try { localStorage.setItem('panel-ajustes', JSON.stringify(ajustes)); } catch (e) { /* nada */ }
  }
  function configDescanso() {
    var c = Object.assign({}, config.DESCANSO || {});
    if (!ajustes.noche) c.noche = false;
    return c;
  }

  // Tema oscuro: de noche la pantalla pasa a colores oscuros (antes del apagado y si la despiertan).
  var temaOscuro = Object.assign({ desde: '19:30', hasta: '07:00' }, config.TEMA_OSCURO || {});
  function revisarTema() {
    var oscuro = ajustes.oscuro && Descanso.esDeNoche(new Date(), temaOscuro);
    if (oscuro) pantalla.setAttribute('data-tema', 'noche'); else pantalla.removeAttribute('data-tema');
  }
  revisarTema();
  setInterval(revisarTema, 60000);

  var panelAjustes = document.getElementById('ajustes');
  function pintarAjustes() {
    panelAjustes.querySelectorAll('[data-ajuste]').forEach(function (i) { i.checked = !!ajustes[i.getAttribute('data-ajuste')]; });
    var n = Descanso.configuracion(config.DESCANSO).noche || { desde: '23:00', hasta: '07:00' };
    panelAjustes.querySelector('[data-r="alternar-detalle"]').textContent =
      'Cada ' + alternarCfg.cadaMinutos + ' min de fotos, el panel ' + alternarCfg.segundosPanel + ' s y vuelve a las fotos';
    panelAjustes.querySelector('[data-r="oscuro-detalle"]').textContent =
      'De ' + temaOscuro.desde + ' a ' + temaOscuro.hasta + ', colores oscuros que no encandilan';
    panelAjustes.querySelector('[data-r="noche-detalle"]').textContent =
      'De ' + n.desde + ' a ' + n.hasta + ' la pantalla queda ' + (n.modo === 'tenue' ? 'tenue' : 'negra');
  }
  reloj.addEventListener('click', function () { pintarAjustes(); panelAjustes.hidden = false; });
  panelAjustes.querySelector('[data-r="cerrar"]').addEventListener('click', function () { panelAjustes.hidden = true; });
  panelAjustes.querySelectorAll('[data-ajuste]').forEach(function (i) {
    i.addEventListener('change', function () {
      ajustes[i.getAttribute('data-ajuste')] = i.checked;
      guardarAjustes();
      estadoDescanso = null; // recalcular ya
      revisarDescanso();
      revisarTema();
    });
  });

  // Alternar: después de un rato de fotos, el panel Hoy unos segundos, y de vuelta a fotos.
  var enFotosDesde = Date.now();
  var vueltaAFotos = null;
  var panelAutomatico = false;
  setInterval(function () {
    if (!ajustes.alternar || vistaActual !== 'fotos' || estadoDescanso !== 'activo') return;
    if (!Descanso.tocaPanel(Date.now(), enFotosDesde, ultimaActividad, alternarCfg)) return;
    panelAutomatico = true;
    irA('hoy');
    vueltaAFotos = setTimeout(function () {
      if (panelAutomatico) { panelAutomatico = false; irA('fotos'); }
    }, alternarCfg.segundosPanel * 1000);
  }, 15000);

  // Modo descanso: de noche se apaga (negro) y, si hay sensor, de día se atenúa sin nadie.
  var capaDescanso = document.getElementById('descanso');
  var ultimaActividad = Date.now();
  var haySensor = false;
  var estadoDescanso = 'activo';
  function revisarDescanso() {
    if (!capaDescanso) return;
    var nuevo = Descanso.estado(new Date(), ultimaActividad, configDescanso(), haySensor);
    if (nuevo === estadoDescanso) return;
    estadoDescanso = nuevo;
    capaDescanso.hidden = nuevo === 'activo';
    capaDescanso.className = 'descanso descanso--' + nuevo;
    // Con la pantalla negra no tiene sentido seguir bajando fotos.
    if (nuevo === 'apagado') fotos.pausar();
    else if (vistaActual === 'fotos') fotos.reanudar();
    // Si el marco usa Fully Kiosk, también se baja el brillo de verdad.
    if (window.fully && window.fully.setScreenBrightness) {
      window.fully.setScreenBrightness(nuevo === 'apagado' ? 0 : nuevo === 'tenue' ? 40 : 255);
    }
  }
  // El primer toque con la pantalla en descanso solo la despierta (no aprieta nada).
  if (capaDescanso) {
    ['pointerdown', 'pointerup', 'click'].forEach(function (t) {
      capaDescanso.addEventListener(t, function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (t === 'pointerdown') actividad();
      });
    });
  }
  // El sensor de movimiento del marco avisa llamando a esta función (se conecta al instalarlo).
  window.panelMovimiento = function () {
    haySensor = true;
    ultimaActividad = Date.now();
    revisarDescanso();
  };
  setInterval(revisarDescanso, 30000);
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, actividad, { passive: true });
  });

  function pintarReloj() { reloj.textContent = hoy.reloj(); }
  setInterval(pintarReloj, 10000);
  pintarReloj();

  listas.cargar();
  vistas.cole.cargar();
  vistas.avisos.cargar();
  setInterval(function () { vistas.avisos.cargar(); }, 15 * 60000);
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
  irA(['fotos', 'tareas', 'compras', 'cole', 'avisos', 'agentes'].indexOf(params.get('vista')) >= 0 ? params.get('vista') : 'hoy');
  actividad();
})();
