/*
 * Resume la forma de una respuesta JSON: nombres de campos, tipos, largo de las
 * listas y un pedacito de cada texto. Sirve para entender los datos sin copiarlos enteros.
 */
(function (root) {
  'use strict';

  function recortar(s) {
    s = String(s);
    if (/@/.test(s)) return '<mail>';
    return s.length > 28 ? s.slice(0, 28) + '...(' + s.length + ')' : s;
  }

  // Datos personales que no hacen falta para entender la estructura.
  var OCULTAR = /^(dni|documento|cuil|cuit|telefono|celular|movil|fecha_nac|fecha_nacimiento|nacimiento|direccion|domicilio)$/i;

  function forma(v, profundidad) {
    profundidad = profundidad || 0;
    if (v === null || v === undefined) return v;
    if (Array.isArray(v)) {
      if (!v.length) return [];
      return profundidad >= 5 ? ['...' + v.length + ' elementos'] : [forma(v[0], profundidad + 1), '...' + v.length + ' elementos'];
    }
    if (typeof v === 'object') {
      if (profundidad >= 5) return '{...' + Object.keys(v).length + ' campos}';
      var o = {};
      Object.keys(v).slice(0, 40).forEach(function (k) {
        o[k] = OCULTAR.test(k) && v[k] ? '<oculto>' : forma(v[k], profundidad + 1);
      });
      return o;
    }
    if (typeof v === 'string') return recortar(v);
    return v;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { forma: forma };
  else root.__panelForma = forma;
})(typeof window !== 'undefined' ? window : this);
