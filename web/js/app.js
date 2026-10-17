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
  // En el marco (index.html?marco=1): 1 GB de memoria y pantalla de 1280 de ancho. Fotos del
  // tamaño de la pantalla y pocas guardadas, para que Chrome no se quede sin memoria.
  var enMarco = params.get('marco') === '1';
  var fuente = usarDrive
    ? Fuentes.drive(config.APPS_SCRIPT_URL, config.TOKEN, {
        ancho: enMarco ? Math.min(config.ANCHO_FOTO || 1280, 1280) : config.ANCHO_FOTO,
        maxCache: enMarco ? 12 : 40,
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

  var ajustes = Ajustes.crear(config, (function () { try { return window.localStorage; } catch (e) { return null; } })());

  var fotos = Fotos.crearSlideshow(document.getElementById('fotos'), fuente, {
    segundos: Number(params.get('segundos')) || ajustes.valor('segundosFoto'),
    videos: ajustes.valor('videos'),
    lugar: ajustes.valor('lugarFoto'),
    maxVideoMB: enMarco ? (config.VIDEO_MAX_MB_MARCO || 15) : 0,
    debug: params.get('debug') === '1'
  });

  var listas = VistasListas.crearListas(fuente, { avisar: function (t, d, ms) { avisar(t, d, ms); } });

  var hoy = Hoy.crearHoy(document.getElementById('vista-hoy'), fuente, {
    alTocarRecuerdo: function () { irA('fotos'); },
    personas: config.PERSONAS || { Thi: '#d39b1e', Javi: '#2f5fd0', Dan: '#7b4fc4' },
    avisar: function (texto, deshacer, ms) { avisar(texto, deshacer, ms); },
    listas: listas,
    irA: function (v) { irA(v); },
    // Mañana de cole (ver js/manana.js): los ajustes salen de ⚙️
    manana: function () { return ajustes.manana(); },
    personaCole: config.APODO_ALUMNO || 'Thi',
    alCambiarManana: function (activo) { if (activo) mananaEmpezo(); },
    mostrarQR: function (d) { rapidos.qr(d); },
    rapidos: [
      { icono: 'temporizador', texto: 'Temporizador', accion: function () { rapidos.temporizador(); } },
      { icono: 'wifi', texto: 'Wi-Fi invitados', accion: function () { rapidos.wifi(); } }
    ],
    basquet: config.BASQUET || { calendario: 'Thi', color: '#d39b1e' },
    // Las entregas de Classroom de la semana también van a la agenda
    classroom: config.CLASSROOM || { calendario: 'Thi', color: '#d39b1e' },
    // Nombres cortos de calendarios: los de la cuenta de Thi que no estén acá van a su columna
    // Los mails con fecha (turnos, vencimientos) también van a la agenda
    mails: config.MAILS || { calendario: 'Avisos' },
    nombresCortos: Object.keys(config.NOMBRES_CALENDARIOS || {}).map(function (k) { return config.NOMBRES_CALENDARIOS[k]; })
  });

  // Temporizadores de cocina, Wi-Fi de invitados y QR (js/vista-rapidos.js).
  var rapidos = VistaRapidos.crearRapidos(pantalla, {
    wifi: config.WIFI_INVITADOS || null,
    avisar: function (t) { avisar(t); },
    // Cuando suena una alarma la pantalla se despierta (aunque esté en descanso).
    despertar: function () { ultimaActividad = Date.now(); revisarDescanso(); }
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
    ajustes: VistaAjustes.crearAjustes(document.getElementById('vista-ajustes'), ajustes, {
      acciones: {
        fotosNuevas: function () {
          return fotos.recargar().then(function (n) { return n + ' fotos y videos'; });
        }
      },
      info: function () {
        var errores = [];
        try { errores = JSON.parse(localStorage.getItem('panel-errores') || '[]'); } catch (e) { /* nada */ }
        return 'Fotos y videos en la presentación: ' + fotos.cantidad() + '. Abierto desde ' + abiertoDesde + '.' +
          (errores.length ? ' Últimos errores: ' + errores.slice(-3).join(' · ') : '');
      }
    }),
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
  var abiertoDesde = new Date().toTimeString().slice(0, 5) + ' del ' + new Date().getDate() + '/' + (new Date().getMonth() + 1);
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
    // En pantallas táctiles Chrome solo acepta pedirla al levantar el dedo (pointerup/click),
    // no al apoyarlo.
    var pedirPantallaCompleta = function () {
      var raiz = document.documentElement;
      if (!document.fullscreenElement && raiz.requestFullscreen) {
        raiz.requestFullscreen({ navigationUI: 'hide' }).catch(function () { /* nada */ });
      }
    };
    // El marco toca solo, cada minuto, el rincón de abajo a la derecha (arranque.sh): ese toque
    // solo pide pantalla completa (si se perdió) y no cuenta como "tocar" (no saca de las
    // fotos ni despierta la pantalla de noche).
    var toqueDelMarco = function (e) {
      return e.clientX >= window.innerWidth - 4 && e.clientY >= window.innerHeight - 4;
    };
    ['pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(function (t) {
      window.addEventListener(t, function (e) {
        var p = e.changedTouches ? e.changedTouches[0] : e;
        if (!p || !toqueDelMarco(p)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (t === 'pointerup' || t === 'click' || t === 'touchend') pedirPantallaCompleta();
      }, { capture: true, passive: false });
    });
    window.addEventListener('pointerup', pedirPantallaCompleta, true);
    window.addEventListener('click', pedirPantallaCompleta, true);
    // Chrome sale de pantalla completa al recargar la página (y a veces solo). El marco manda
    // la tecla F11 cada minuto (arranque.sh): una tecla cuenta como "acción del usuario", así
    // que la página puede volver a pantalla completa sin que nadie la toque. No cuenta como
    // actividad: no saca de las fotos ni despierta la pantalla.
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'F11' && e.keyCode !== 122) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      pedirPantallaCompleta();
    }, true);
  }
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'F12' && e.keyCode !== 123) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (pedirPantallaCompleta) pedirPantallaCompleta();
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
  var temporizador = null;
  function actividad() {
    clearTimeout(temporizador);
    var minutos = Number(params.get('inactividad')) || ajustes.valor('minutosInactividad');
    // En Ajustes no se pasa solo a las fotos (se está tocando de a poco).
    temporizador = setTimeout(function () {
      if (vistaActual === 'ajustes') return;
      // En la mañana de cole el panel se queda en Hoy (no pasa a las fotos).
      if (mananaActiva()) { irA('hoy'); return; }
      irA('fotos');
    }, minutos * 60000);
    ultimaActividad = Date.now();
    // Si alguien toca mientras se muestra el panel automático, se queda en el panel.
    if (panelAutomatico) { panelAutomatico = false; clearTimeout(vueltaAFotos); }
    revisarDescanso();
  }

  // Un error en la mañana de cole nunca tiene que dejar la pantalla trabada.
  function mananaActiva() {
    try { return hoy.enManana(); } catch (e) { console.error(e); return false; }
  }

  // Ajustes que se cambian desde la pantalla (⚙️): ver js/ajustes.js y js/vista-ajustes.js.
  function configDescanso() { return ajustes.descanso(); }

  // Tema oscuro: de noche la pantalla pasa a colores oscuros (antes del apagado y si la despiertan).
  function revisarTema() {
    var oscuro = ajustes.valor('oscuro') &&
      Descanso.esDeNoche(new Date(), { desde: ajustes.valor('oscuroDesde'), hasta: ajustes.valor('oscuroHasta') });
    if (oscuro) pantalla.setAttribute('data-tema', 'noche'); else pantalla.removeAttribute('data-tema');
  }
  revisarTema();
  setInterval(revisarTema, 60000);

  // Cuando se cambia un ajuste, se aplica en el momento.
  ajustes.alCambiar(function () {
    fotos.configurar({ segundos: ajustes.valor('segundosFoto'), videos: ajustes.valor('videos'), lugar: ajustes.valor('lugarFoto') });
    estadoDescanso = null; // recalcular ya
    hoy.repintarManana();
    revisarDescanso();
    revisarTema();
    actividad();
  });
  reloj.addEventListener('click', function () { irA('ajustes'); });

  // Alternar: después de un rato de fotos, el panel Hoy unos segundos, y de vuelta a fotos.
  var enFotosDesde = Date.now();
  var vueltaAFotos = null;
  var panelAutomatico = false;
  setInterval(function () {
    if (vistaActual === 'fotos' && mananaActiva() && Date.now() - ultimaActividad > 120000) { irA('hoy'); return; }
    if (!ajustes.valor('alternar') || vistaActual !== 'fotos' || estadoDescanso !== 'activo') return;
    if (!Descanso.tocaPanel(Date.now(), enFotosDesde, ultimaActividad, { cadaMinutos: ajustes.valor('alternarCada') })) return;
    panelAutomatico = true;
    irA('hoy');
    vueltaAFotos = setTimeout(function () {
      if (panelAutomatico) { panelAutomatico = false; irA('fotos'); }
    }, ajustes.valor('alternarSegundos') * 1000);
  }, 15000);

  // Modo descanso: de noche se apaga (negro) y, si hay sensor, de día se atenúa sin nadie.
  var capaDescanso = document.getElementById('descanso');
  var ultimaActividad = Date.now();
  var haySensor = false;
  var estadoDescanso = 'activo';
  function revisarDescanso() {
    if (!capaDescanso) return;
    var nuevo = Descanso.estado(new Date(), ultimaActividad, configDescanso(), haySensor && ajustes.valor('sensor'));
    // En la mañana de cole la pantalla queda prendida.
    if (mananaActiva()) nuevo = 'activo';
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
  // Empieza la mañana de cole: la pantalla se prende y muestra Hoy (salvo que estén usando otra pantalla).
  function mananaEmpezo() {
    if (!vistaActual || vistaActual === 'fotos' || vistaActual === 'hoy' || Date.now() - ultimaActividad > 60000) irA('hoy');
    revisarDescanso();
  }

  // El primer toque con la pantalla en descanso solo la despierta (no aprieta nada).
  if (capaDescanso) {
    ['pointerdown', 'pointerup', 'click'].forEach(function (t) {
      capaDescanso.addEventListener(t, function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (t !== 'pointerdown') return;
        // Primero se saca la capa negra (pase lo que pase después) y recién ahí se avisa.
        capaDescanso.hidden = true;
        estadoDescanso = 'activo';
        ultimaActividad = Date.now();
        actividad();
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

  // Latido: el marco (marco/en-el-marco/arranque.sh) mira que esto cambie; si la página se
  // cae y deja de latir, la vuelve a abrir.
  function latir() { try { localStorage.setItem('panel-latido', String(Date.now())); } catch (e) { /* nada */ } }
  latir();
  setInterval(latir, 60000);

  // Una vez por día, de madrugada y sin nadie usándolo, el panel se recarga: el marco tiene
  // poca memoria y así arranca limpio cada día.
  var cargadoEl = new Date().toDateString();
  setInterval(function () {
    var ahora = new Date();
    if (ahora.toDateString() === cargadoEl || ahora.getHours() !== 4) return;
    if (Date.now() - ultimaActividad < 30 * 60000) return;
    location.reload();
  }, 5 * 60000);
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
  irA(['fotos', 'tareas', 'compras', 'cole', 'avisos', 'agentes', 'ajustes'].indexOf(params.get('vista')) >= 0 ? params.get('vista') : 'hoy');
  actividad();
})();
