(function () {
  'use strict';
  var resumen = document.getElementById('resumen');
  var envio = document.getElementById('envio');
  var estado = document.getElementById('estado');

  function hace(iso) {
    if (!iso) return 'nunca';
    var min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return 'recién';
    if (min < 60) return 'hace ' + min + ' min';
    if (min < 1440) return 'hace ' + Math.round(min / 60) + ' h';
    return 'hace ' + Math.round(min / 1440) + ' días';
  }

  function fila(dt, dd) {
    var a = document.createElement('dt'); a.textContent = dt;
    var b = document.createElement('dd'); b.textContent = dd;
    resumen.appendChild(a); resumen.appendChild(b);
  }

  function pintar() {
    chrome.storage.local.get({ estado: {}, ultimoEnvio: null, ultimaAuto: 0 }, function (r) {
      chrome.storage.sync.get({ plantillas: {} }, function (s) { pintarCon(r, s.plantillas); });
    });
  }

  function aprendido(plantillas, tipo, datos, texto) {
    if (!plantillas[tipo]) return 'entrá una vez a ' + texto;
    return datos;
  }

  function pintarCon(r, plantillas) {
    var e = r.estado, act = e.actualizado || {};
    resumen.innerHTML = '';
    var com = e.comunicados || [];
    fila('Comunicados', com.length ? com.length + ' (' + com.filter(function (c) { return !c.leido; }).length + ' sin leer) · ' + hace(act.comunicados) : 'todavía no');
    fila('Asistencia', aprendido(plantillas, 'asistencia', e.asistencia ? e.asistencia.presente + '% · ' + hace(act.asistencia) : '–', 'Asistencia'));
    fila('Archivos', aprendido(plantillas, 'archivos', e.archivos ? e.archivos.length + ' · ' + hace(act.archivos) : '–', 'Archivos'));
    fila('Eventos', aprendido(plantillas, 'eventos', e.eventos ? e.eventos.length + ' · ' + hace(act.eventos) : '–', 'Calendario'));
    fila('Horario', e.horario ? hace(act.horario) + ' (no automático)' : 'entrá a Horario si lo querés');
    fila('Automático', r.ultimaAuto ? 'última vez ' + hace(new Date(r.ultimaAuto).toISOString()) : 'en un minuto, con Colegium abierto');
    if (e.sesion && e.sesion.vencida) fila('Sesión', 'Colegium cerró la sesión: entrá de nuevo');
    var u = r.ultimoEnvio;
    envio.className = u ? (u.ok ? 'ok' : 'mal') : '';
    envio.textContent = !u ? 'Todavía no se mandó nada al panel.' :
      u.ok ? '✓ Enviado al panel ' + hace(u.cuando) : '✗ ' + u.error + ' (' + hace(u.cuando) + ')';
  }
  pintar();

  document.getElementById('enviar').addEventListener('click', function () {
    estado.textContent = 'Enviando…';
    chrome.runtime.sendMessage({ accion: 'enviar' }, function () { estado.textContent = ''; pintar(); });
  });
  document.getElementById('configurar').addEventListener('click', function () { chrome.runtime.openOptionsPage(); });

  document.getElementById('copiar').addEventListener('click', function () {
    chrome.storage.local.get({ capturas: [] }, function (r) {
      var texto = JSON.stringify(r.capturas, null, 1);
      navigator.clipboard.writeText(texto).then(function () {
        estado.textContent = 'Copiado (' + r.capturas.length + ' pedidos).';
      }, function () { estado.textContent = 'No se pudo copiar.'; });
    });
  });
  document.getElementById('borrar').addEventListener('click', function () {
    chrome.storage.local.set({ capturas: [] }, function () { estado.textContent = 'Diagnóstico borrado.'; });
  });
})();
