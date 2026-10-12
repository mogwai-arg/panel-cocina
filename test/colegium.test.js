// Estructuras tomadas del diagnóstico real de Colegium (con datos de ejemplo).
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension-colegium/colegium.js');
const { forma } = require('../extension-colegium/forma.js');

test('reconoce las direcciones útiles', () => {
  assert.equal(C.reconocer('/comunicados/v2/1315645/v2/recibidos/0/25'), 'comunicados');
  assert.equal(C.reconocer('/comunicados/v2/1315645/20970473/leer'), 'comunicado');
  assert.equal(C.reconocer('/api/4kJ4/horarios/estudiante/rsxJ/semana'), 'horario');
  assert.equal(C.reconocer('/api/4kJ4/asistencia/estudiante/rsxJ'), 'asistencia');
  assert.equal(C.reconocer('/api/4kJ4/asistencia/estudiante/rsxJ/lista'), 'faltas');
  assert.equal(C.reconocer('/familias/1315645/eventos'), 'eventos');
  assert.equal(C.reconocer('/familias/1315645/archivos'), 'archivos');
  assert.equal(C.reconocer('/familias/1315645/archivos/carpetas'), null);
  assert.equal(C.reconocer('/assets/locales/es_BASE.json'), null);
});

test('comunicados recibidos', () => {
  const [c] = C.normalizar('comunicados', {
    recibidos: [{
      cantidadAdjuntos: '1', comunicado_id: '4089195', fecha: '1791383162', id: '21765397',
      is_destacado: 0, is_leido: 0, mensaje: '<p>Buenos días, les envío las <b>novedades</b></p><p>Saludos</p>',
      remitente: 'Paloma Alvarez', rolRemitenteLabel: 'Administrador', titulo: 'Gira deportiva a Miramar',
    }], success: true,
  });
  assert.deepEqual(c, {
    id: '4089195', titulo: 'Gira deportiva a Miramar', remitente: 'Paloma Alvarez', rol: 'Administrador',
    fecha: new Date(1791383162 * 1000).toISOString(), resumen: 'Buenos días, les envío las novedades\nSaludos',
    leido: false, destacado: false, adjuntos: 1,
  });
});

test('detalle de un comunicado: texto completo y adjuntos, sin la lista de destinatarios', () => {
  const d = C.normalizar('comunicado', { notificacion: {
    id: '4059437', titulo: 'Inscripción Activamente 2026', mensaje: '<div>Hola&nbsp;familias</div>',
    adjuntos: [{ nombre: 'Folleto.pdf', url: 'https://...' }], roles_destinatarios: '[1,2,3]',
  } });
  assert.deepEqual(d, { id: '4059437', titulo: 'Inscripción Activamente 2026', mensaje: 'Hola familias', adjuntos: ['Folleto.pdf'] });
});

test('horario de la semana', () => {
  const h = C.normalizar('horario', { result: { dias: {
    lun: [{ asignaturas: [{ nombre: 'Matemática' }], bloque_id: 'dJ0', inicio: '07:40', fin: '08:40', modulo: '1er hora', turno: 'm' }],
    mar: [{ asignaturas: ['Historia'], inicio: '07:40', fin: '08:40', modulo: '1er hora' }],
  } } });
  assert.deepEqual(h.lun, [{ inicio: '07:40', fin: '08:40', modulo: '1er hora', materias: ['Matemática'] }]);
  assert.deepEqual(h.mar[0].materias, ['Historia']);
});

test('asistencia y faltas', () => {
  assert.deepEqual(C.normalizar('asistencia', { result: {
    porcentaje_presente: '95.8', total_inasistencias: '7.25', total_tardanzas: '0.25' } }),
  { presente: 95.8, inasistencias: 7.25, tardanzas: 0.25 });
  assert.deepEqual(C.normalizar('faltas', { result: [{
    caracteristica: 'Justificada', estado_simbolo: 'A', fecha_format: '2026-10-08 00:00:00',
    justificacion_estado_familia: 'pendiente' }] }),
  [{ fecha: '2026-10-08', estado: 'A', tipo: 'Justificada', justificacion: 'pendiente' }]);
});

test('archivos compartidos', () => {
  assert.deepEqual(C.normalizar('archivos', { files: [{
    file_nombre: 'Pausa de hidratacion.pdf', usuario_creador: 'Daiana Abbruzzese', file_creation: '1782219562', leido: '0' }] }),
  [{ nombre: 'Pausa de hidratacion.pdf', autor: 'Daiana Abbruzzese', fecha: new Date(1782219562 * 1000).toISOString(), leido: false }]);
});

test('combinar: acumula comunicados sin repetir y marca leído al abrir uno', () => {
  const ahora = new Date('2026-10-12T13:00:00Z');
  let e = C.combinar({}, 'comunicados', [
    { id: '1', fecha: '2026-10-01T00:00:00Z', leido: false },
    { id: '2', fecha: '2026-10-05T00:00:00Z', leido: false }], ahora);
  e = C.combinar(e, 'comunicados', [{ id: '2', fecha: '2026-10-05T00:00:00Z', leido: false },
    { id: '3', fecha: '2026-10-07T00:00:00Z', leido: false }], ahora);
  assert.deepEqual(e.comunicados.map((c) => c.id), ['3', '2', '1']);
  e = C.combinar(e, 'comunicado', { id: '2', titulo: 'x', mensaje: 'completo', adjuntos: [] }, ahora);
  assert.equal(e.comunicados.find((c) => c.id === '2').leido, true);
  assert.equal(e.detalles[0].mensaje, 'completo');
  assert.equal(e.actualizado.comunicado, ahora.toISOString());
});

test('diagnóstico: oculta DNI, teléfonos y fecha de nacimiento', () => {
  assert.deepEqual(forma({ dni: '12345678', celular: '1155555555', fecha_nacimiento: '2011-01-01', fecha_nac: '01/01/2011', nombre: 'X' }),
    { dni: '<oculto>', celular: '<oculto>', fecha_nacimiento: '<oculto>', fecha_nac: '<oculto>', nombre: 'X' });
});

// Colegium.gs con una planilla falsa
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Colegium.gs: guarda en trozos y lee lo mismo', () => {
  const celdas = [];
  const props = {};
  const hoja = {
    clearContents: () => { celdas.length = 0; },
    getRange: (fila, col, n) => ({
      setValues: (vals) => vals.forEach((v, i) => { celdas[fila - 1 + i] = v[0]; }),
      getValues: () => celdas.slice(fila - 1, fila - 1 + n).map((c) => [c]),
    }),
    getLastRow: () => celdas.length,
  };
  const ctx = {
    planilla_: () => ({ getSheetByName: () => hoja }),
    conLock_: (fn) => fn(),
    PropertiesService: { getScriptProperties: () => ({ setProperty: (k, v) => { props[k] = v; }, getProperty: (k) => props[k] }) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Colegium.gs'), 'utf8'), ctx);

  const datos = { comunicados: Array.from({ length: 60 }, (_, i) => ({ id: String(i), resumen: 'x'.repeat(1500) })) };
  const r = ctx.guardarColegium_(datos);
  assert.equal(r.ok, true);
  assert.ok(celdas.length >= 3, 'se partió en varios trozos');
  assert.ok(celdas.every((c) => c.length <= 40000));
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.leerColegium_().datos)), datos);
  assert.throws(() => ctx.guardarColegium_(null), /No llegaron datos/);
});
