// Prueba funciones del Apps Script que no dependen de servicios de Google.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contexto = {};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), contexto);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/DatosFotos.gs'), 'utf8'), contexto);

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

test('videos: saltea Live Photos, pesados y sin procesar', () => {
  const v = (ms, mb) => ({ id: 'x', mimeType: 'video/quicktime', createdTime: '2024-01-01T10:00:00Z',
    size: String(mb * 1024 * 1024), videoMediaMetadata: { width: 1920, height: 1080, durationMillis: ms } });
  const ok = contexto.videoDeArchivo_(v(12000, 20));
  assert.equal(ok.video, true);
  assert.equal(ok.segundos, 12);
  assert.equal(ok.mime, 'video/quicktime');
  assert.equal(contexto.videoDeArchivo_(v(2500, 3)), null);   // Live Photo
  assert.equal(contexto.videoDeArchivo_(v(60000, 300)), null); // muy pesado
  assert.equal(contexto.videoDeArchivo_(v(undefined, 20)), null); // Drive todavía lo procesa
});

test('videos: total del Content-Range', () => {
  assert.equal(contexto.totalDeRango_('bytes 0-6291455/15000000'), 15000000);
  assert.equal(contexto.totalDeRango_(undefined), null);
});

// Caja ISO: tamaño (4 bytes) + tipo (4) + contenido
function caja(tipo, contenido) {
  const largo = 8 + contenido.length;
  return [largo >>> 24, (largo >> 16) & 255, (largo >> 8) & 255, largo & 255, ...Buffer.from(tipo), ...contenido];
}

test('giro: HEIC con irot (vueltas antihorarias) → grados horarios', () => {
  const heic = (vueltas) => [
    ...caja('ftyp', [...Buffer.from('heicmif1')]),
    ...caja('meta', [0, 0, 0, 0, ...caja('hdlr', [0, 0, 0, 0]), ...caja('iprp', caja('ipco', [...caja('ispe', [0, 0, 0, 0]), ...caja('irot', [vueltas])]))]),
    ...caja('mdat', [1, 2, 3])
  ];
  assert.equal(contexto.giroDeBytes_(heic(1)), 270);
  assert.equal(contexto.giroDeBytes_(heic(2)), 180);
  assert.equal(contexto.giroDeBytes_(heic(3)), 90);
  assert.equal(contexto.giroDeBytes_(heic(0)), 0);
  assert.equal(contexto.giroDeBytes_(caja('ftyp', [...Buffer.from('heic')])), 0);
});

test('giro: orientación EXIF de un JPG', () => {
  const jpg = (o) => {
    const tiff = [0x4D, 0x4D, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0];
    const app1 = [...Buffer.from('Exif'), 0, 0, ...tiff];
    const l = app1.length + 2;
    return [0xFF, 0xD8, 0xFF, 0xE1, l >> 8, l & 255, ...app1, 0xFF, 0xDA, 0, 2];
  };
  assert.equal(contexto.giroDeBytes_(jpg(6)), 90);
  assert.equal(contexto.giroDeBytes_(jpg(3)), 180);
  assert.equal(contexto.giroDeBytes_(jpg(8)), 270);
  assert.equal(contexto.giroDeBytes_(jpg(1)), 0);
});

test('giro manual: suma al giro y da vuelta ancho y alto', () => {
  const props = null;
  contexto.DATOS_FOTOS_ = { man_a: '90', man_b: '180' }; // datos de fotos ya cargados (hoja "Datos de fotos")
  const fotos = [{ id: 'a', ancho: 800, alto: 600 }, { id: 'b', ancho: 800, alto: 600, girar: 180 }, { id: 'c', ancho: 1, alto: 2 }];
  contexto.aplicarGirosManuales_(props, fotos);
  assert.deepEqual([fotos[0].girar, fotos[0].ancho, fotos[0].alto], [90, 600, 800]);
  assert.equal(fotos[1].girar, undefined); // 180 + 180 = derecha
  assert.equal(fotos[2].girar, undefined);
});

test('lugar de la foto: nombre corto a partir del geocodificador', () => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/LugaresFotos.gs'), 'utf8'), contexto);
  const comp = (nombre, tipo) => ({ long_name: nombre, types: [tipo, 'political'] });
  const miramar = { results: [{ address_components: [comp('123', 'street_number'), comp('Miramar', 'locality'),
    comp('General Alvarado', 'administrative_area_level_2'), comp('Provincia de Buenos Aires', 'administrative_area_level_1'), comp('Argentina', 'country')] }] };
  assert.equal(contexto.nombreDeGeocoder_(miramar), 'Miramar');
  const orlando = { results: [{ address_components: [comp('Orlando', 'locality'), comp('Estados Unidos', 'country')] }] };
  assert.equal(contexto.nombreDeGeocoder_(orlando), 'Orlando, Estados Unidos');
  const campo = { results: [{ address_components: [comp('Tandil', 'administrative_area_level_2'), comp('Argentina', 'country')] }] };
  assert.equal(contexto.nombreDeGeocoder_(campo), 'Tandil');
  assert.equal(contexto.nombreDeGeocoder_({ results: [] }), '');
});

test('lugar de la foto: se busca una vez por zona (~1 km) y queda guardado', () => {
  let busquedas = 0;
  contexto.DATOS_FOTOS_ = {};
  contexto.Maps = { newGeocoder: () => ({ setLanguage: () => ({ reverseGeocode: () => { busquedas++; return { results: [{ address_components: [{ long_name: 'Miramar', types: ['locality'] }, { long_name: 'Argentina', types: ['country'] }] }] }; } }) }) };
  const fotos = [{ id: 'a', _coord: [-38.2701, -57.8402] }, { id: 'b', _coord: [-38.2712, -57.8399] }, { id: 'c' }];
  contexto.ponerLugares_(fotos, 5);
  assert.deepEqual(fotos.map((f) => f.lugar || ''), ['Miramar', 'Miramar', '']);
  assert.equal(busquedas, 1);
  assert.equal(fotos[0]._coord, undefined);
});
