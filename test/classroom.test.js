const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../web/js/classroom.js');

const ahora = new Date(2026, 9, 12, 15, 0); // lunes 12/10 15:00
const en = (dias, h = 23, m = 59) => new Date(2026, 9, 12 + dias, h, m).toISOString();

test('cuándo vence, en palabras', () => {
  assert.deepEqual(C.cuando(en(0), ahora), { texto: 'Hoy · hasta las 23:59', urgencia: 'hoy' });
  assert.deepEqual(C.cuando(en(1, 8, 0), ahora), { texto: 'Mañana · 08:00', urgencia: 'manana' });
  assert.equal(C.cuando(en(3), ahora).texto, 'Jue 15');
  assert.equal(C.cuando(en(10), ahora).texto, '22/10');
  assert.deepEqual(C.cuando(en(-1), ahora), { texto: 'Venció ayer', urgencia: 'vencida' });
  assert.equal(C.cuando(null, ahora).urgencia, 'sin-fecha');
});

const datos = {
  tareas: [
    { id: '1', titulo: 'TP Polinomios', curso: 'Matemática', estado: 'pendiente', vence: en(3) },
    { id: '2', titulo: 'Lectura', curso: 'Literatura', estado: 'pendiente', vence: en(1, 8, 0) },
    { id: '3', titulo: 'Mapa', curso: 'Geografía', estado: 'atrasada', vence: en(-2) },
    { id: '4', titulo: 'Sin fecha', curso: 'Inglés', estado: 'pendiente', vence: null },
    { id: '5', titulo: 'Informe', curso: 'Física', estado: 'devuelta', vence: en(-3), nota: 9, notaMax: 10 },
    { id: '6', titulo: 'Vieja', curso: 'Física', estado: 'entregada', vence: en(-30) },
    { id: '7', titulo: 'Lejana', curso: 'Química', estado: 'pendiente', vence: en(20) }
  ],
  avisos: [{ curso: 'Matemática', texto: 'Mañana prueba', fecha: en(-1, 10, 0) }, { curso: 'X', texto: 'viejo', fecha: en(-20) }]
};

test('resumen: atrasadas, pendientes por fecha, hechas recientes y avisos', () => {
  const r = C.resumen(datos, ahora);
  assert.deepEqual(r.atrasadas.map((t) => t.id), ['3']);
  assert.deepEqual(r.pendientes.map((t) => t.id), ['2', '1', '7', '4']);
  assert.deepEqual(r.hechas.map((t) => t.id), ['5']);
  assert.equal(r.avisos.length, 1);
  assert.equal(C.urgentes(datos, ahora), 2); // la atrasada + la de mañana
});

test('las entregas de la semana van a la agenda', () => {
  const ev = C.comoEventos(datos, ahora, 'Thi', '#d39b1e');
  assert.deepEqual(ev.map((e) => e.titulo), ['Entregar: Lectura', 'Entregar: TP Polinomios']);
  assert.equal(ev[0].todoElDia, false);
  assert.equal(ev[1].todoElDia, true);
  assert.equal(new Date(ev[1].inicio).getHours(), 0);
});

test('script de Classroom: estado y vencimiento de una tarea', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script-classroom/Classroom.gs'), 'utf8'), ctx);
  const curso = { nombre: 'Matemática' };
  const ahoraUtc = new Date(Date.UTC(2026, 9, 12, 18, 0));
  const w = { id: 'w', title: 'TP', dueDate: { year: 2026, month: 10, day: 14 }, maxPoints: 10 };
  const sinHora = ctx.tareaDe_(w, { state: 'CREATED' }, curso, ahoraUtc);
  assert.equal(sinHora.vence, '2026-10-15T02:59:00.000Z'); // 14/10 23:59 en Argentina
  assert.equal(sinHora.estado, 'pendiente');
  const conHora = ctx.tareaDe_({ ...w, dueTime: { hours: 11 } }, null, curso, ahoraUtc);
  assert.equal(conHora.vence, '2026-10-14T11:00:00.000Z');
  assert.equal(ctx.tareaDe_({ ...w, dueDate: { year: 2026, month: 10, day: 1 } }, { state: 'NEW' }, curso, ahoraUtc).estado, 'atrasada');
  assert.equal(ctx.tareaDe_(w, { state: 'TURNED_IN', late: true }, curso, ahoraUtc).estado, 'entregada');
  const devuelta = ctx.tareaDe_(w, { state: 'RETURNED', assignedGrade: 8 }, curso, ahoraUtc);
  assert.deepEqual([devuelta.estado, devuelta.nota], ['devuelta', 8]);
});
