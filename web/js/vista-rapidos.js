/*
 * Botones rápidos: temporizadores de cocina (con alarma que suena), el Wi-Fi de invitados
 * (QR para conectarse con la cámara) y un QR genérico (recetas). La lógica de los tiempos
 * está en js/temporizador.js.
 */
(function (root) {
  'use strict';

  var CLAVE = 'panel-temporizadores';
  var PRESETS = [1, 3, 5, 8, 10, 12, 15, 20, 25, 30, 45, 60];

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function icono(n, c) { return root.Hoy && root.Hoy.icono ? root.Hoy.icono(n, c) : ''; }

  /* QR como SVG (texto en UTF-8 para que entren tildes y eñes). */
  function svgQR(texto) {
    if (!root.qrcode) return '';
    root.qrcode.stringToBytes = root.qrcode.stringToBytesFuncs['UTF-8'];
    var q = root.qrcode(0, 'M');
    q.addData(texto);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }

  function crearRapidos(pantalla, opciones) {
    opciones = opciones || {};
    var T = root.Temporizador;

    // ===== Ventana (modal) =====
    var fondo = el('div', 'modal');
    fondo.hidden = true;
    var caja = el('div', 'modal__caja');
    fondo.appendChild(caja);
    pantalla.appendChild(fondo);
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    var alCerrar = null;
    function abrir(titulo, contenido, cuandoCierra) {
      caja.innerHTML = '';
      var cab = el('div', 'modal__cab');
      cab.appendChild(el('h2', 'modal__titulo', titulo));
      var x = el('button', 'modal__cerrar', '✕');
      x.setAttribute('aria-label', 'Cerrar');
      x.addEventListener('click', cerrar);
      cab.appendChild(x);
      caja.appendChild(cab);
      caja.appendChild(contenido);
      fondo.hidden = false;
      alCerrar = cuandoCierra || null;
    }
    function cerrar() {
      fondo.hidden = true;
      caja.innerHTML = '';
      if (alCerrar) { var f = alCerrar; alCerrar = null; f(); }
    }

    // ===== QR =====
    function mostrarQR(d) {
      var c = el('div', 'qr');
      var img = el('div', 'qr__img');
      img.innerHTML = svgQR(d.qr);
      c.appendChild(img);
      var txt = el('div', 'qr__txt');
      if (d.texto) txt.appendChild(el('p', 'qr__ayuda', d.texto));
      (d.datos || []).forEach(function (x) {
        var f = el('div', 'qr__dato');
        f.appendChild(el('span', 'lbl', x[0]));
        f.appendChild(el('b', null, x[1]));
        txt.appendChild(f);
      });
      c.appendChild(txt);
      abrir(d.titulo, c);
    }

    function abrirWifi() {
      var w = opciones.wifi;
      if (!w || !w.red) {
        var c = el('div', 'qr__txt');
        c.appendChild(el('p', 'qr__ayuda', 'Falta la red de invitados. En config.js agregá:'));
        c.appendChild(el('pre', 'qr__codigo', "WIFI_INVITADOS: { red: 'Nombre de la red', clave: 'la clave', tipo: 'WPA' },"));
        c.appendChild(el('p', 'qr__ayuda', 'y volvé a instalar el panel en el marco (bash marco/4-instalar.sh).'));
        abrir('Wi-Fi de invitados', c);
        return;
      }
      mostrarQR({
        titulo: 'Wi-Fi de invitados',
        texto: 'Apuntá la cámara del celular al código y tocá el aviso para conectarte.',
        qr: T.textoWifi(w.red, w.clave, w.tipo),
        datos: [['Red', w.red]].concat(w.clave ? [['Clave', w.clave]] : [])
      });
    }

    // ===== Temporizadores =====
    var lista = [];
    try { lista = JSON.parse(localStorage.getItem(CLAVE) || '[]') || []; } catch (e) { lista = []; }
    function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) { /* nada */ } }

    var barra = el('div', 'timers');
    pantalla.appendChild(barra);
    var alarma = el('div', 'alarma');
    alarma.hidden = true;
    pantalla.appendChild(alarma);

    // Sonido: pitidos con WebAudio (no hace falta ningún archivo).
    var audio = null;
    function prepararAudio() {
      try {
        var Ctx = root.AudioContext || root.webkitAudioContext;
        if (!audio && Ctx) audio = new Ctx();
        if (audio && audio.state === 'suspended') audio.resume();
      } catch (e) { audio = null; }
    }
    function pitido() {
      if (!audio) return;
      try {
        [0, 0.25, 0.5].forEach(function (d) {
          var o = audio.createOscillator(), g = audio.createGain();
          o.type = 'square';
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, audio.currentTime + d);
          g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + d + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d + 0.18);
          o.connect(g); g.connect(audio.destination);
          o.start(audio.currentTime + d);
          o.stop(audio.currentTime + d + 0.2);
        });
      } catch (e) { /* sin sonido */ }
    }

    var sonando = [];      // temporizadores que terminaron y nadie apagó
    var sonandoDesde = 0;
    function mostrarAlarma() {
      if (!sonando.length) { alarma.hidden = true; return; }
      alarma.innerHTML = '';
      var c = el('div', 'alarma__caja');
      c.innerHTML = icono('temporizador', 'ic ic--alarma');
      c.appendChild(el('b', 'alarma__titulo', '¡Tiempo!'));
      c.appendChild(el('p', 'alarma__nombre', sonando.map(function (t) { return t.nombre; }).join(' · ')));
      var botones = el('div', 'alarma__botones');
      var mas = el('button', 'alarma__btn alarma__btn--suave', '+1 min');
      mas.addEventListener('click', function () {
        var ahora = Date.now();
        sonando.forEach(function (t) { lista.push(Object.assign(T.crear(1, t.nombre, ahora), { nombre: t.nombre })); });
        sonando = [];
        guardar(); mostrarAlarma(); pintarBarra();
      });
      var ok = el('button', 'alarma__btn', 'Listo');
      ok.addEventListener('click', function () { sonando = []; mostrarAlarma(); });
      botones.appendChild(mas);
      botones.appendChild(ok);
      c.appendChild(botones);
      alarma.appendChild(c);
      alarma.hidden = false;
    }

    function pintarBarra() {
      barra.innerHTML = '';
      var ahora = Date.now();
      lista.forEach(function (t) {
        var b = el('button', 'timer' + (t.terminaEl === null ? ' timer--pausa' : ''));
        b.innerHTML = icono('temporizador', 'ic ic--timer');
        b.appendChild(el('b', null, T.formato(T.restante(t, ahora))));
        b.appendChild(el('span', null, t.nombre));
        b.addEventListener('click', abrirTemporizador);
        barra.appendChild(b);
      });
      barra.hidden = !lista.length;
    }

    function tic() {
      var ahora = Date.now();
      var terminados = lista.filter(function (t) { return T.sono(t, ahora); });
      if (terminados.length) {
        lista = lista.filter(function (t) { return !T.sono(t, ahora); });
        guardar();
        sonando = sonando.concat(terminados);
        sonandoDesde = ahora;
        if (opciones.despertar) opciones.despertar();
        mostrarAlarma();
      }
      // Suena cada 2 segundos hasta que alguien toque "Listo" (máximo 3 minutos).
      if (sonando.length) {
        if (ahora - sonandoDesde < 3 * 60000) { if ((Math.floor(ahora / 1000)) % 2 === 0) pitido(); }
      }
      pintarBarra();
      var enModal = caja.querySelector('.tmr__lista');
      if (enModal && !fondo.hidden) pintarListaModal(enModal);
    }
    setInterval(tic, 1000);
    pintarBarra();

    function empezar(minutos, nombre) {
      prepararAudio();
      lista.push(T.crear(minutos, nombre || minutos + ' min', Date.now()));
      guardar();
      pintarBarra();
      cerrar();
      if (opciones.avisar) opciones.avisar('⏱ Temporizador de ' + (nombre || minutos + ' min') + ' en marcha');
    }

    function pintarListaModal(cont) {
      cont.innerHTML = '';
      var ahora = Date.now();
      lista.forEach(function (t) {
        var f = el('div', 'tmr__fila');
        f.appendChild(el('b', 'tmr__resta', T.formato(T.restante(t, ahora))));
        f.appendChild(el('span', 'tmr__nombre', t.nombre));
        function boton(texto, accion, clase) {
          var b = el('button', 'tmr__btn' + (clase ? ' ' + clase : ''), texto);
          b.addEventListener('click', function () { accion(); guardar(); pintarBarra(); pintarListaModal(cont); });
          f.appendChild(b);
        }
        boton('+1 min', function () { lista = lista.map(function (x) { return x.id === t.id ? T.sumar(x, 60, Date.now()) : x; }); });
        if (t.terminaEl === null) boton('Seguir', function () { lista = lista.map(function (x) { return x.id === t.id ? T.seguir(x, Date.now()) : x; }); });
        else boton('Pausa', function () { lista = lista.map(function (x) { return x.id === t.id ? T.pausar(x, Date.now()) : x; }); });
        boton('Cancelar', function () { lista = lista.filter(function (x) { return x.id !== t.id; }); }, 'tmr__btn--no');
        cont.appendChild(f);
      });
    }

    function abrirTemporizador() {
      prepararAudio();
      var c = el('div', 'tmr');
      var listaCont = el('div', 'tmr__lista');
      pintarListaModal(listaCont);
      c.appendChild(listaCont);
      c.appendChild(el('span', 'lbl', lista.length ? 'Otro temporizador' : 'Elegí cuánto'));
      var grilla = el('div', 'tmr__presets');
      PRESETS.forEach(function (m) {
        var b = el('button', 'tmr__preset');
        b.appendChild(el('b', null, String(m)));
        b.appendChild(el('span', null, 'min'));
        b.addEventListener('click', function () { empezar(m); });
        grilla.appendChild(b);
      });
      c.appendChild(grilla);
      // A medida: − / + de a un minuto
      var propio = 7;
      var fila = el('div', 'tmr__propio');
      var menos = el('button', 'pasos__btn', '−');
      var valor = el('b', 'tmr__valor', propio + ' min');
      var mas = el('button', 'pasos__btn', '+');
      var ir = el('button', 'tmr__empezar', 'Empezar');
      function mostrar() { valor.textContent = propio + ' min'; }
      menos.addEventListener('click', function () { propio = Math.max(1, propio - 1); mostrar(); });
      mas.addEventListener('click', function () { propio = Math.min(180, propio + 1); mostrar(); });
      ir.addEventListener('click', function () { empezar(propio); });
      fila.appendChild(el('span', 'tmr__otro', 'Otro tiempo'));
      fila.appendChild(menos); fila.appendChild(valor); fila.appendChild(mas); fila.appendChild(ir);
      c.appendChild(fila);
      abrir('Temporizador', c);
    }

    return {
      temporizador: abrirTemporizador,
      wifi: abrirWifi,
      qr: mostrarQR,
      hayAlarma: function () { return sonando.length > 0; }
    };
  }

  root.VistaRapidos = { crearRapidos: crearRapidos, svgQR: svgQR };
})(window);
