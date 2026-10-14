const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Utilities.formatDate mínimo (solo 'yyyy-MM-dd' en hora local), para correr IA.gs fuera de Google.
const pad = (n) => String(n).padStart(2, '0');
const ctx = { Utilities: { formatDate: (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/IA.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Agentes.gs'), 'utf8'), ctx);

const ahora = new Date(2026, 9, 14, 12, 0);

test('IA: se queda con lo que tiene sentido', () => {
  const r = ctx.limpiarSemana_({
    resumen: '  Semana tranquila.  ',
    pendientes: [{ texto: 'Firmar autorización', para: '2026-10-16' }, { texto: 'Viejo', para: '2026-10-01' }, { texto: '' }],
    fechas: [{ fecha: '2026-10-20', hora: '8:30', titulo: 'Salida al Planetario' }, { fecha: 'el jueves', titulo: 'x' },
      { fecha: '2026-10-02', titulo: 'pasado' }, { fecha: '2026-10-21', hora: 'temprano', titulo: 'Acto' }],
    pruebas: [{ materia: 'Matemática', fecha: '2026-10-22', temas: 'funciones lineales' }, { materia: 'Historia', temas: '' }]
  }, ahora);
  assert.equal(r.resumen, 'Semana tranquila.');
  assert.deepEqual([...r.pendientes.map((p) => p.texto)], ['Firmar autorización']);
  assert.deepEqual([...r.fechas.map((f) => f.titulo + '@' + f.hora)], ['Salida al Planetario@8:30', 'Acto@']);
  assert.deepEqual([...r.pruebas.map((p) => p.materia)], ['Matemática']);
});

test('IA: textos que lee (comunicados con su texto completo y Classroom pendiente)', () => {
  const cole = {
    comunicados: [{ id: '1', titulo: 'Salida', fecha: '2026-10-10T10:00:00Z', remitente: 'Preceptoría', resumen: 'corto' },
      { id: '2', titulo: 'Viejo', fecha: '2026-08-01T10:00:00Z', resumen: 'no' }],
    detalles: [{ id: '1', mensaje: 'Texto completo de la salida' }]
  };
  const aula = { tareas: [{ titulo: 'TP', curso: 'Mate', estado: 'pendiente', vence: null }, { titulo: 'Hecha', estado: 'entregada' }] };
  const t = ctx.textosParaIA_(cole, aula, ahora);
  assert.match(t, /Texto completo de la salida/);
  assert.doesNotMatch(t, /Viejo/);
  assert.match(t, /TAREA DE CLASSROOM \(Mate, sin fecha\): TP/);
  assert.doesNotMatch(t, /Hecha/);
});

test('IA: sus fechas van al calendario automático (sin repetir días que ya trae Colegium)', () => {
  const ia = { fechas: [{ fecha: '2026-10-20', hora: '08:30', titulo: 'Salida al Planetario', detalle: 'Llevar vianda' },
    { fecha: '2026-10-21', hora: '', titulo: 'Acto' }] };
  const cole = { eventos: [{ titulo: 'Acto patrio', inicio: '2026-10-21 08:00:00' }] };
  const r = ctx.eventosAutomaticos_(null, null, cole, ahora, ia);
  assert.deepEqual([...r.eventos.map((e) => e.agente + ':' + e.titulo)], ['Colegio:🎒 Acto patrio', 'IA:🎒 Salida al Planetario']);
});

test('IA: elige el mejor modelo flash de la lista', () => {
  const lista = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-3.0-flash-preview', 'gemini-3.0-flash',
    'gemini-3.0-flash-image', 'gemini-3.0-pro', 'gemini-3.0-flash-lite', 'text-embedding-004', 'gemini-flash-latest'];
  assert.equal(ctx.elegirModelo_(lista), 'gemini-3.0-flash');
  assert.equal(ctx.elegirModelo_(['gemini-2.0-flash-001', 'gemini-2.0-flash']), 'gemini-2.0-flash');
  assert.equal(ctx.elegirModelo_(['gemini-3.0-pro']), null);
});
