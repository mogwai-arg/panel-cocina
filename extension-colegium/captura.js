/*
 * Corre dentro de la página de Colegium. Mira las respuestas JSON que la página
 * ya recibe (fetch y XMLHttpRequest): las que sirven al panel se pasan resumidas
 * a la extensión, y de todas se anota la forma para el diagnóstico.
 * No hace ningún pedido propio a Colegium.
 */
(function () {
  'use strict';
  var forma = window.__panelForma;
  var C = window.__panelColegium;

  function avisar(metodo, url, estado, texto) {
    var datos;
    try { datos = JSON.parse(texto); } catch (e) { return; } // solo JSON
    var u;
    try { u = new URL(url, location.href); } catch (e) { return; }

    var tipo = metodo === 'GET' && estado === 200 ? C.reconocer(u.pathname) : null;
    if (tipo) {
      try {
        window.postMessage({ fuente: 'panel-colegium-datos', tipo: tipo, datos: C.normalizar(tipo, datos) }, location.origin);
      } catch (e) { /* si Colegium cambió el formato, no rompe la página */ }
    }

    var params = {};
    u.searchParams.forEach(function (_, k) { params[k] = true; });
    window.postMessage({
      fuente: 'panel-colegium',
      captura: {
        metodo: metodo, host: u.host, ruta: u.pathname, parametros: Object.keys(params),
        estado: estado, reconocido: tipo, forma: forma(datos), cuando: new Date().toISOString()
      }
    }, location.origin);
  }

  var fetchOriginal = window.fetch;
  window.fetch = function (entrada, opciones) {
    var metodo = ((opciones && opciones.method) || (entrada && entrada.method) || 'GET').toUpperCase();
    var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || String(entrada);
    return fetchOriginal.apply(this, arguments).then(function (resp) {
      try {
        resp.clone().text().then(function (t) { avisar(metodo, url, resp.status, t); }).catch(function () {});
      } catch (e) { /* nada */ }
      return resp;
    });
  };

  var abrir = XMLHttpRequest.prototype.open;
  var enviar = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (metodo, url) {
    this.__panel = { metodo: String(metodo).toUpperCase(), url: url };
    return abrir.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    xhr.addEventListener('load', function () {
      if (!xhr.__panel) return;
      if (xhr.responseType && xhr.responseType !== 'text' && xhr.responseType !== 'json') return;
      var texto = xhr.responseType === 'json' ? JSON.stringify(xhr.response) : xhr.responseText;
      avisar(xhr.__panel.metodo, xhr.__panel.url, xhr.status, texto);
    });
    return enviar.apply(this, arguments);
  };
})();
