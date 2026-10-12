const test = require('node:test');
const assert = require('node:assert/strict');
const { forma } = require('../extension-colegium/forma.js');

test('extensión: resume la forma de una respuesta sin copiarla entera', () => {
  const r = forma({
    alumno: { nombre: 'Thiago', email: 'thiago@gmail.com' },
    comunicados: [{ id: 1, titulo: 'Reunión de padres del segundo trimestre', fecha: '2026-10-20' }, { id: 2 }],
    vacio: [],
  });
  assert.deepEqual(r, {
    alumno: { nombre: 'Thiago', email: '<mail>' },
    comunicados: [{ id: 1, titulo: 'Reunión de padres del segund...(39)', fecha: '2026-10-20' }, '...2 elementos'],
    vacio: [],
  });
});
