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
  if (msg && msg.sesion) marcarSesion(msg.sesion === 'vencida');
  if (msg && msg.tipo && msg.datos) recibir(msg.tipo, msg.datos);
});

function config() {
  // La configuración vive en sync (sigue a tu cuenta de Chrome); antes estaba en local.
  return new Promise(function (ok) {
    chrome.storage.sync.get({ config: null }, function (s) {
      if (s.config && s.config.url) return ok(s.config);
      chrome.storage.local.get({ config: {} }, function (l) { ok(l.config); });
    });
  });
}

function marcarSesion(vencida) {
  chrome.storage.local.get({ estado: {} }, function (r) {
    var e = r.estado;
    var antes = !!(e.sesion && e.sesion.vencida);
    if (antes === vencida) return;
    e.sesion = { vencida: vencida, cuando: new Date().toISOString() };
    chrome.storage.local.set({ estado: e }, programarEnvio);
  });
}

function programarEnvio() {
  clearTimeout(temporizador);
  temporizador = setTimeout(enviar, 4000);
}

function recibir(tipo, datos) {
  chrome.storage.local.get({ estado: {} }, function (r) {
    var e = C.combinar(r.estado, tipo, datos, new Date());
    e.sesion = { vencida: false, cuando: new Date().toISOString() }; // llegaron datos: la sesión anda
    chrome.storage.local.set({ estado: e }, programarEnvio);
  });
}

function guardarEnvio(resultado) {
  return new Promise(function (ok) {
    chrome.storage.local.set({ ultimoEnvio: resultado }, function () { ok(resultado); });
  });
}

function enviar() {
  return Promise.all([
    new Promise(function (ok) { chrome.storage.local.get({ estado: {} }, ok); }),
    config()
  ]).then(function (res) {
    var r = res[0], cfg = res[1] || {};
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
