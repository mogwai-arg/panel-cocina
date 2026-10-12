/* Recibe los resúmenes de la página y los guarda en la extensión (últimos 120). */
(function () {
  'use strict';
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.fuente !== 'panel-colegium') return;
    var c = e.data.captura;
    chrome.storage.local.get({ capturas: [] }, function (r) {
      var clave = c.metodo + ' ' + c.host + c.ruta;
      var lista = r.capturas.filter(function (x) { return x.metodo + ' ' + x.host + x.ruta !== clave; });
      lista.push(c);
      chrome.storage.local.set({ capturas: lista.slice(-120) });
    });
  });
})();
