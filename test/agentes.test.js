const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Agentes.gs'), 'utf8'), ctx);

const ahora = new Date(2026, 9, 14, 12, 0);
const iso = (d, h, m) => new Date(2026, 9, d, h || 0, m || 0).toISOString();

test('agentes: fechas de Colegium en varios formatos', () => {
  const p = (s) => { const r = ctx.parsearFecha_(s); return r && [r.fecha.getDate(), r.fecha.getHours(), r.conHora]; };
  assert.deepEqual(p('2026-10-20 08:30:00'), [20, 8, true]);
  assert.deepEqual(p('2026-10-20'), [20, 0, false]);
  assert.deepEqual(p('2026-10-20 00:00:00'), [20, 0, false]);
  assert.deepEqual(p('20/10/2026 19:00'), [20, 19, true]);
  assert.equal(ctx.parsearFecha_('mañana'), null);
});

test('agentes: qué va al calendario automático', () => {
  const mails = { mails: [
    { id: 'm1', asunto: 'Turno OSDE', de: 'OSDE', cuando: { fecha: iso(20, 10, 30), conHora: true } },
    { id: 'm2', asunto: 'Vence expensas', de: 'Admin', cuando: { fecha: iso(22), conHora: false } },
    { id: 'm3', asunto: 'Viejo', de: 'X', cuando: { fecha: iso(1, 9), conHora: true } },
    { id: 'm4', asunto: 'Sin fecha', de: 'X', cuando: null }
  ] };
  const aula = { tareas: [
    { id: 't1', titulo: 'TP Polinomios', curso: 'Matemática', estado: 'pendiente', vence: iso(16, 23, 59) },
    { id: 't2', titulo: 'Mapa', curso: 'Geografía', estado: 'entregada', vence: iso(15, 23, 59) },
    { id: 't3', titulo: 'Sin fecha', estado: 'pendiente', vence: null }
  ] };
  const cole = { eventos: [{ titulo: 'Acto 12 de octubre', inicio: '2026-10-21 08:00:00' }, { titulo: 'Sin fecha', inicio: '' }] };
  const r = ctx.eventosAutomaticos_(mails, aula, cole, ahora);
  assert.deepEqual([...r.eventos.map((e) => e.clave)], ['mail:m1', 'mail:m2', 'aula:t1', 'cole:Acto 12 de octubre|2026-10-21 08:00:00']);
  assert.deepEqual([...r.borrar], ['aula:t2']);
  const tp = r.eventos[2];
  assert.equal(tp.titulo, '📚 Entregar: TP Polinomios');
  assert.equal(tp.todoElDia, true);
  assert.equal(r.eventos[1].todoElDia, true);
  assert.equal(r.eventos[0].todoElDia, false);
});
