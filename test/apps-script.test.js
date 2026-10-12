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
