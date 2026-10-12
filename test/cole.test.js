const test = require('node:test');
const assert = require('node:assert/strict');
const Cole = require('../web/js/cole.js');

const LUNES_10 = new Date(2026, 9, 12, 10, 0);
const HORARIO = {
  lun: [{ inicio: '07:40', fin: '08:40', modulo: '1er hora', materias: ['Matemática'] },
        { inicio: '12:00', fin: '13:00', modulo: '5ta hora', materias: ['Historia'] }],
  mar: [{ inicio: '07:40', fin: '08:40', modulo: '1er hora', materias: ['Inglés'] }],
  vie: [{ inicio: '07:40', fin: '08:40', modulo: '1er hora', materias: ['Química'] }],
};

test('fechas cortas', () => {
  assert.equal(Cole.fechaCorta(new Date(2026, 9, 12, 8, 5).toISOString(), LUNES_10), 'Hoy 08:05');
  assert.equal(Cole.fechaCorta(new Date(2026, 9, 11, 20).toISOString(), LUNES_10), 'Ayer');
  assert.equal(Cole.fechaCorta(new Date(2026, 9, 8, 9).toISOString(), LUNES_10), 'Jue 8');
  assert.equal(Cole.fechaCorta(new Date(2026, 8, 30, 9).toISOString(), LUNES_10), '30 sep');
});

test('horario: hoy si todavía hay clases', () => {
  const h = Cole.horarioParaMostrar(HORARIO, LUNES_10);
  assert.equal(h.titulo, 'Hoy');
  assert.equal(h.bloques.length, 2);
});

test('horario: mañana si ya terminaron las clases de hoy', () => {
  assert.equal(Cole.horarioParaMostrar(HORARIO, new Date(2026, 9, 12, 14, 0)).titulo, 'Mañana');
});

test('horario: el viernes a la tarde muestra el lunes', () => {
  const h = Cole.horarioParaMostrar(HORARIO, new Date(2026, 9, 16, 18, 0));
  assert.equal(h.titulo, 'Lunes');
  assert.equal(h.bloques[0].materias[0], 'Matemática');
});

test('pendientes: sin leer, faltas por justificar y archivos nuevos', () => {
  const d = {
    comunicados: [{ id: '1', leido: false }, { id: '2', leido: true }, { id: '3', leido: false }],
    faltas: [
      { tipo: 'Justificada', justificacion: 'pendiente' }, // justificada por el colegio: no cuenta
      { tipo: 'Injustificada', justificacion: 'pendiente' },
      { tipo: '', justificacion: '' },
    ],
    archivos: [{ leido: false }, { leido: true }],
    detalles: [{ id: '2', mensaje: 'Texto completo' }],
  };
  assert.equal(Cole.sinLeer(d), 2);
  assert.equal(Cole.faltasPorJustificar(d).length, 2);
  assert.equal(Cole.archivosNuevos(d).length, 1);
  assert.equal(Cole.detalleDe(d, '2').mensaje, 'Texto completo');
  assert.equal(Cole.detalleDe(d, '1'), null);
  assert.equal(Cole.sinLeer(null), 0);
});

test('notas: bajas y altas, numéricas o conceptuales', () => {
  assert.equal(Cole.esBaja({ concepto: 'R' }), true);
  assert.equal(Cole.esBaja({ concepto: 'MB' }), false);
  assert.equal(Cole.esBaja({ nota: '3', concepto: '' }), true);
  assert.equal(Cole.esBaja({ nota: '7', concepto: 'R' }), false); // manda la nota
  assert.equal(Cole.esAlta({ concepto: 'EXC' }), true);
  assert.equal(Cole.esAlta({ nota: '9' }), true);
});

test('notas: nombre de la materia desde el horario o el título visto', () => {
  const datos = { horario: { _indice: { 127141: 'Matemática', 420909: 'Historia' } }, tiny: { 420909: 'OtUB' } };
  assert.equal(Cole.nombreMateria(datos, { relId: 'X', materiaId: '127141' }), 'Matemática');
  assert.equal(Cole.nombreMateria(datos, { relId: 'OtUB', materiaId: null }), 'Historia'); // vía código corto
  assert.equal(Cole.nombreMateria(datos, { relId: 'Z', titulo: 'Química' }), 'Química');
  assert.equal(Cole.nombreMateria({}, { relId: 'Z' }), 'Materia');
});

test('notas: resumen por materia con las bajas primero', () => {
  const ev = (nombre, concepto, fecha) => ({ nombre, tipo: 'TP', nota: '', concepto, fecha });
  const r = Cole.resumenNotas({ calificaciones: {
    A: { relId: 'A', titulo: 'Lengua', periodos: [{ nombre: '2do cuatrimestre', final: null,
      evaluaciones: [ev('Cuento', 'MB', '2026-10-01'), ev('Lectura', 'B', '2026-09-01')] }] },
    B: { relId: 'B', titulo: 'Química', periodos: [{ nombre: '2do cuatrimestre', final: null,
      evaluaciones: [ev('Tabla periódica', 'R', '2026-09-20')] }] },
  } });
  assert.deepEqual(r.map((m) => m.nombre + ':' + m.alerta), ['Química:true', 'Lengua:false']);
  assert.equal(r[1].ultimas.length, 2);
});

const ev = (nombre, concepto, fecha, nota) => ({ nombre, tipo: 'TP', nota: nota || '', concepto, fecha });
const MATE = { relId: 'A', titulo: 'Matemática', periodos: [
  { id: 'j5', nombre: '1er cuatrimestre', final: { nombre: 'NF', tipo: 'NF', nota: '6', concepto: '', fecha: '2026-07-10' },
    evaluaciones: [ev('Inecuaciones', 'B', '2026-06-01')] },
  { id: 'jV', nombre: '2do cuatrimestre', final: null,
    evaluaciones: [ev('Polinomios', 'MB', '2026-09-26'), ev('Parcial', 'EXC', '2026-09-10')] },
] };

test('notas: muestra el período actual que marca Colegium', () => {
  const datos = { calificaciones: { A: MATE }, periodos: [
    { id: 'j5', nombre: '1er cuatrimestre', actual: false }, { id: 'jV', nombre: '2do cuatrimestre', actual: true }] };
  assert.equal(Cole.resumenNotas(datos)[0].periodo, '2do cuatrimestre');
});

test('notas: si el período actual no tiene notas, lo dice en vez de mostrar el anterior', () => {
  const sinNotas = { relId: 'B', titulo: 'Química', periodos: [
    { id: 'j5', nombre: '1er cuatrimestre', final: null, evaluaciones: [ev('Laboratorio', 'B', '2026-06-01')] },
    { id: 'jV', nombre: '2do cuatrimestre', final: null, evaluaciones: [] }] };
  const m = Cole.resumenNotas({ calificaciones: { B: sinNotas }, periodos: [{ id: 'jV', actual: true }] })[0];
  assert.equal(m.periodo, '2do cuatrimestre');
  assert.equal(m.ultimas.length, 0);
});

test('notas: sin datos de períodos, usa la fecha de hoy o el de la nota más reciente', () => {
  const porFecha = { calificaciones: { A: MATE }, periodos: [
    { id: 'j5', inicio: '2026-03-02', fin: '2026-07-17' }, { id: 'jV', inicio: '2026-07-27', fin: '2026-12-18' }] };
  assert.equal(Cole.resumenNotas(porFecha, 4, new Date(2026, 9, 12))[0].periodo, '2do cuatrimestre');
  assert.equal(Cole.resumenNotas({ calificaciones: { A: MATE } })[0].periodo, '2do cuatrimestre');
});

test('tendencia: mejora, baja y mensajes', () => {
  const [p1, p2] = MATE.periodos;
  const t = Cole.tendencia(p2, p1); // 1er: final 6 → 2do: promedio (8,5 + 10)/2
  assert.equal(t.estado, 'mejora');
  assert.match(t.mensaje, /1er cuatrimestre/);
  assert.equal(Cole.tendencia(p2, p1, 'x').mensaje, Cole.tendencia(p2, p1, 'x').mensaje);
  const baja = Cole.tendencia({ evaluaciones: [ev('x', 'R', '2026-09-01')] }, { nombre: '1er cuatrimestre', final: null, evaluaciones: [ev('y', 'MB', '2026-05-01')] });
  assert.equal(baja.estado, 'baja');
  assert.equal(Cole.tendencia({ evaluaciones: [] }, null), null);
});

test('mensaje general de aliento', () => {
  const m = (nombre, estado) => ({ nombre, tendencia: { estado } });
  assert.match(Cole.mensajeGeneral([m('Matemática', 'mejora'), m('Inglés', 'parejo')], 'Thiago').texto, /Thiago.*Matemática/);
  assert.match(Cole.mensajeGeneral([m('Matemática', 'mejora'), m('Química', 'baja')]).texto, /Matemática.*Química/);
  assert.equal(Cole.mensajeGeneral([m('Química', 'baja')]).tono, 'atencion');
  assert.match(Cole.mensajeGeneral([m('Matemática', 'mejora'), m('Física', 'mejora'), m('Inglés', 'mejora')]).texto, /Matemática, Física y Inglés/);
  assert.equal(Cole.mensajeGeneral([]), null);
});

test('comunicados: un comunicado ya leído o visto en el panel no cuenta', () => {
  const d = { comunicados: [{ id: '1', leido: false }, { id: '2', leido: false }, { id: '3', leido: true }] };
  assert.equal(Cole.sinLeer(d, { 1: Date.now() }), 1);
  assert.equal(Cole.esNuevo(d.comunicados[1], {}), true);
  assert.equal(Cole.esNuevo(d.comunicados[2], {}), false);
});
