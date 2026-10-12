const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Listas = require('../web/js/listas.js');

const LUNES = new Date(2026, 9, 12, 16, 0); // lunes 12/10, a la tarde
const SABADO = new Date(2026, 9, 17, 9, 0);
const t = (id, persona, momento, dias, hecha) => ({ id, tarea: 'T' + id, persona, momento, estrellas: 1, dias, hecha: !!hecha });

test('momento del día', () => {
  assert.equal(Listas.momentoActual(new Date(2026, 0, 1, 8)), 'Mañana');
  assert.equal(Listas.momentoActual(new Date(2026, 0, 1, 15)), 'Tarde');
  assert.equal(Listas.momentoActual(new Date(2026, 0, 1, 21)), 'Noche');
});

test('días en que toca, con o sin acentos', () => {
  assert.equal(Listas.tocaHoy({ dias: '' }, LUNES), true);
  assert.equal(Listas.tocaHoy({ dias: 'lun,mié' }, LUNES), true);
  assert.equal(Listas.tocaHoy({ dias: 'sábado' }, LUNES), false);
  assert.equal(Listas.tocaHoy({ dias: 'sáb' }, SABADO), true);
  assert.equal(Listas.tocaHoy({ dias: 'Lunes, Miércoles' }, LUNES), true);
});

test('columnas de tareas por persona, "Cualquiera" al final', () => {
  const tareas = [
    t(1, 'Cualquiera', 'Tarde', ''),
    t(2, 'Thiago', 'Tarde', 'lun', true),
    t(3, 'Thiago', 'Mañana', ''),
    t(4, 'Javi', '', ''),          // sin momento: aparece siempre
    t(5, 'Javi', 'Tarde', 'sáb'),  // no toca el lunes
  ];
  const cols = Listas.columnasDeTareas(tareas, LUNES, 'Tarde');
  assert.deepEqual(cols.map((c) => c.persona + ':' + c.hechas + '/' + c.total), ['Thiago:1/1', 'Javi:0/1', 'Cualquiera:0/1']);
});

test('progreso del día cuenta todos los momentos', () => {
  const p = Listas.progresoDelDia([t(1, 'Thiago', 'Mañana', '', true), t(2, 'Thiago', 'Noche', '')], LUNES);
  assert.deepEqual(p, [{ persona: 'Thiago', hechas: 1, total: 2 }]);
});

test('compras por categoría, pendientes primero', () => {
  const g = Listas.comprasPorCategoria([
    { id: 1, item: 'Yerba', categoria: 'Almacén', comprado: true },
    { id: 2, item: 'Leche', categoria: 'Lácteos', comprado: false },
    { id: 3, item: 'Arroz', categoria: 'Almacén', comprado: false },
  ]);
  assert.deepEqual(g.map((x) => x.categoria + ':' + x.items.map((i) => i.item).join('+')), ['Almacén:Arroz+Yerba', 'Lácteos:Leche']);
});

test('habituales marcan lo que ya está en la lista', () => {
  const h = Listas.habitualesConEstado(
    [{ item: 'Café', categoria: 'Almacén' }, { item: 'Pan', categoria: 'Panadería' }],
    [{ item: 'cafe', cantidad: 2, comprado: false }, { item: 'Pan', cantidad: 1, comprado: true }]);
  assert.deepEqual(h.map((x) => x.item + ':' + x.enLista + ':' + x.cantidad), ['Café:true:2', 'Pan:false:0']);
});

// Funciones puras de Listas.gs (con un Utilities mínimo de reemplazo)
const ctx = {
  Utilities: {
    formatDate: (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Listas.gs'), 'utf8'), ctx);

test('Listas.gs: lunes de la semana', () => {
  assert.equal(ctx.lunesDe_('2026-10-12'), '2026-10-12');
  assert.equal(ctx.lunesDe_('2026-10-18'), '2026-10-12'); // domingo
  assert.equal(ctx.lunesDe_('2026-10-14'), '2026-10-12');
});

test('Listas.gs: estrellas de la semana por persona', () => {
  const historial = [
    { fecha: '2026-10-11', persona: 'Thiago', estrellas: 5 }, // semana anterior
    { fecha: '2026-10-12', persona: 'Thiago', estrellas: 2 },
    { fecha: new Date(2026, 9, 13, 12), persona: 'Thiago', estrellas: 1 },
    { fecha: '2026-10-13', persona: 'Javi', estrellas: 1 },
  ];
  assert.deepEqual({ ...ctx.estrellasDeLaSemana_(historial, '2026-10-14') }, { Thiago: 3, Javi: 1 });
});

// Hoja falsa para probar lectura y escritura sin Google
function hojaFalsa(filas) {
  const datos = filas.map((f) => f.slice());
  return {
    datos,
    getDataRange: () => ({ getValues: () => datos.map((f) => f.slice()) }),
    getRange: (fila, col, nf, nc) => ({
      setValue: (v) => { datos[fila - 1][col - 1] = v; },
      setValues: ([vals]) => { vals.forEach((v, j) => { datos[fila - 1][col - 1 + j] = v; }); },
    }),
    appendRow: (vals) => datos.push(vals.slice()),
    getLastRow: () => datos.length,
  };
}

test('Listas.gs: las filas con casillas sin tildar cuentan como vacías', () => {
  ctx.Utilities.getUuid = () => 'abcdef12-xxxx';
  const hoja = hojaFalsa([
    ['id', 'item', 'cantidad', 'categoria', 'comprado', 'comprado_el', 'agregado_el'],
    ['a1', 'Leche', 2, 'Lácteos', false, '', '2026-10-12'],
    ['', '', '', '', false, '', ''],
    ['', 'Pan', 1, '', false, '', ''], // cargado a mano, sin id
    ['', '', '', '', false, '', ''],
  ]);
  const libro = { getSheetByName: () => hoja };
  const filas = ctx.leerHoja_(libro, 'Compras');
  assert.deepEqual([...filas.map((f) => f.item)], ['Leche', 'Pan']);
  assert.equal(filas[1].id, 'abcdef12');
  assert.equal(hoja.datos[3][0], 'abcdef12'); // quedó guardado en la planilla
});

test('Listas.gs: agrega en la primera fila libre, no al final de las casillas', () => {
  const hoja = hojaFalsa([
    ['id', 'item', 'comprado'],
    ['a1', 'Leche', false],
    ['', '', false],
    ['', '', false],
  ]);
  assert.equal(ctx.agregarFila_(hoja, ['b2', 'Yerba', false]), 3);
  assert.deepEqual([...hoja.datos[2]], ['b2', 'Yerba', false]);
  const llena = hojaFalsa([['id', 'item'], ['a1', 'Leche']]);
  assert.equal(ctx.agregarFila_(llena, ['b2', 'Yerba']), 3);
});

test('las personas fijas tienen columna aunque no tengan nada, y el nombre se compara sin espacios ni mayúsculas', () => {
  const cols = Listas.columnasDeTareas([t(1, 'dan ', 'Tarde', ''), t(2, 'Thi', 'Mañana', '')], LUNES, 'Tarde', ['Thi', 'Javi', 'Dan']);
  assert.deepEqual(cols.map((c) => c.persona + ':' + c.total), ['Thi:0', 'Javi:0', 'Dan:1']);
});
