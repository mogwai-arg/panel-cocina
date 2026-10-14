const test = require('node:test');
const assert = require('node:assert/strict');
const Menu = require('../web/js/menu.js');
const T = require('../web/js/temporizador.js');

const FILAS = [
  { dia: 'lun', cena: 'Milanesas', ingredientes: 'milanesas, papas , leche', receta: '' },
  { dia: 'miércoles', cena: 'Tarta', ingredientes: 'acelga; huevos', receta: 'https://ejemplo.com/tarta' },
  { dia: '2026-10-12', cena: 'Sushi (cumple)', ingredientes: '', receta: 'no es link' },
  { dia: 'vie', cena: '', ingredientes: 'nada' }
];

test('menú: el día de la semana se repite y la fecha gana', () => {
  assert.equal(Menu.delDia(FILAS, new Date(2026, 9, 12)).cena, 'Sushi (cumple)');   // lunes con fecha
  assert.equal(Menu.delDia(FILAS, new Date(2026, 9, 19)).cena, 'Milanesas');        // otro lunes
  const mie = Menu.delDia(FILAS, new Date(2026, 9, 14));
  assert.deepEqual(mie.ingredientes, ['acelga', 'huevos']);
  assert.equal(mie.receta, 'https://ejemplo.com/tarta');
  assert.equal(Menu.delDia(FILAS, new Date(2026, 9, 12)).receta, '');
  assert.equal(Menu.delDia(FILAS, new Date(2026, 9, 16)), null);  // viernes sin cena
  assert.equal(Menu.delDia(null, new Date()), null);
});

test('menú: de noche muestra la cena de mañana', () => {
  assert.equal(Menu.paraMostrar(FILAS, new Date(2026, 9, 13, 20, 0)), null);  // martes: nada
  const m = Menu.paraMostrar(FILAS, new Date(2026, 9, 13, 21, 30));
  assert.equal(m.titulo, 'Mañana');
  assert.equal(m.cena, 'Tarta');
  assert.equal(Menu.paraMostrar(FILAS, new Date(2026, 9, 14, 18, 0)).titulo, 'Esta noche');
});

test('menú: ingredientes que faltan en compras', () => {
  const compras = [{ item: 'Papas', comprado: false }, { item: 'leche', comprado: true }];
  assert.deepEqual(Menu.faltanEnCompras(['milanesas', 'papas', 'leche'], compras), ['milanesas', 'leche']);
});

test('temporizador: formato, pausa, seguir y sumar', () => {
  assert.equal(T.formato(125), '2:05');
  assert.equal(T.formato(3725), '1:02:05');
  assert.equal(T.formato(-3), '0:00');
  let t = T.crear(5, '5 min', 0);
  assert.equal(T.restante(t, 60000), 240);
  t = T.pausar(t, 60000);
  assert.equal(T.restante(t, 999999), 240);
  assert.equal(T.sono(t, 999999), false);
  t = T.seguir(t, 100000);
  assert.equal(T.restante(t, 100000), 240);
  t = T.sumar(t, 60, 100000);
  assert.equal(T.restante(t, 100000), 300);
  assert.equal(T.sono(t, 400000), true);
});

test('temporizador: QR del Wi-Fi con caracteres especiales', () => {
  assert.equal(T.textoWifi('Casa Invitados', 'a;b:c', 'WPA'), 'WIFI:T:WPA;S:Casa Invitados;P:a\\;b\\:c;;');
  assert.equal(T.textoWifi('Abierta', ''), 'WIFI:T:nopass;S:Abierta;;');
});
