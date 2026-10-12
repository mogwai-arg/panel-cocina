const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Mails.gs'), 'utf8'), ctx);

const ahora = new Date(2026, 9, 12, 13, 0); // lunes 12/10/2026 13:00
const f = (texto, recibido) => {
  const r = ctx.primeraFechaFutura_(texto, ahora, recibido || ahora);
  if (!r) return null;
  const d = new Date(r.fecha);
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + (r.conHora ? ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0') : '');
};

test('mails: fecha y hora de un turno', () => {
  assert.equal(f('Recordatorio de turno: lunes 20 de octubre a las 10:30 hs con Dr. Pérez'), '20/10/2026 10:30');
  assert.equal(f('Su turno es el 20/10/2026 a las 9.15 h'), '20/10/2026 9:15');
  assert.equal(f('Turno confirmado para el 3/11 - 16 hs'), '3/11/2026 16:00');
  assert.equal(f('Vence el 25 de octubre'), '25/10/2026');
  assert.equal(f('Fecha: 30-10-26'), '30/10/2026');
  assert.equal(f('el 5 de setiembre de 2027'), '5/9/2027');
});

test('mails: saltea fechas pasadas y cosas que no son fechas', () => {
  assert.equal(f('El 1/10 tuviste un turno. El próximo es el 15/10 a las 8:00'), '15/10/2026 8:00');
  assert.equal(f('Descuento del 12.5% y 2 cuotas'), null);
  assert.equal(f('Tel 4444-5555'), null);
  assert.equal(f('31/02'), null);
  assert.equal(f('Hoy 12/10 a las 9:00'), null); // ya pasó la hora
  assert.equal(f('Hoy 12/10'), '12/10/2026'); // sin hora: vale todo el día
});

test('mails: "5/1" recibido en diciembre es del año siguiente', () => {
  const r = ctx.primeraFechaFutura_('Turno el 5/1', new Date(2026, 11, 20), new Date(2026, 11, 20));
  assert.equal(new Date(r.fecha).getFullYear(), 2027);
});

test('mails: remitente y cuerpo sin la parte citada', () => {
  assert.equal(ctx.nombreRemitente_('"OSDE Turnos" <turnos@osde.com.ar>'), 'OSDE Turnos');
  assert.equal(ctx.nombreRemitente_('pepe@gmail.com'), 'pepe@gmail.com');
  const c = ctx.limpiarCuerpo_('Hola, confirmo.\n> viejo\nEl lun, 5 oct 2026 a las 10:00, Juan escribió:\n> más viejo');
  assert.equal(c.trim(), 'Hola, confirmo.');
});

const M = require('../web/js/mails.js');
const en = (dias, h, m) => { const d = new Date(2026, 9, 12 + dias, h || 0, m || 0); return d.toISOString(); };
const datosMails = { mails: [
  { id: 'a', categoria: 'Salud', asunto: 'Turno OSDE', de: 'OSDE', recibido: en(-1, 9), cuando: { fecha: en(8, 10, 30), conHora: true } },
  { id: 'b', categoria: 'Pagos', asunto: 'Vence expensas', de: 'Admin', recibido: en(-2, 9), cuando: { fecha: en(3), conHora: false } },
  { id: 'c', categoria: 'Cole', asunto: 'Reunión', de: 'Colegio', recibido: en(-10, 9), cuando: { fecha: en(-1, 18), conHora: true } },
  { id: 'd', categoria: 'Viajes', asunto: 'Reserva', de: 'Hotel', recibido: en(0, 8), cuando: null }
] };

test('mails en el panel: con fecha, eventos y nuevos', () => {
  assert.deepEqual(M.conFecha(datosMails, ahora).map((m) => m.id), ['b', 'a']);
  const ev = M.comoEventos(datosMails, ahora, 'Avisos');
  assert.deepEqual(ev.map((e) => e.titulo), ['💳 Vence expensas', '🩺 Turno OSDE']);
  assert.equal(ev[0].todoElDia, true);
  assert.equal(ev[1].color, '#c4453a');
  assert.equal(M.textoCuando(datosMails.mails[0].cuando, ahora), 'Mar 20/10 · 10:30');
  assert.deepEqual(M.nuevos(datosMails, ahora, { a: 1 }).map((m) => m.id), ['b', 'd']);
  assert.deepEqual(M.categorias(datosMails), ['Salud', 'Pagos', 'Cole', 'Viajes']);
});
