const test = require('node:test');
const assert = require('node:assert/strict');
const Manana = require('../web/js/manana.js');
const Listas = require('../web/js/listas.js');

function b(inicio, fin, materia) { return { inicio, fin, modulo: '', materias: materia ? [materia] : [] }; }
const HORARIO = {
  lun: [b('07:40', '08:40', 'Matemática'), b('08:40', '09:40', 'Historia')],
  mar: [b('08:00', '09:00', 'Inglés')],
  mie: [b('09:40', '10:40', 'Arte'), b('07:40', '08:40', '')],
  jue: [], vie: [b('07:40', '08:40', 'Biología')]
};
// 2026-10-12 es lunes
const lunes = (h, m) => new Date(2026, 9, 12, h, m);
const OP = { activo: true, horario: HORARIO, desde: '06:30', viajeMinutos: 20, salidaPorDefecto: '07:20' };

test('mañana: la salida es la primera clase menos el viaje', () => {
  const p = Manana.plan(lunes(7, 0), OP);
  assert.equal(p.salida, '07:20');
  assert.equal(p.faltan, 20);
  assert.equal(p.primera.materia, 'Matemática');
  assert.equal(p.clases.length, 2);
  // martes entra 08:00 → sale 07:40
  assert.equal(Manana.plan(new Date(2026, 9, 13, 7, 0), OP).salida, '07:40');
});

test('mañana: solo entre "desde" y un rato después de salir', () => {
  assert.equal(Manana.plan(lunes(6, 29), OP), null);
  assert.ok(Manana.plan(lunes(6, 30), OP));
  assert.equal(Manana.plan(lunes(7, 30), OP).faltan, -10);
  assert.equal(Manana.plan(lunes(7, 40), OP), null);
});

test('mañana: no aparece sin cole, apagada o ya marcada como lista', () => {
  assert.equal(Manana.plan(new Date(2026, 9, 15, 7, 0), OP), null);   // jueves sin clases
  assert.equal(Manana.plan(new Date(2026, 9, 17, 7, 0), OP), null);   // sábado
  assert.equal(Manana.plan(lunes(7, 0), Object.assign({}, OP, { activo: false })), null);
  assert.equal(Manana.plan(lunes(7, 0), Object.assign({}, OP, { listoEl: '2026-10-12' })), null);
  assert.ok(Manana.plan(lunes(7, 0), Object.assign({}, OP, { listoEl: '2026-10-09' })));
});

test('mañana: ignora bloques sin materia y ordena por hora', () => {
  const p = Manana.plan(new Date(2026, 9, 14, 8, 0), OP); // miércoles: arte 09:40
  assert.equal(p.salida, '09:20');
  assert.equal(p.clases.length, 1);
});

test('mañana: sin horario usa la salida por defecto de lunes a viernes', () => {
  const op = Object.assign({}, OP, { horario: null });
  assert.equal(Manana.plan(new Date(2026, 9, 15, 7, 0), op).salida, '07:20');
  assert.equal(Manana.plan(new Date(2026, 9, 18, 7, 0), op), null); // domingo
});

test('mañana: cuenta regresiva', () => {
  assert.deepEqual(Manana.cuentaRegresiva(15), { grande: '15', chico: 'MIN PARA SALIR', tarde: false });
  assert.equal(Manana.cuentaRegresiva(75).grande, '1:15');
  assert.equal(Manana.cuentaRegresiva(0).tarde, true);
});

test('mañana: qué llevar según el clima', () => {
  const horas = [6, 7, 8, 9, 10, 11, 12].map((hora, i) => ({ hora, temp: 8 + i, lluvia: hora === 10 ? 70 : 0 }));
  const c = Manana.consejosClima({ max: 16, horas }, '07:20');
  assert.match(c[0].texto, /paraguas/);
  assert.match(c[1].texto, /frío al salir: 9°/);
  const lindo = Manana.consejosClima({ max: 22, horas: horas.map((h) => ({ hora: h.hora, temp: 20, lluvia: 0 })) }, '07:20');
  assert.equal(lindo.length, 1);
  assert.match(lindo[0].texto, /Lindo/);
  assert.deepEqual(Manana.consejosClima(null, '07:20'), []);
});

test('mañana: entregas, pruebas y pendientes de hoy', () => {
  const ahora = lunes(7, 0);
  const aula = { tareas: [
    { titulo: 'TP 1', estado: 'pendiente', vence: new Date(2026, 9, 12, 23, 59).toISOString() },
    { titulo: 'TP 2', estado: 'pendiente', vence: new Date(2026, 9, 13, 8, 0).toISOString() },
    { titulo: 'TP 3', estado: 'pendiente', vence: new Date(2026, 9, 20, 8, 0).toISOString() },
    { titulo: 'TP 0', estado: 'atrasada', vence: new Date(2026, 9, 9, 8, 0).toISOString() },
    { titulo: 'Hecha', estado: 'entregada', vence: new Date(2026, 9, 12, 8, 0).toISOString() }
  ] };
  const ia = { repasos: [{ materia: 'Matemática', fecha: '2026-10-12' }], pendientes: [{ texto: 'Llevar DNI', para: '2026-10-12' }, { texto: 'Otro', para: '2026-10-14' }] };
  assert.deepEqual(Manana.paraHoy(aula, ia, ahora).map((x) => x.texto), [
    'Hoy: prueba de Matemática', 'Entregar hoy: TP 1', 'Para mañana: TP 2', 'Atrasada: TP 0', 'Llevar DNI'
  ]);
  assert.deepEqual(Manana.paraHoy(null, null, ahora), []);
});

test('mañana: tareas de la mañana de la persona', () => {
  const tareas = [
    { tarea: 'Cama', persona: 'Thi', momento: 'Mañana', dias: '' },
    { tarea: 'Basura', persona: 'Thi', momento: 'Noche', dias: '' },
    { tarea: 'Mochila', persona: 'thi ', momento: 'mañana', dias: 'mar' },
    { tarea: 'Café', persona: 'Javi', momento: 'Mañana', dias: '' }
  ];
  assert.deepEqual(Manana.tareasDeLaManana(tareas, 'Thi', lunes(7, 0), Listas.tocaHoy).map((t) => t.tarea), ['Cama']);
  assert.deepEqual(Manana.tareasDeLaManana(tareas, 'Thi', new Date(2026, 9, 13, 7, 0), Listas.tocaHoy).map((t) => t.tarea), ['Cama', 'Mochila']);
});
