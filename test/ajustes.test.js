const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../web/js/ajustes.js');
const D = require('../web/js/descanso.js');

function almacen(inicial) {
  const datos = { 'panel-ajustes': inicial ? JSON.stringify(inicial) : null };
  return { getItem: (k) => datos[k], setItem: (k, v) => { datos[k] = v; }, datos };
}

test('ajustes: valores por defecto desde config.js', () => {
  const a = A.crear({ SEGUNDOS_POR_FOTO: 20, ALTERNAR: { cadaMinutos: 7 }, TEMA_OSCURO: false }, almacen());
  assert.equal(a.valor('segundosFoto'), 20);
  assert.equal(a.valor('alternarCada'), 7);
  assert.equal(a.valor('oscuro'), false);
  assert.equal(a.valor('nocheDesde'), '23:00');
});

test('ajustes: lo guardado manda, pero siempre dentro del rango', () => {
  const al = almacen({ segundosFoto: 999, alternar: false, nocheDesde: '22:15', nocheModo: 'raro' });
  const a = A.crear({}, al);
  assert.equal(a.valor('segundosFoto'), 120);
  assert.equal(a.valor('alternar'), false);
  assert.equal(a.valor('nocheDesde'), '22:15');
  assert.equal(a.valor('nocheModo'), 'apagado');
  assert.equal(a.pasar('segundosFoto', -1), 115);
  assert.equal(JSON.parse(al.datos['panel-ajustes']).segundosFoto, 115);
  assert.equal(a.pasar('nocheDesde', 1), '22:45');
  assert.equal(a.poner('nocheHasta', '23:30') && a.pasar('nocheHasta', 1), '00:00');
  assert.equal(a.pasar('nocheModo', 1), 'tenue');
  a.restablecer();
  assert.equal(a.valor('segundosFoto'), 15);
});

test('ajustes: el descanso usa lo elegido (sensor: apagar en vez de atenuar)', () => {
  const a = A.crear({}, almacen({ sinMovimientoMinutos: 5, sinMovimientoModo: 'apagado', noche: false }));
  const de = (h, m) => new Date(2026, 9, 14, h, m);
  assert.equal(D.estado(de(15, 10), de(15, 0), a.descanso(), true), 'apagado');
  assert.equal(D.estado(de(2, 0), de(1, 0), a.descanso(), false), 'activo'); // sin descanso nocturno
});
