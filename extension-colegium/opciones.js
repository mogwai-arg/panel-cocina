(function () {
  'use strict';
  var url = document.getElementById('url');
  var token = document.getElementById('token');
  var estado = document.getElementById('estado');

  chrome.storage.local.get({ config: {} }, function (r) {
    url.value = r.config.url || '';
    token.value = r.config.token || '';
  });

  document.getElementById('guardar').addEventListener('click', function () {
    var cfg = { url: url.value.trim(), token: token.value.trim() };
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(cfg.url)) {
      estado.textContent = 'La URL tiene que ser la del Apps Script y terminar en /exec.';
      return;
    }
    chrome.storage.local.set({ config: cfg }, function () {
      estado.textContent = 'Guardado. Probando…';
      fetch(cfg.url + '?action=colegium&token=' + encodeURIComponent(cfg.token))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          estado.textContent = d.error ? 'El panel respondió: ' + d.error : '✓ Conectado con el panel.';
        })
        .catch(function (err) { estado.textContent = 'No se pudo conectar: ' + err.message; });
    });
  });
})();
