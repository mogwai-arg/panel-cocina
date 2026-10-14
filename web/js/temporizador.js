/*
 * Temporizadores de cocina y texto del QR del Wi-Fi de invitados. Sin DOM, con tests.
 */
(function (root) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  /* 125 s → "2:05"; 3725 s → "1:02:05". */
  function formato(segundos) {
    var s = Math.max(0, Math.ceil(segundos));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s % 60);
  }

  /*
   * Un temporizador: { id, nombre, segundos, terminaEl (ms) | null, quedan (s, si está en pausa) }.
   * restante(t, ahora) en segundos (0 = sonó).
   */
  function crear(minutos, nombre, ahora) {
    var segundos = Math.round(minutos * 60);
    return { id: 't' + ahora + Math.floor(Math.random() * 1000), nombre: nombre || formato(segundos),
      segundos: segundos, terminaEl: ahora + segundos * 1000, quedan: null };
  }
  function restante(t, ahora) {
    if (t.terminaEl === null) return t.quedan;
    return Math.max(0, (t.terminaEl - ahora) / 1000);
  }
  function pausar(t, ahora) {
    if (t.terminaEl === null) return t;
    return Object.assign({}, t, { quedan: restante(t, ahora), terminaEl: null });
  }
  function seguir(t, ahora) {
    if (t.terminaEl !== null) return t;
    return Object.assign({}, t, { terminaEl: ahora + t.quedan * 1000, quedan: null });
  }
  function sumar(t, segundos, ahora) {
    if (t.terminaEl === null) return Object.assign({}, t, { quedan: Math.max(0, t.quedan + segundos) });
    return Object.assign({}, t, { terminaEl: Math.max(ahora, t.terminaEl + segundos * 1000) });
  }
  function sono(t, ahora) { return t.terminaEl !== null && ahora >= t.terminaEl; }

  /*
   * Texto del QR de Wi-Fi que entienden las cámaras de Android y iPhone:
   * WIFI:T:WPA;S:red;P:clave;;  (con \ antes de \ ; , : ")
   */
  function textoWifi(red, clave, tipo) {
    function esc(s) { return String(s || '').replace(/([\;,:"])/g, '\\$1'); }
    var t = !clave ? 'nopass' : (tipo || 'WPA');
    return 'WIFI:T:' + t + ';S:' + esc(red) + ';' + (clave ? 'P:' + esc(clave) + ';' : '') + ';';
  }

  var api = { formato: formato, crear: crear, restante: restante, pausar: pausar, seguir: seguir,
    sumar: sumar, sono: sono, textoWifi: textoWifi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Temporizador = api;
})(typeof window !== 'undefined' ? window : this);
