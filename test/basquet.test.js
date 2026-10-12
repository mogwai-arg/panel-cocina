const test = require('node:test');
const assert = require('node:assert/strict');
const Basquet = require('../web/js/basquet.js');

const EQUIPO = 'ARGENTINO DE CASTELAR NORTE A';
const AHORA = new Date('2026-10-12T15:00:00-03:00');
const partido = (fecha, local, pl, visitante, pv) => ({
  fecha, cancha: 'Cancha',
  local: { nombre: local, escudo: null, puntos: pl },
  visitante: { nombre: visitante, escudo: null, puntos: pv },
});
const DATOS = {
  equipo: EQUIPO,
  partidos: [
    partido('2026-09-26T11:00:00-03:00', EQUIPO, 73, 'LANUS A', 75),
    partido('2026-10-03T11:00:00-03:00', 'RIVER PLATE', 60, EQUIPO, 81),
    partido('2026-10-10T11:00:00-03:00', EQUIPO, 90, 'MIDLAND', 55),
    partido('2026-10-24T11:00:00-03:00', EQUIPO, null, 'PEDRO ECHAGÜE AZUL', null),
    partido('2026-10-31T11:00:00-03:00', 'OBRAS', null, EQUIPO, null),
  ],
};

test('nombres prolijos', () => {
  assert.equal(Basquet.nombreLindo('ARGENTINO DE CASTELAR NORTE A'), 'Argentino de Castelar Norte A');
  assert.equal(Basquet.nombreLindo('PEDRO ECHAGÜE AZUL'), 'Pedro Echagüe Azul');
  assert.equal(Basquet.nombreLindo('DEFENSORES DE HURLINGHAM VERDE'), 'Defensores de Hurlingham Verde');
});

test('resumen: próximo, último y racha', () => {
  const r = Basquet.resumen(DATOS, AHORA);
  assert.equal(r.proximo.rival.nombre, 'PEDRO ECHAGÜE AZUL');
  assert.equal(r.proximo.esLocal, true);
  assert.equal(r.ultimo.rival.nombre, 'MIDLAND');
  assert.equal(r.ultimo.gano, true);
  assert.deepEqual(r.racha, [false, true, true]);
});

test('resumen: de visitante, el resultado se mira desde nuestro equipo', () => {
  const r = Basquet.resumen({ equipo: EQUIPO, partidos: [DATOS.partidos[1]] }, AHORA);
  assert.equal(r.ultimo.esLocal, false);
  assert.equal(r.ultimo.propio.puntos, 81);
  assert.equal(r.ultimo.gano, true);
});

test('resumen: un partido en juego sigue como próximo durante 2 horas', () => {
  const r = Basquet.resumen(DATOS, new Date('2026-10-24T12:00:00-03:00'));
  assert.equal(r.proximo.rival.nombre, 'PEDRO ECHAGÜE AZUL');
  const despues = Basquet.resumen(DATOS, new Date('2026-10-24T13:30:00-03:00'));
  assert.equal(despues.proximo.rival.nombre, 'OBRAS');
});

test('resumen: sin partidos', () => {
  const r = Basquet.resumen({ equipo: EQUIPO, partidos: [] }, AHORA);
  assert.equal(r.proximo, null);
  assert.equal(r.ultimo, null);
  assert.deepEqual(r.racha, []);
});

test('los partidos por jugar se convierten en eventos de la agenda', () => {
  const ev = Basquet.comoEventos(DATOS, AHORA, 'Thiago', '#d39b1e');
  assert.equal(ev.length, 2);
  assert.equal(ev[0].titulo, 'Básquet vs Pedro Echagüe Azul');
  assert.equal(ev[0].lugar, 'Cancha (local)');
  assert.equal(ev[0].calendario, 'Thiago');
  assert.equal(new Date(ev[0].fin) - new Date(ev[0].inicio), 2 * 3600000);
});

test('"0 – 0" cuenta como partido sin jugar', () => {
  const r = Basquet.resumen({ equipo: EQUIPO, partidos: [
    partido('2026-10-24T11:00:00-03:00', EQUIPO, 0, 'PEDRO ECHAGÜE AZUL', 0)] }, AHORA);
  assert.equal(r.ultimo, null);
  assert.equal(r.proximo.rival.nombre, 'PEDRO ECHAGÜE AZUL');
});

test('si ya están en Google Calendar, no se agregan otra vez a la agenda', () => {
  assert.deepEqual(Basquet.comoEventos({ ...DATOS, sincronizado: true }, AHORA, 'Thiago', '#000'), []);
});

test('categoría corta para la tarjeta', () => {
  const r = Basquet.resumen({ ...DATOS, categoria: 'JUVENILES MASCULINO' }, AHORA);
  assert.equal(r.categoria, 'Juveniles');
});
