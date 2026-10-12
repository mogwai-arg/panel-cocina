/*
 * Modo descanso de la pantalla (sin DOM, con tests):
 *   - de noche (por defecto 23 a 7) la pantalla queda negra ("apagado") o tenue;
 *     si alguien la toca o pasa por adelante, se despierta unos minutos;
 *   - de día, si el marco avisa movimiento (sensor) y no hay nadie hace un rato, se atenúa.
 *     Hasta que el sensor mande su primera señal esta regla no se usa: sin sensor, no
 *     sabríamos si hay alguien mirando sin tocar.
 *
 * config.DESCANSO = { noche: { desde: '23:00', hasta: '07:00', modo: 'apagado' | 'tenue' },
 *                     despiertoMinutos: 5, sinMovimientoMinutos: 20 }
 */
(function (root) {
  'use strict';

  var PREDETERMINADO = { noche: { desde: '23:00', hasta: '07:00', modo: 'apagado' }, despiertoMinutos: 5, sinMovimientoMinutos: 20 };

  function minutosDelDia(hhmm) {
    var p = String(hhmm || '').split(':');
    return Number(p[0]) * 60 + Number(p[1] || 0);
  }

  function esDeNoche(ahora, noche) {
    if (!noche || !noche.desde || !noche.hasta) return false;
    var m = ahora.getHours() * 60 + ahora.getMinutes();
    var desde = minutosDelDia(noche.desde), hasta = minutosDelDia(noche.hasta);
    return desde <= hasta ? m >= desde && m < hasta : m >= desde || m < hasta; // cruza la medianoche
  }

  function configuracion(cfg) {
    cfg = cfg || {};
    return {
      noche: cfg.noche === false ? null : Object.assign({}, PREDETERMINADO.noche, cfg.noche || {}),
      despiertoMinutos: cfg.despiertoMinutos || PREDETERMINADO.despiertoMinutos,
      sinMovimientoMinutos: cfg.sinMovimientoMinutos || PREDETERMINADO.sinMovimientoMinutos
    };
  }

  /*
   * 'activo' | 'tenue' | 'apagado'.
   * ultimaActividad: último toque o movimiento. haySensor: el sensor ya mandó alguna señal.
   */
  function estado(ahora, ultimaActividad, cfg, haySensor) {
    var c = configuracion(cfg);
    var minutos = (ahora - ultimaActividad) / 60000;
    if (esDeNoche(ahora, c.noche)) return minutos < c.despiertoMinutos ? 'activo' : c.noche.modo;
    if (haySensor && minutos >= c.sinMovimientoMinutos) return 'tenue';
    return 'activo';
  }

  /*
   * Alternar fotos y panel: ¿toca mostrar el panel un rato? Sí, si hace `cadaMinutos`
   * que se ven fotos y que nadie toca la pantalla.
   */
  function tocaPanel(ahora, enFotosDesde, ultimaActividad, cfg) {
    var cada = ((cfg && cfg.cadaMinutos) || 10) * 60000;
    return ahora - enFotosDesde >= cada && ahora - ultimaActividad >= cada;
  }

  var api = { tocaPanel: tocaPanel, estado: estado, esDeNoche: esDeNoche, configuracion: configuracion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Descanso = api;
})(typeof window !== 'undefined' ? window : this);
