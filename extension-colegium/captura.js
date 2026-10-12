/*
 * Corre dentro de la página de Colegium.
 *
 * - Mira las respuestas JSON que la página recibe (fetch y XMLHttpRequest): las
 *   útiles se pasan resumidas a la extensión y de todas se anota la forma para el
 *   diagnóstico.
 * - Aprende la dirección de cada dato útil la primera vez que la página lo pide.
 * - Modo automático: cuando la extensión lo indica, repite esos mismos pedidos con
 *   la sesión abierta en esta pestaña (los datos de sesión quedan solo en memoria).
 *   Nunca pide el detalle de un comunicado, para no marcarlo como leído.
 */
(function () {
  'use strict';
  var forma = window.__panelForma;
  var C = window.__panelColegium;
  var fetchOriginal = window.fetch;
  var cabeceras = {}; // por host, solo en memoria de esta pestaña
  var credenciales = {}; // por host: cómo manda la página las cookies (para repetirlo igual)
  var automatico = false; // true mientras se repiten pedidos (no hay pantalla de la que tomar títulos)

  function aObjeto(h) {
    var o = {};
    if (!h) return o;
    if (typeof Headers !== 'undefined' && h instanceof Headers) h.forEach(function (v, k) { o[k] = v; });
    else if (Array.isArray(h)) h.forEach(function (par) { o[par[0]] = par[1]; });
    else Object.keys(h).forEach(function (k) { o[k] = h[k]; });
    delete o['content-length'];
    delete o['Content-Length'];
    return o;
  }

  function recordarCabeceras(url, h) {
    try {
      var host = new URL(url, location.href).host;
      if (!/colegium\.cloud$/.test(host)) return;
      var o = aObjeto(h);
      if (Object.keys(o).length) cabeceras[host] = o;
    } catch (e) { /* nada */ }
  }

  /*
   * Las cabeceras guardadas son las del último pedido de la página (casi siempre un GET).
   * Para repetir un POST hay que decir de qué tipo es el cuerpo: sin eso Colegium
   * no lo entiende y responde vacío (así se "borraban" las notas).
   */
  function conTipo(h, cuerpo) {
    var o = {};
    Object.keys(h || {}).forEach(function (k) { if (k.toLowerCase() !== 'content-type') o[k] = h[k]; });
    if (typeof cuerpo === 'string' && cuerpo) {
      var json = /^\s*[\[{]/.test(cuerpo);
      o['Content-Type'] = json ? 'application/json' : 'application/x-www-form-urlencoded; charset=UTF-8';
    }
    return o;
  }

  /* Forma del cuerpo de un pedido (JSON o formulario), para el diagnóstico. */
  function formaCuerpo(cuerpo) {
    if (cuerpo === undefined || cuerpo === null || cuerpo === '') return null;
    if (typeof cuerpo === 'string') {
      try { return forma(JSON.parse(cuerpo)); } catch (e) { /* no es JSON */ }
      var o = {};
      try { new URLSearchParams(cuerpo).forEach(function (v, k) { o[k] = forma(v); }); } catch (e) { /* nada */ }
      return Object.keys(o).length ? o : '(texto de ' + cuerpo.length + ' caracteres)';
    }
    if (typeof FormData !== 'undefined' && cuerpo instanceof FormData) {
      var f = {};
      cuerpo.forEach(function (v, k) { f[k] = typeof v === 'string' ? forma(v) : '(archivo)'; });
      return f;
    }
    return '(' + (cuerpo.constructor && cuerpo.constructor.name || typeof cuerpo) + ')';
  }

  /* Título visible de la página (para ponerle nombre a una materia si no se sabe). */
  function tituloVisible() {
    var candidatos = document.querySelectorAll('h1, h2, h3, [class*="titulo"], [class*="title"]');
    for (var i = 0; i < candidatos.length; i++) {
      var t = (candidatos[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length >= 3 && t.length <= 60 && !/calificaci|colegium|inicio|men[uú]/i.test(t)) return t;
    }
    return '';
  }

  function cuerpoTexto(cuerpo) {
    if (typeof cuerpo === 'string') return cuerpo;
    if (typeof URLSearchParams !== 'undefined' && cuerpo instanceof URLSearchParams) return cuerpo.toString();
    return null; // FormData u otros: no se pueden repetir
  }

  function avisar(metodo, url, estado, texto, cuerpo) {
    var u;
    try { u = new URL(url, location.href); } catch (e) { return; }
    var tipo = C.reconocer(u.pathname, metodo);

    if (tipo && (estado === 401 || estado === 403)) {
      window.postMessage({ fuente: 'panel-colegium-sesion', vencida: true }, location.origin);
      return;
    }
    var datos;
    try { datos = JSON.parse(texto); } catch (e) { return; } // solo JSON

    if (tipo && estado === 200) {
      var mandar = function (titulo) {
        try {
          var normal = C.normalizar(tipo, datos, { cuerpo: cuerpoTexto(cuerpo), ruta: u.pathname, titulo: titulo });
          window.postMessage({ fuente: 'panel-colegium-datos', tipo: tipo, datos: normal }, location.origin);
          var clave = tipo === 'calificaciones' ? 'calificaciones:' + normal.relId : tipo;
          window.postMessage({ fuente: 'panel-colegium-plantilla', clave: clave,
            pedido: { url: u.href, metodo: metodo, cuerpo: cuerpoTexto(cuerpo) } }, location.origin);
        } catch (e) { /* si Colegium cambió el formato, no rompe la página */ }
      };
      // En calificaciones, el nombre de la materia se toma de la pantalla cuando termina de dibujarse.
      if (tipo === 'calificaciones' && !automatico) setTimeout(function () { mandar(tituloVisible()); }, 1500);
      else mandar('');
    }

    var params = {};
    u.searchParams.forEach(function (_, k) { params[k] = true; });
    window.postMessage({
      fuente: 'panel-colegium',
      captura: {
        metodo: metodo, host: u.host, ruta: u.pathname, parametros: Object.keys(params),
        pedido: formaCuerpo(cuerpo),
        estado: estado, reconocido: tipo, forma: forma(datos), cuando: new Date().toISOString()
      }
    }, location.origin);
  }

  window.fetch = function (entrada, opciones) {
    var metodo = ((opciones && opciones.method) || (entrada && entrada.method) || 'GET').toUpperCase();
    var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || String(entrada);
    recordarCabeceras(url, (opciones && opciones.headers) || (entrada && entrada.headers));
    try {
      var modo = (opciones && opciones.credentials) || (entrada && entrada.credentials);
      if (modo) credenciales[new URL(url, location.href).host] = modo;
    } catch (e) { /* nada */ }
    return fetchOriginal.apply(this, arguments).then(function (resp) {
      try {
        var cuerpo = opciones && opciones.body;
        resp.clone().text().then(function (t) { avisar(metodo, url, resp.status, t, cuerpo); }).catch(function () {});
      } catch (e) { /* nada */ }
      return resp;
    });
  };

  var abrir = XMLHttpRequest.prototype.open;
  var enviar = XMLHttpRequest.prototype.send;
  var ponerCabecera = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (metodo, url) {
    this.__panel = { metodo: String(metodo).toUpperCase(), url: url, cabeceras: {} };
    return abrir.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (nombre, valor) {
    if (this.__panel) this.__panel.cabeceras[nombre] = valor;
    return ponerCabecera.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (cuerpo) {
    var xhr = this;
    if (xhr.__panel) xhr.__panel.cuerpo = cuerpo;
    if (xhr.__panel) {
      recordarCabeceras(xhr.__panel.url, xhr.__panel.cabeceras);
      try { if (xhr.withCredentials) credenciales[new URL(xhr.__panel.url, location.href).host] = 'include'; } catch (e) { /* nada */ }
    }
    xhr.addEventListener('load', function () {
      if (!xhr.__panel) return;
      if (xhr.responseType && xhr.responseType !== 'text' && xhr.responseType !== 'json') return;
      var texto = xhr.responseType === 'json' ? JSON.stringify(xhr.response) : xhr.responseText;
      avisar(xhr.__panel.metodo, xhr.__panel.url, xhr.status, texto, xhr.__panel.cuerpo);
    });
    return enviar.apply(this, arguments);
  };

  // Modo automático: repetir los pedidos aprendidos, de a uno y espaciados.
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.fuente !== 'panel-colegium-actualizar') return;
    var pedidos = (e.data.pedidos || []).map(function (p) { return typeof p === 'string' ? { url: p, metodo: 'GET' } : p; });
    pedidos.forEach(function (p, i) {
      setTimeout(function () {
        var u;
        try { u = new URL(p.url); } catch (err) { return; }
        if (!/colegium\.cloud$/.test(u.host)) return;
        var metodo = (p.metodo || 'GET').toUpperCase();
        var tipo = C.reconocer(u.pathname, metodo);
        if (!tipo || tipo === 'comunicado') return; // solo lo conocido, y nunca marcar como leído
        var opciones = { method: metodo, headers: conTipo(cabeceras[u.host], metodo !== 'GET' ? p.cuerpo : null) };
        if (metodo !== 'GET' && p.cuerpo) opciones.body = p.cuerpo;
        if (credenciales[u.host]) opciones.credentials = credenciales[u.host];
        automatico = true;
        fetchOriginal(p.url, opciones).then(function (resp) {
          return resp.text().then(function (t) { avisar(metodo, p.url, resp.status, t, p.cuerpo); });
        }).catch(function () { /* sin conexión: se reintenta en el próximo ciclo */ })
          .then(function () { automatico = false; });
      }, i * 2500);
    });
  });
})();
