const test = require('node:test');
const assert = require('node:assert/strict');
const Agenda = require('../web/js/agenda.js');
const Clima = require('../web/js/clima.js');

// Lunes 12 de octubre de 2026, 15:34 (hora local)
const AHORA = new Date(2026, 9, 12, 15, 34);
const en = (min) => new Date(AHORA.getTime() + min * 60000).toISOString();
const dia = (sumar, h, m) => new Date(2026, 9, 12 + sumar, h, m || 0).toISOString();
const ev = (titulo, inicio, fin, calendario, extra) =>
  Object.assign({ titulo, inicio, fin, calendario, color: '#123456', todoElDia: false }, extra);

test('próximo: cuenta regresiva en minutos si falta poco', () => {
  const p = Agenda.proximo([ev('Fútbol', en(26), en(116), 'Thiago')], AHORA);
  assert.equal(p.evento.titulo, 'Fútbol');
  assert.deepEqual([p.grande, p.chico], ['26', 'MIN']);
});

test('próximo: muestra la hora si falta más de hora y media', () => {
  const p = Agenda.proximo([ev('Cena', dia(0, 21), dia(0, 23), 'Familia')], AHORA);
  assert.deepEqual([p.grande, p.chico], ['21:00', 'HOY']);
});

test('próximo: un evento que ya empezó figura como "Ahora"', () => {
  const p = Agenda.proximo([ev('Reunión', en(-10), en(20), 'Javi')], AHORA);
  assert.equal(p.enCurso, true);
  assert.equal(p.grande, 'Ahora');
});

test('próximo: ignora los de todo el día y los que ya terminaron', () => {
  const p = Agenda.proximo([
    ev('Feriado', dia(0, 0), dia(1, 0), 'Feriados', { todoElDia: true }),
    ev('Ya pasó', en(-120), en(-60), 'Javi'),
    ev('Mañana', dia(1, 8), dia(1, 9), 'Thiago'),
  ], AHORA);
  assert.deepEqual([p.evento.titulo, p.grande, p.chico], ['Mañana', '08:00', 'MAÑANA']);
});

test('próximo: null si no hay nada', () => {
  assert.equal(Agenda.proximo([], AHORA), null);
});

test('columnas: agrupa hoy y mañana por calendario, las de más eventos primero', () => {
  const cols = Agenda.columnas([
    ev('A', en(10), en(20), 'Javi'),
    ev('B', en(30), en(40), 'Thiago'),
    ev('C', dia(1, 8), dia(1, 9), 'Thiago'),
    ev('Lejos', dia(3, 8), dia(3, 9), 'Javi'),
  ], AHORA);
  assert.deepEqual(cols.map((c) => c.calendario + ':' + c.eventos.length), ['Thiago:2', 'Javi:1']);
});

test('columnas: limita la cantidad y cuenta los que no entran', () => {
  const muchos = [1, 2, 3, 4, 5].map((i) => ev('E' + i, en(i * 10), en(i * 10 + 5), 'Javi'));
  const [col] = Agenda.columnas(muchos, AHORA, 4, 3);
  assert.equal(col.eventos.length, 3);
  assert.equal(col.mas, 2);
});

test('próximos días: solo desde pasado mañana', () => {
  const lista = Agenda.proximosDias([
    ev('Hoy', en(10), en(20), 'Javi'),
    ev('Mañana', dia(1, 8), dia(1, 9), 'Javi'),
    ev('Miércoles', dia(2, 8), dia(2, 9), 'Javi'),
  ], AHORA);
  assert.deepEqual(lista.map((e) => e.titulo), ['Miércoles']);
});

test('etiquetas de día', () => {
  assert.equal(Agenda.etiquetaDia(dia(0, 9), AHORA), 'Hoy');
  assert.equal(Agenda.etiquetaDia(dia(1, 9), AHORA), 'Mañana');
  assert.equal(Agenda.etiquetaDia(dia(2, 9), AHORA), 'Mié 14');
});

test('cuándo: texto de horario en la columna', () => {
  assert.equal(Agenda.cuando(ev('x', dia(0, 18, 5), dia(0, 19), 'J'), AHORA), '18:05');
  assert.equal(Agenda.cuando(ev('x', dia(1, 8), dia(1, 9), 'J'), AHORA), 'Mañana 08:00');
  assert.equal(Agenda.cuando(ev('x', dia(0, 0), dia(1, 0), 'J', { todoElDia: true }), AHORA), 'Todo el día');
});

// Respuesta recortada con el formato real de Open-Meteo
function respuesta(probLluvia) {
  const time = [], temperature_2m = [], weather_code = [], precipitation_probability = [];
  for (let h = 0; h < 48; h++) {
    const fecha = h < 24 ? '2026-10-12' : '2026-10-13';
    time.push(fecha + 'T' + String(h % 24).padStart(2, '0') + ':00');
    temperature_2m.push(20 - Math.max(0, h - 15));
    weather_code.push(3);
    precipitation_probability.push(probLluvia(h));
  }
  return {
    current: { time: '2026-10-12T15:30', temperature_2m: 19.6, weather_code: 2, is_day: 1 },
    hourly: { time, temperature_2m, weather_code, precipitation_probability },
    daily: { temperature_2m_max: [22.4], temperature_2m_min: [10.6] },
  };
}

test('clima: arranca en la hora actual y toma 12 horas', () => {
  const c = Clima.normalizar(respuesta(() => 0), AHORA);
  assert.equal(c.temp, 20);
  assert.equal(c.horas.length, 12);
  assert.equal(c.horas[0].hora, 15);
  assert.deepEqual([c.max, c.min], [22, 11]);
});

test('clima: avisa la lluvia con la hora', () => {
  const c = Clima.normalizar(respuesta((h) => (h >= 18 ? 70 : 0)), AHORA);
  assert.equal(Clima.frase(c), 'Lluvia desde las 18 h. Llevá paraguas.');
});

test('clima: avisa si refresca mucho', () => {
  const c = Clima.normalizar(respuesta(() => 0), AHORA);
  assert.match(Clima.frase(c), /^Refresca más tarde/);
});

test('clima: describe los códigos', () => {
  assert.equal(Clima.describir(0).texto, 'Despejado');
  assert.equal(Clima.describir(63).icono, 'lluvia');
  assert.equal(Clima.describir(95).icono, 'tormenta');
});
