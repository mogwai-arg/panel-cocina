/*
 * Guarda lo que llega de Colegium y lo manda al Apps Script del panel
 * unos segundos después del último cambio.
 */
importScripts('colegium.js');
var C = self.__panelColegium;
var temporizador = null;

chrome.runtime.onMessage.addListener(function (msg, _sender, responder) {
  if (msg && msg.accion === 'enviar') {
    enviar().then(responder);
    return true; // respuesta asincrónica
  }
  if (msg && msg.tipo && msg.datos) recibir(msg.tipo, msg.datos);
});

function recibir(tipo, datos) {
  chrome.storage.local.get({ estado: {} }, function (r) {
    chrome.storage.local.set({ estado: C.combinar(r.estado, tipo, datos, new Date()) }, function () {
      clearTimeout(temporizador);
      temporizador = setTimeout(enviar, 4000);
    });
  });
}

function guardarEnvio(resultado) {
  return new Promise(function (ok) {
    chrome.storage.local.set({ ultimoEnvio: resultado }, function () { ok(resultado); });
  });
}

function enviar() {
  return new Promise(function (ok) {
    chrome.storage.local.get({ estado: {}, config: {} }, ok);
  }).then(function (r) {
    var cfg = r.config;
    if (!cfg.url || !cfg.token) {
      return guardarEnvio({ cuando: new Date().toISOString(), ok: false, error: 'Falta configurar la URL y el TOKEN del panel' });
    }
    return fetch(cfg.url, {
      method: 'POST',
      // text/plain evita el pedido previo de CORS que Apps Script no maneja
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'colegium', token: cfg.token, datos: r.estado })
    }).then(function (resp) { return resp.json(); }).then(function (d) {
      if (d.error) throw new Error(d.error);
      return guardarEnvio({ cuando: new Date().toISOString(), ok: true });
    }).catch(function (err) {
      return guardarEnvio({ cuando: new Date().toISOString(), ok: false, error: err.message });
    });
  });
}
