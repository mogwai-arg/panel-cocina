/*
 * Ubicación (OwnTracks → Apps Script): textos y mapita (sin DOM, con tests).
 */
(function (root) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function hora(iso) { var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function distancia(m) {
    return m < 1000 ? m + ' m' : (Math.round(m / 100) / 10).toString().replace('.', ',') + ' km';
  }

  function haceCuanto(iso, ahora) {
    var min = Math.round((ahora - new Date(iso)) / 60000);
    if (min < 2) return 'recién';
    if (min < 60) return 'hace ' + min + ' min';
    var h = Math.round(min / 60);
    return h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.round(h / 24) + ' d';
  }

  /*
   * Qué decir de una persona: { titulo, detalle, viejo }.
   * OwnTracks manda cuando se mueve; quieto puede pasar horas sin mandar nada,
   * así que "viejo" (más de 3 h) solo se avisa, no es un error.
   */
  function describir(p, ahora) {
    var titulo;
    if (p.lugar) titulo = 'En ' + p.lugar;
    else if (p.velocidad && p.velocidad > 12) titulo = 'En viaje';
    else if (p.cercano) titulo = 'A ' + distancia(p.cercano.metros) + ' de ' + p.cercano.nombre;
    else titulo = 'Fuera de los lugares';
    var partes = [];
    if (p.lugar && p.desde) partes.push('desde las ' + hora(p.desde));
    partes.push(haceCuanto(p.cuando, ahora));
    if (p.bateria) partes.push('🔋 ' + p.bateria + '%');
    var viejo = ahora - new Date(p.cuando) > 3 * 3600000;
    return { titulo: titulo, detalle: partes.join(' · '), viejo: viejo, bateriaBaja: !!(p.bateria && p.bateria <= 15) };
  }

  /*
   * Mosaico de OpenStreetMap que contiene el punto, y dónde cae el punto dentro de él
   * (en píxeles, de 0 a 256). Fórmula estándar de "slippy map".
   */
  function mosaico(lat, lon, zoom) {
    var n = Math.pow(2, zoom);
    var x = (lon + 180) / 360 * n;
    var latRad = lat * Math.PI / 180;
    var y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return { x: Math.floor(x), y: Math.floor(y), px: Math.round((x % 1) * 256), py: Math.round((y % 1) * 256), zoom: zoom };
  }

  var api = { describir: describir, mosaico: mosaico, distancia: distancia };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ubicacion = api;
})(typeof window !== 'undefined' ? window : this);
