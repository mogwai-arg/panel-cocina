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
