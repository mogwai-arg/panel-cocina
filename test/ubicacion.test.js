const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Ubicacion.gs'), 'utf8'), ctx);

const lugares = [
  { nombre: 'Casa', lat: -34.6521, lon: -58.6443, radio: 150, avisar: false },
  { nombre: 'Colegio', lat: -34.6480, lon: -58.6200, radio: 150, avisar: true }
];
const ahora = new Date('2026-10-12T16:00:00Z');
const msg = (lat, lon, tst, extra) => Object.assign({ _type: 'location', lat, lon, acc: 20, batt: 64, tst }, extra || {});

test('ubicación: distancia y lugar', () => {
  assert.ok(Math.abs(ctx.metros_(-34.6521, -58.6443, -34.6480, -58.6200) - 2270) < 50);
  assert.equal(ctx.ubicarEnLugares_(-34.6522, -58.6444, 10, lugares).lugar, 'Casa');
  const lejos = ctx.ubicarEnLugares_(-34.66, -58.66, 10, lugares);
  assert.equal(lejos.lugar, null);
  assert.equal(lejos.cercano.nombre, 'Casa');
});

test('ubicación: llega al colegio, "desde" se mantiene y el historial guarda de dónde venía', () => {
  const t0 = Date.parse('2026-10-12T10:00:00Z') / 1000;
  const r1 = ctx.nuevoEstado_(null, msg(-34.6521, -58.6443, t0), 'Thi', lugares, ahora);
  assert.equal(r1.estado.lugar, 'Casa');
  assert.equal(r1.cambio, null); // el primero no avisa
  const r2 = ctx.nuevoEstado_(r1.estado, msg(-34.6481, -58.6201, t0 + 1800), 'Thi', lugares, ahora);
  assert.deepEqual({ ...r2.cambio }, { llego: 'Colegio', seFue: 'Casa' });
  assert.equal(r2.estado.historial[0].lugar, 'Casa');
  const r3 = ctx.nuevoEstado_(r2.estado, msg(-34.6480, -58.6200, t0 + 3600, { batt: 60 }), 'Thi', lugares, ahora);
  assert.equal(r3.cambio, null);
  assert.equal(r3.estado.desde, r2.estado.desde);
  assert.equal(r3.estado.bateria, 60);
  // Un mensaje viejo que llega tarde no pisa el actual
  assert.equal(ctx.nuevoEstado_(r3.estado, msg(-34.6521, -58.6443, t0 + 100), 'Thi', lugares, ahora), null);
  // Otros mensajes de OwnTracks se ignoran
  assert.equal(ctx.nuevoEstado_(r3.estado, { _type: 'waypoints' }, 'Thi', lugares, ahora), null);
});

test('ubicación: sin lugares en la planilla usa las regiones de OwnTracks', () => {
  const r = ctx.nuevoEstado_(null, msg(-34.6, -58.6, 1760000000, { inregions: ['Club'] }), 'Thi', [], ahora);
  assert.equal(r.estado.lugar, 'Club');
});

const U = require('../web/js/ubicacion.js');

test('ubicación en el panel: textos', () => {
  const ahora = new Date(2026, 9, 12, 13, 0);
  const desde = new Date(2026, 9, 12, 7, 42).toISOString();
  const d = U.describir({ lugar: 'Colegio', desde, cuando: new Date(2026, 9, 12, 12, 50).toISOString(), bateria: 64 }, ahora);
  assert.equal(d.titulo, 'En Colegio');
  assert.equal(d.detalle, 'desde las 07:42 · hace 10 min · 🔋 64%');
  assert.equal(d.viejo, false);
  const lejos = U.describir({ cercano: { nombre: 'Casa', metros: 1240 }, cuando: new Date(2026, 9, 12, 8, 0).toISOString() }, ahora);
  assert.equal(lejos.titulo, 'A 1,2 km de Casa');
  assert.equal(lejos.viejo, true);
  assert.equal(U.describir({ velocidad: 40, cercano: { nombre: 'Casa', metros: 3000 }, cuando: ahora.toISOString() }, ahora).titulo, 'En viaje');
});

test('ubicación en el panel: mosaico de OpenStreetMap', () => {
  const m = U.mosaico(-34.6521, -58.6443, 15);
  assert.deepEqual([m.x, m.y], [11046, 19750]);
  assert.ok(m.px >= 0 && m.px < 256 && m.py >= 0 && m.py < 256);
});

test('ubicación: los lugares van a OwnTracks como regiones (cuando cambian o una vez por semana)', () => {
  const guardado = {};
  const props = { getProperty: (k) => guardado[k] || null, setProperty: (k, v) => { guardado[k] = v; } };
  const ahora = new Date('2026-10-15T12:00:00Z');
  const c1 = ctx.comandosParaTelefono_(props, 'Thi', lugares, ahora);
  assert.equal(c1.length, 1);
  assert.equal(c1[0].action, 'setWaypoints');
  assert.deepEqual([...c1[0].waypoints.waypoints.map((w) => w.desc + ':' + w.rad)], ['Casa:150', 'Colegio:150']);
  assert.equal(ctx.comandosParaTelefono_(props, 'Thi', lugares, new Date('2026-10-16T12:00:00Z')).length, 0);
  assert.equal(ctx.comandosParaTelefono_(props, 'Thi', lugares, new Date('2026-10-23T12:00:00Z')).length, 1);
  const otros = lugares.concat([{ nombre: 'Club', lat: -34.6, lon: -58.6, radio: 200 }]);
  assert.equal(ctx.comandosParaTelefono_(props, 'Thi', otros, new Date('2026-10-23T13:00:00Z')).length, 1);
});
