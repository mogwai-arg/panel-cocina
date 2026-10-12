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
  var AUTOMATICOS = ['comunicados', 'asistencia', 'faltas', 'archivos', 'eventos', 'periodos'];
  function esAutomatico(clave) {
    return AUTOMATICOS.indexOf(clave) >= 0 || /^calificaciones:.+/.test(clave);
  }

  // Al actualizar la extensión, esta copia vieja (en una pestaña ya abierta) queda
  // desconectada: deja de hacer cosas en vez de tirar errores. Recargá la pestaña.
  function conectada() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || !conectada()) return;
    var d = e.data;
    if (d.fuente === 'panel-colegium-datos') {
      chrome.runtime.sendMessage({ tipo: d.tipo, datos: d.datos });
    } else if (d.fuente === 'panel-colegium-sesion') {
      chrome.runtime.sendMessage({ sesion: d.vencida ? 'vencida' : 'ok' });
    } else if (d.fuente === 'panel-colegium-plantilla') {
      if (!esAutomatico(d.clave)) return;
      PanelPlantillas.guardar(d.clave, d.pedido);
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
    if (!conectada()) { clearInterval(intervalo); return; }
    chrome.storage.local.get({ ultimaAuto: 0 }, function (r) {
      if (Date.now() - r.ultimaAuto < MINUTOS * 60000) return; // otra pestaña ya lo hizo
      chrome.storage.local.set({ ultimaAuto: Date.now() }, function () {
        PanelPlantillas.leer(function (plantillas) {
          var pedidos = Object.keys(plantillas).filter(esAutomatico).map(function (k) { return plantillas[k]; });
          if (pedidos.length) window.postMessage({ fuente: 'panel-colegium-actualizar', pedidos: pedidos }, location.origin);
        });
      });
    });
  }

  // La primera vez, un minuto después de abrir (la página ya cargó lo suyo).
  setTimeout(quizasActualizar, 60000);
  var intervalo = setInterval(quizasActualizar, 5 * 60000);
})();
