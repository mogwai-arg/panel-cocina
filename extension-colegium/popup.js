(function () {
  'use strict';
  var lista = document.getElementById('lista');
  var estado = document.getElementById('estado');
  var capturas = [];

  function pintar() {
    lista.innerHTML = '';
    if (!capturas.length) {
      var li = document.createElement('li');
      li.textContent = 'Todavía nada. Abrí Colegium e iniciá sesión.';
      lista.appendChild(li);
      return;
    }
    capturas.forEach(function (c) {
      var li = document.createElement('li');
      li.textContent = c.metodo + ' ' + c.host + c.ruta + ' (' + c.estado + ')';
      lista.appendChild(li);
    });
  }

  chrome.storage.local.get({ capturas: [] }, function (r) { capturas = r.capturas; pintar(); });

  document.getElementById('copiar').addEventListener('click', function () {
    var texto = JSON.stringify(capturas, null, 1);
    navigator.clipboard.writeText(texto).then(function () {
      estado.textContent = 'Copiado (' + capturas.length + ' pedidos, ' + Math.round(texto.length / 1024) + ' KB). Pegalo en el chat.';
    }, function () {
      estado.textContent = 'No se pudo copiar automáticamente.';
    });
  });

  document.getElementById('borrar').addEventListener('click', function () {
    chrome.storage.local.set({ capturas: [] }, function () { capturas = []; pintar(); estado.textContent = 'Borrado.'; });
  });
})();
