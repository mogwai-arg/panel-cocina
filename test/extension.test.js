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

test('plantillas: una por clave y migra el formato viejo', async () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const sync = { plantillas: { asistencia: { url: 'a' } } };
  const chrome = {
    runtime: { lastError: null },
    storage: { sync: {
      get(claves, cb) {
        if (claves === null) return cb({ ...sync });
        cb({ [claves]: sync[claves] });
      },
      set(o, cb) { Object.assign(sync, o); if (cb) cb(); },
      remove(k) { delete sync[k]; }
    } }
  };
  const ctx = { chrome, console, window: {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension-colegium/plantillas.js'), 'utf8'), ctx);
  ctx.PanelPlantillas.guardar('calificaciones:X', { url: 'c', metodo: 'POST' });
  const leidas = await new Promise((ok) => ctx.PanelPlantillas.leer(ok));
  assert.deepEqual(Object.keys(leidas).sort(), ['asistencia', 'calificaciones:X']);
  assert.equal(sync.plantillas, undefined);
  assert.deepEqual(sync['pl:asistencia'], { url: 'a' });
});
