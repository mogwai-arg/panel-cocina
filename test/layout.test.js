const test = require('node:test');
const assert = require('node:assert/strict');
const Layout = require('../web/js/layout.js');

let n = 0;
function foto(ancho, alto, fecha) {
  n += 1;
  return { id: 'f' + n, ancho, alto, fecha };
}
const H = (fecha) => foto(4000, 3000, fecha);   // horizontal 4:3
const V = (fecha) => foto(3000, 4000, fecha);   // vertical 3:4
const V916 = (fecha) => foto(1080, 1920, fecha); // vertical 9:16
const tipos = (ds) => ds.map((d) => d.tipo + ':' + d.fotos.length);

test('clasifica la orientación', () => {
  assert.equal(Layout.orientacion(H()), 'horizontal');
  assert.equal(Layout.orientacion(V()), 'vertical');
  assert.equal(Layout.orientacion(foto(1000, 1000)), 'cuadrada');
  assert.equal(Layout.orientacion(foto(6000, 2000)), 'panoramica');
});

test('una horizontal va a pantalla completa', () => {
  assert.deepEqual(tipos(Layout.armarDiapositivas([H('2024-01-01')])), ['completa:1']);
});

test('dos verticales del mismo día forman un par', () => {
  const ds = Layout.armarDiapositivas([V('2024-01-01T10:00'), V('2024-01-01T11:00')]);
  assert.deepEqual(tipos(ds), ['par:2']);
});

test('tres verticales 9:16 del mismo día forman un tríptico', () => {
  const d = '2024-03-01';
  const ds = Layout.armarDiapositivas([V916(d), V916(d), V916(d)]);
  assert.deepEqual(tipos(ds), ['triptico:3']);
});

test('tres verticales 3:4 no entran en 16:10: par y la tercera se va con otra suelta o centrada', () => {
  const d = '2024-03-01';
  const ds = Layout.armarDiapositivas([V(d), V(d), V(d)]);
  assert.deepEqual(tipos(ds), ['par:2', 'centrada:1']);
});

test('cuatro verticales del mismo día son dos pares, no tríptico + suelta', () => {
  const d = '2024-03-01';
  const ds = Layout.armarDiapositivas([V916(d), V916(d), V916(d), V916(d)]);
  assert.deepEqual(tipos(ds), ['par:2', 'par:2']);
});

test('verticales sueltas de días distintos se emparejan entre sí', () => {
  const ds = Layout.armarDiapositivas([
    V('2024-01-01'), H('2024-01-02'), V('2024-01-03'),
  ]);
  assert.deepEqual(tipos(ds).sort(), ['completa:1', 'par:2']);
});

test('prioriza el mismo día: no mezcla días si hay pares posibles', () => {
  const ds = Layout.armarDiapositivas([
    V('2024-01-01'), V('2024-01-01'), V('2024-02-01'), V('2024-02-01'),
  ]);
  ds.forEach((d) => {
    assert.equal(d.fotos[0].fecha, d.fotos[1].fecha);
  });
});

test('una vertical sola queda centrada', () => {
  assert.deepEqual(tipos(Layout.armarDiapositivas([V('2024-01-01')])), ['centrada:1']);
});

test('no pierde ni duplica fotos', () => {
  const fotos = [];
  for (let i = 0; i < 40; i++) {
    const fecha = '2024-0' + (1 + (i % 5)) + '-1' + (i % 3);
    fotos.push(i % 3 === 0 ? H(fecha) : i % 7 === 0 ? foto(1000, 1000, fecha) : V(fecha));
  }
  const ids = Layout.armarDiapositivas(fotos).flatMap((d) => d.fotos.map((f) => f.id)).sort();
  assert.deepEqual(ids, fotos.map((f) => f.id).sort());
});

test('un día como hoy: calcula los años', () => {
  const hoy = new Date(2026, 9, 11);
  assert.equal(Layout.haceAnios({ fecha: '2023-10-11T09:00' }, hoy), 3);
  assert.equal(Layout.haceAnios({ fecha: '2026-10-11' }, hoy), null);
  assert.equal(Layout.haceAnios({ fecha: '2023-10-12' }, hoy), null);
  assert.equal(Layout.haceAnios({}, hoy), null);
});

test('ordenar pone primero los recuerdos, del más viejo al más nuevo', () => {
  const hoy = new Date(2026, 9, 11);
  const ds = Layout.armarDiapositivas([
    H('2024-10-11'), H('2020-10-11'), H('2025-01-01'), H('2025-02-01'),
  ]);
  const orden = Layout.ordenar(ds, hoy, Layout.aleatorio(1));
  assert.deepEqual(orden.slice(0, 2).map((d) => d.haceAnios), [6, 2]);
  assert.equal(orden[2].haceAnios, null);
});

test('un video va solo y no corta el collage de verticales del mismo día', () => {
  const video = { id: 'v1', video: true, ancho: 1920, alto: 1080, fecha: '2024-01-01T10:30' };
  const ds = Layout.armarDiapositivas([V('2024-01-01T10:00'), video, V('2024-01-01T11:00')]);
  assert.deepEqual(tipos(ds).sort(), ['par:2', 'video:1']);
  assert.deepEqual(tipos(Layout.armarDiapositivas([video], { sinVideos: true })), []);
});

test('fotos: primero las que no se vieron; los recuerdos, una vez por día', () => {
  const hoy = new Date(2026, 9, 17, 12, 0);
  const d = (id, haceAnios) => ({ fotos: [{ id }], haceAnios: haceAnios || null });
  const sec = [d('r', 3), d('a'), d('b'), d('c'), d('e')];
  const ayer = new Date(2026, 9, 16, 20, 0).getTime();
  const hace1h = hoy.getTime() - 3600000;
  const vistas = { r: ayer, a: hace1h, b: ayer };
  const orden = Layout.priorizarNoVistas(sec, vistas, hoy).map((x) => x.fotos[0].id);
  // r: recuerdo visto ayer → de nuevo primero; c y e sin ver; después b (ayer) y a (hace 1 h)
  assert.deepEqual(orden, ['r', 'c', 'e', 'b', 'a']);
  // el recuerdo ya visto hoy va con las demás
  const orden2 = Layout.priorizarNoVistas(sec, Object.assign({}, vistas, { r: hace1h - 1 }), hoy).map((x) => x.fotos[0].id);
  assert.deepEqual(orden2, ['c', 'e', 'b', 'r', 'a']);
});
