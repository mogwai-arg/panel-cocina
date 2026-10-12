/*
 * Pedidos aprendidos ("plantillas") en chrome.storage.sync, uno por clave.
 * Antes iban todos juntos en un solo dato, y Chrome limita cada dato a 8 KB:
 * con muchas materias se llenaba y daba error. Se migran solos.
 */
(function (root) {
  'use strict';
  var PREFIJO = 'pl:';

  function leer(listo) {
    chrome.storage.sync.get(null, function (todo) {
      todo = todo || {};
      var plantillas = {};
      Object.keys(todo.plantillas || {}).forEach(function (k) { plantillas[k] = todo.plantillas[k]; });
      Object.keys(todo).forEach(function (k) {
        if (k.indexOf(PREFIJO) === 0) plantillas[k.slice(PREFIJO.length)] = todo[k];
      });
      if (todo.plantillas) migrar(todo.plantillas);
      listo(plantillas);
    });
  }

  function migrar(viejas) {
    var nuevas = {};
    Object.keys(viejas).forEach(function (k) { nuevas[PREFIJO + k] = viejas[k]; });
    chrome.storage.sync.set(nuevas, function () {
      if (!chrome.runtime.lastError) chrome.storage.sync.remove('plantillas');
    });
  }

  function guardar(clave, pedido) {
    var o = {};
    o[PREFIJO + clave] = pedido;
    chrome.storage.sync.get(PREFIJO + clave, function (r) {
      if (JSON.stringify(r[PREFIJO + clave]) === JSON.stringify(pedido)) return;
      chrome.storage.sync.set(o, function () {
        if (chrome.runtime.lastError) console.warn('Panel: no se pudo guardar', clave, chrome.runtime.lastError.message);
      });
    });
  }

  root.PanelPlantillas = { leer: leer, guardar: guardar };
})(typeof window !== 'undefined' ? window : this);
