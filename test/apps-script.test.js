// Prueba funciones del Apps Script que no dependen de servicios de Google.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contexto = {};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), contexto);

// Apps Script entrega los bytes como enteros con signo (-128..127).
function bytes(nombre) {
  return Array.from(fs.readFileSync(path.join(__dirname, 'fixtures', nombre)), (b) => (b << 24) >> 24);
}

test('lee el tamaño de un JPG', () => {
  assert.deepEqual({ ...contexto.tamanoImagen_(bytes('vertical.jpg')) }, { ancho: 300, alto: 400 });
});

test('lee el tamaño de un JPG progresivo', () => {
  assert.deepEqual({ ...contexto.tamanoImagen_(bytes('horizontal-progresiva.jpg')) }, { ancho: 640, alto: 360 });
});

test('lee el tamaño de un PNG', () => {
  assert.deepEqual({ ...contexto.tamanoImagen_(bytes('cuadrada.png')) }, { ancho: 512, alto: 512 });
});

test('devuelve null si no es una imagen conocida', () => {
  assert.equal(contexto.tamanoImagen_([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), null);
});

test('convierte la fecha EXIF', () => {
  assert.equal(contexto.fechaExif_('2024:02:10 17:26:53'), '2024-02-10T17:26:53');
  assert.equal(contexto.fechaExif_(undefined), null);
});

test('básquet: lee los partidos del equipo desde el fixture de FeBAMBA', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'fixture-febamba.html'), 'utf8');
  const partidos = JSON.parse(JSON.stringify(
    contexto.partidosDelEquipo_(html, 'Argentino de Castelar Norte A', 'https://www.febamba.com')));
  assert.equal(partidos.length, 3); // el de Centro B no es de Thiago
  assert.deepEqual(partidos[0], {
    fecha: '2026-09-26T11:00:00-03:00',
    cancha: 'Argentino de Castelar',
    local: { nombre: 'ARGENTINO DE CASTELAR NORTE A', escudo: 'https://www.febamba.com/escudos/6/95446', puntos: 73 },
    visitante: { nombre: 'LANUS A', escudo: 'https://www.febamba.com/escudos/63/94306', puntos: 75 },
  });
  // Partido sin jugar: sin puntos, y el nombre con acento decodificado
  assert.equal(partidos[1].visitante.nombre, 'PEDRO ECHAGÜE AZUL');
  assert.equal(partidos[1].local.puntos, null);
});

test('básquet: "0 – 0" en un partido por jugar es "sin resultado"', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'fixture-febamba.html'), 'utf8');
  const partidos = contexto.partidosDelEquipo_(html, 'ARGENTINO DE CASTELAR NORTE A', 'https://www.febamba.com');
  const obras = partidos.find((p) => p.local.nombre === 'OBRAS BASKET');
  assert.equal(obras.local.puntos, null);
  assert.equal(obras.visitante.puntos, null);
});

test('básquet: categoría según la edad de la temporada', () => {
  assert.equal(contexto.categoriaPorEdad_(2011, 2026), 'CADETES');
  assert.equal(contexto.categoriaPorEdad_(2011, 2027), 'JUVENILES');
  assert.equal(contexto.categoriaPorEdad_(2013, 2026), 'INFANTILES');
  assert.equal(contexto.categoriaPorEdad_(2000, 2026), null);
});

test('básquet: encuentra los torneos del año en el menú del sitio', () => {
  const menu = '<a href="/detalle-torneo/2015/formativas-2026">F</a> <a href="/detalle-torneo/2028/formativas-2026">F</a>' +
    '<a href="/detalle-torneo/2013/superior-2026">S</a> <a href="/detalle-torneo/1900/formativas-2025">F</a>';
  assert.deepEqual([...contexto.competicionesDelAnio_(menu, 'formativas', 2026)], ['2015', '2028']);
  assert.deepEqual([...contexto.competicionesDelAnio_(menu, 'formativas', 2027)], []);
});

test('básquet: lee las categorías del selector del torneo', () => {
  const html = '<select id="select-categoria" name="CompeticionHasCategoriaId" class="form-control">' +
    '<option value="">-- Seleccione una Categoría --</option> <option value="5077"> CADETES MASCULINO </option>' +
    '<option value="5076"> JUVENILES MASCULINO </option></select>';
  assert.deepEqual(JSON.parse(JSON.stringify(contexto.categoriasDeTorneo_(html))), [
    { id: '5077', nombre: 'CADETES MASCULINO' }, { id: '5076', nombre: 'JUVENILES MASCULINO' }]);
});

test('básquet: equipos del club en un fixture', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'fixture-febamba.html'), 'utf8');
  assert.deepEqual([...contexto.equiposDelClub_(html, 'Argentino de Castelar')],
    ['ARGENTINO DE CASTELAR CENTRO B', 'ARGENTINO DE CASTELAR NORTE A']);
});

test('básquet: evento de calendario de un partido', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'fixture-febamba.html'), 'utf8');
  const [jugado, porJugar] = contexto.partidosDelEquipo_(html, 'ARGENTINO DE CASTELAR NORTE A', 'https://www.febamba.com');
  const a = contexto.eventoDePartido_(jugado, 'ARGENTINO DE CASTELAR NORTE A');
  assert.equal(a.titulo, '🏀 Perdieron 73–75 vs Lanus A');
  assert.equal(a.clave, 'ARGENTINO DE CASTELAR NORTE A | LANUS A');
  assert.equal(a.lugar, 'Argentino de Castelar');
  assert.equal(a.fin - a.inicio, 2 * 3600000);
  const b = contexto.eventoDePartido_(porJugar, 'ARGENTINO DE CASTELAR NORTE A');
  assert.equal(b.titulo, '🏀 Básquet vs Pedro Echagüe Azul');
});
