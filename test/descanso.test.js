const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../web/js/descanso.js');

const a = (h, m) => new Date(2026, 9, 12, h, m || 0);

test('descanso: la noche cruza la medianoche', () => {
  const noche = { desde: '23:00', hasta: '07:00' };
  assert.equal(D.esDeNoche(a(23, 30), noche), true);
  assert.equal(D.esDeNoche(a(3, 0), noche), true);
  assert.equal(D.esDeNoche(a(7, 0), noche), false);
  assert.equal(D.esDeNoche(a(14, 0), { desde: '13:00', hasta: '15:00' }), true);
});

test('descanso: de noche se apaga, y al tocar se despierta 5 minutos', () => {
  assert.equal(D.estado(a(2, 0), a(1, 0), {}, false), 'apagado');
  assert.equal(D.estado(a(2, 0), a(1, 57), {}, false), 'activo');
  assert.equal(D.estado(a(2, 0), a(1, 0), { noche: { modo: 'tenue' } }, false), 'tenue');
  assert.equal(D.estado(a(2, 0), a(1, 0), { noche: false }, false), 'activo');
});

test('descanso: de día se atenúa sin movimiento solo si hay sensor', () => {
  assert.equal(D.estado(a(15, 0), a(14, 0), {}, false), 'activo');
  assert.equal(D.estado(a(15, 0), a(14, 0), {}, true), 'tenue');
  assert.equal(D.estado(a(15, 0), a(14, 50), {}, true), 'activo');
});
