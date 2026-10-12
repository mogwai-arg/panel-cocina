/*
 * Pasa lo que ve la página a la extensión: los datos útiles van al service worker
 * (que los guarda y los manda al panel) y las formas, al diagnóstico (últimas 120).
 */
(function () {
  'use strict';
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data) return;
    if (e.data.fuente === 'panel-colegium-datos') {
      chrome.runtime.sendMessage({ tipo: e.data.tipo, datos: e.data.datos });
      return;
    }
    if (e.data.fuente !== 'panel-colegium') return;
    var c = e.data.captura;
    chrome.storage.local.get({ capturas: [] }, function (r) {
      var clave = c.metodo + ' ' + c.host + c.ruta;
      var lista = r.capturas.filter(function (x) { return x.metodo + ' ' + x.host + x.ruta !== clave; });
      lista.push(c);
      chrome.storage.local.set({ capturas: lista.slice(-120) });
    });
  });
})();
