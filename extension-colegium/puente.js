/*
 * Puente entre la página de Colegium y la extensión.
 * - Datos útiles → service worker (los guarda y los manda al panel).
 * - Direcciones aprendidas → chrome.storage.sync (siguen a tu cuenta de Chrome).
 * - Formas → diagnóstico (últimas 120).
 * - Cada 30 minutos le pide a la página que actualice (una sola pestaña a la vez).
 */
(function () {
  'use strict';
  var MINUTOS = 30;
  // Datos que se actualizan solos. El horario no (cambia poco) ni el detalle de
  // un comunicado (abrirlo lo marca como leído en Colegium).
  var AUTOMATICOS = ['comunicados', 'asistencia', 'faltas', 'archivos', 'eventos'];
  function esAutomatico(clave) {
    return AUTOMATICOS.indexOf(clave) >= 0 || /^calificaciones:.+/.test(clave);
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data) return;
    var d = e.data;
    if (d.fuente === 'panel-colegium-datos') {
      chrome.runtime.sendMessage({ tipo: d.tipo, datos: d.datos });
    } else if (d.fuente === 'panel-colegium-sesion') {
      chrome.runtime.sendMessage({ sesion: d.vencida ? 'vencida' : 'ok' });
    } else if (d.fuente === 'panel-colegium-plantilla') {
      if (!esAutomatico(d.clave)) return;
      chrome.storage.sync.get({ plantillas: {} }, function (r) {
        var nuevo = JSON.stringify(d.pedido);
        if (JSON.stringify(r.plantillas[d.clave]) === nuevo) return;
        r.plantillas[d.clave] = d.pedido;
        chrome.storage.sync.set({ plantillas: r.plantillas });
      });
    } else if (d.fuente === 'panel-colegium') {
      var c = d.captura;
      if (/\/assets\/|nr-data\.net/.test(c.host + c.ruta)) return; // textos de la app y estadísticas: no sirven
      chrome.storage.local.get({ capturas: [] }, function (r) {
        var clave = c.metodo + ' ' + c.host + c.ruta;
        var lista = r.capturas.filter(function (x) { return x.metodo + ' ' + x.host + x.ruta !== clave; });
        lista.push(c);
        chrome.storage.local.set({ capturas: lista.slice(-80) });
      });
    }
  });

  function quizasActualizar() {
    chrome.storage.local.get({ ultimaAuto: 0 }, function (r) {
      if (Date.now() - r.ultimaAuto < MINUTOS * 60000) return; // otra pestaña ya lo hizo
      chrome.storage.local.set({ ultimaAuto: Date.now() }, function () {
        chrome.storage.sync.get({ plantillas: {} }, function (p) {
          var pedidos = Object.keys(p.plantillas).filter(esAutomatico).map(function (k) { return p.plantillas[k]; });
          if (pedidos.length) window.postMessage({ fuente: 'panel-colegium-actualizar', pedidos: pedidos }, location.origin);
        });
      });
    });
  }

  // La primera vez, un minuto después de abrir (la página ya cargó lo suyo).
  setTimeout(quizasActualizar, 60000);
  setInterval(quizasActualizar, 5 * 60000);
})();
