/*
 * Vista "Hoy": reloj, clima, próximo evento, agenda por calendario,
 * próximos días y un recuerdo de las fotos.
 */
(function (root) {
  'use strict';

  var DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var ICONOS = {
    sol: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    parcial: '<path d="M8 5.5V4M3.5 9.5H2M4.6 6.1l-1-1M11.4 6.1l1-1"/><path d="M5.2 11.2a3.5 3.5 0 0 1 6.3-2.6"/><path d="M7 20h10a4 4 0 0 0 .4-8 5 5 0 0 0-9.6 1.2A3.4 3.4 0 0 0 7 20z"/>',
    nube: '<path d="M6.5 19h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5 1.6A3.8 3.8 0 0 0 6.5 19z"/>',
    niebla: '<path d="M4 9h16M2 13h20M5 17h14"/>',
    lluvia: '<path d="M6.5 15h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5 1.6A3.8 3.8 0 0 0 6.5 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    nieve: '<path d="M6.5 15h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5 1.6A3.8 3.8 0 0 0 6.5 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>',
    tormenta: '<path d="M6.5 15h11a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5 1.6A3.8 3.8 0 0 0 6.5 15z"/><path d="M12.5 15l-2 4h3l-2 4"/>'
  };

  function icono(nombre, clase) {
    return '<svg class="' + (clase || 'ic') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[nombre] + '</svg>';
  }

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  // Los colores vienen de Google Calendar: solo se aceptan códigos hexadecimales.
  function color(c) {
    return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#6d6b66';
  }

  function inicial(nombre) {
    return (nombre || '?').trim().charAt(0).toUpperCase();
  }

  function crearHoy(contenedor, fuente, opciones) {
    opciones = opciones || {};
    var alTocarRecuerdo = opciones.alTocarRecuerdo || function () {};
    var basquetConfig = opciones.basquet || {};

    contenedor.innerHTML =
      '<div class="reloj"><b data-r="hora"></b><div><span data-r="dia"></span><span data-r="fecha"></span></div></div>' +
      '<div class="clima" data-r="clima"></div>' +
      '<button class="recuerdo" data-r="recuerdo" aria-label="Ver fotos"></button>' +
      '<div class="proximo" data-r="proximo"></div>' +
      '<div class="columnas" data-r="columnas"></div>' +
      '<div class="lateral"><div class="basquet" data-r="basquet" hidden></div>' +
      '<div class="dias" data-r="dias"></div></div>';

    function parte(nombre) { return contenedor.querySelector('[data-r="' + nombre + '"]'); }

    var eventos = [];
    var errorAgenda = null;
    var basquet = null; // datos crudos de los partidos
    var aula = null;    // Classroom: las entregas van a la agenda
    var classroomConfig = opciones.classroom || {};

    function pintarReloj() {
      var ahora = new Date();
      parte('hora').textContent = Agenda.hora(ahora);
      parte('dia').textContent = DIAS[ahora.getDay()];
      parte('fecha').textContent = ahora.getDate() + ' de ' + MESES[ahora.getMonth()];
    }

    function pintarClima(c) {
      var caja = parte('clima');
      if (!c) {
        caja.innerHTML = '<p class="clima__nota">Sin datos del clima por ahora.</p>';
        return;
      }
      var desc = Clima.describir(c.codigo);
      var nombreIcono = desc.icono === 'sol' && !c.esDeDia ? 'luna' : desc.icono;
      caja.innerHTML =
        '<div class="clima__ahora">' + icono(nombreIcono, 'ic ic--grande') +
        '<b></b><span><em></em><small></small></span></div>' +
        '<p class="clima__nota"></p><div class="clima__horas"></div>';
      caja.querySelector('b').textContent = c.temp + '°';
      caja.querySelector('em').textContent = desc.texto;
      caja.querySelector('small').textContent = 'Máx ' + c.max + '° · Mín ' + c.min + '°';
      caja.querySelector('.clima__nota').textContent = Clima.frase(c);
      var horas = caja.querySelector('.clima__horas');
      c.horas.filter(function (_, i) { return i % 2 === 0; }).slice(0, 6).forEach(function (h, i) {
        var d = Clima.describir(h.codigo);
        var celda = el('span');
        celda.innerHTML = '<i></i>' + icono(d.icono) + '<b></b>';
        celda.querySelector('i').textContent = i === 0 ? 'AHORA' : h.hora + ' h';
        celda.querySelector('b').textContent = h.temp + '°';
        horas.appendChild(celda);
      });
    }

    function pintarProximo() {
      var caja = parte('proximo');
      caja.innerHTML = '';
      if (errorAgenda) {
        caja.classList.add('proximo--vacio');
        caja.appendChild(el('p', 'proximo__vacio', 'No se pudo leer el calendario: ' + errorAgenda));
        return;
      }
      var p = Agenda.proximo(eventos, new Date());
      caja.classList.toggle('proximo--vacio', !p);
      if (!p) {
        caja.appendChild(el('p', 'proximo__vacio', 'No hay nada más en la agenda. ¡A descansar!'));
        return;
      }
      var info = el('div', 'proximo__info');
      info.appendChild(el('span', 'lbl', (p.enCurso ? 'Ahora · ' : 'Próximo · ') + p.evento.calendario));
      info.appendChild(el('h2', 'proximo__titulo', p.evento.titulo));
      var detalle = Agenda.hora(p.evento.inicio) + ' – ' + Agenda.hora(p.evento.fin);
      if (p.evento.lugar) detalle += ' · ' + p.evento.lugar;
      info.appendChild(el('p', 'proximo__detalle', detalle));
      var cuenta = el('div', 'proximo__cuenta');
      cuenta.appendChild(el('b', p.grande.length > 3 ? 'largo' : '', p.grande));
      cuenta.appendChild(el('span', null, p.chico));
      caja.appendChild(info);
      caja.appendChild(cuenta);
    }

    function pintarColumnas() {
      var caja = parte('columnas');
      caja.innerHTML = '';
      if (errorAgenda) return;
      var cols = Agenda.columnas(eventos, new Date(), 4, 5);
      if (!cols.length) {
        caja.appendChild(el('p', 'columnas__vacio', 'Hoy y mañana, agenda libre.'));
        return;
      }
      cols.forEach(function (c) {
        var col = el('div', 'col');
        col.style.borderTopColor = color(c.color);
        var titulo = el('h3');
        var av = el('span', 'av', inicial(c.calendario));
        av.style.background = color(c.color);
        titulo.appendChild(av);
        titulo.appendChild(document.createTextNode(c.calendario));
        col.appendChild(titulo);
        c.eventos.forEach(function (e) {
          var ev = el('div', 'evt');
          ev.appendChild(el('small', null, Agenda.cuando(e, new Date())));
          ev.appendChild(document.createTextNode(e.titulo));
          col.appendChild(ev);
        });
        if (c.mas) col.appendChild(el('span', 'mas', '+' + c.mas + ' más'));
        caja.appendChild(col);
      });
    }

    function pintarDias() {
      var caja = parte('dias');
      caja.innerHTML = '';
      caja.appendChild(el('span', 'lbl', 'Próximos días'));
      var lista = Agenda.proximosDias(eventos, new Date(), basquet ? 4 : 9);
      if (!lista.length) {
        caja.appendChild(el('p', 'dias__vacio', 'Nada agendado.'));
        return;
      }
      lista.forEach(function (e) {
        var fila = el('div', 'dia');
        var punto = el('i');
        punto.style.background = color(e.color);
        fila.appendChild(punto);
        fila.appendChild(el('b', null, Agenda.etiquetaDia(e.inicio, new Date())));
        fila.appendChild(el('span', null, e.titulo));
        caja.appendChild(fila);
      });
    }

    function eventosDeBasquet() {
      if (!basquet || basquetConfig.enAgenda === false) return [];
      return Basquet.comoEventos(basquet, new Date(),
        basquetConfig.calendario || 'Básquet', basquetConfig.color || '#d39b1e');
    }

    function eventosDeClassroom() {
      if (!aula || classroomConfig.enAgenda === false) return [];
      return Classroom.comoEventos(aula, new Date(), classroomConfig.calendario || 'Thi', classroomConfig.color || '#d39b1e');
    }

    function cargarClassroom() {
      if (!fuente.classroom) return Promise.resolve();
      return fuente.classroom().then(function (r) {
        aula = r && r.datos;
      }).catch(function (err) {
        console.error(err);
      }).then(cargarAgenda);
    }

    function cargarAgenda() {
      return fuente.agenda().then(function (lista) {
        var propios = aula && classroomConfig.enAgenda !== false ? Classroom.sinRepetidos(lista || [], aula) : (lista || []);
        eventos = propios.concat(eventosDeBasquet(), eventosDeClassroom());
        errorAgenda = null;
      }).catch(function (err) {
        console.error(err);
        errorAgenda = err.message;
      }).then(function () {
        pintarProximo();
        pintarColumnas();
        pintarDias();
      });
    }

    function cargarClima() {
      return fuente.clima().then(pintarClima).catch(function (err) {
        console.error(err);
        pintarClima(null);
      });
    }

    function escudo(lado) {
      var caja = el('div', 'escudo');
      caja.appendChild(el('span', 'escudo__iniciales', Basquet.nombreLindo(lado.nombre).charAt(0)));
      if (lado.escudo) {
        var img = el('img');
        img.alt = '';
        img.onerror = function () { img.remove(); };
        img.src = lado.escudo;
        caja.appendChild(img);
      }
      return caja;
    }

    function pintarBasquet() {
      var caja = parte('basquet');
      if (!basquet) { caja.hidden = true; return; }
      var r = Basquet.resumen(basquet, new Date());
      caja.hidden = false;
      caja.innerHTML = '';

      var cab = el('div', 'basquet__cab');
      cab.appendChild(el('span', 'lbl', 'Básquet' + (r.categoria ? ' · ' + r.categoria : '')));
      if (r.proximo) {
        cab.appendChild(el('b', 'basquet__dia',
          Agenda.etiquetaDia(r.proximo.fecha, new Date()) + ' · ' + Agenda.hora(r.proximo.fecha)));
      }
      caja.appendChild(cab);

      if (r.proximo) {
        var duelo = el('div', 'duelo');
        var p = r.proximo;
        var izq = p.esLocal ? p.propio : p.rival;
        var der = p.esLocal ? p.rival : p.propio;
        duelo.appendChild(escudo(izq));
        duelo.appendChild(el('span', 'duelo__vs', 'vs'));
        duelo.appendChild(escudo(der));
        caja.appendChild(duelo);
        caja.appendChild(el('p', 'basquet__rival', Basquet.nombreLindo(p.rival.nombre)));
        caja.appendChild(el('p', 'basquet__cancha', (p.esLocal ? 'De local · ' : 'De visitante · ') + p.cancha));
      } else {
        caja.appendChild(el('p', 'basquet__rival', 'Sin partidos programados'));
      }

      if (r.ultimo) {
        var pie = el('div', 'basquet__pie');
        var u = r.ultimo;
        pie.appendChild(el('span', 'basquet__ultimo', (u.gano ? 'Ganaron ' : 'Perdieron ') +
          u.propio.puntos + '–' + u.rival.puntos + ' vs ' + Basquet.nombreLindo(u.rival.nombre)));
        var racha = el('span', 'racha');
        racha.title = 'Últimos partidos';
        r.racha.forEach(function (g) { racha.appendChild(el('i', g ? 'g' : 'p', g ? 'G' : 'P')); });
        pie.appendChild(racha);
        caja.appendChild(pie);
      }
      if (r.aviso) caja.appendChild(el('p', 'basquet__aviso', r.aviso));
    }

    function cargarBasquet() {
      if (!fuente.basquet) return Promise.resolve();
      return fuente.basquet().then(function (d) {
        basquet = d;
      }).catch(function (err) {
        console.error(err);
      }).then(function () {
        pintarBasquet();
        return cargarAgenda();
      });
    }

    // Recuerdo: una foto de "un día como hoy" si hay; si no, una horizontal al azar.
    function cargarRecuerdo() {
      var caja = parte('recuerdo');
      return fuente.listar().then(function (fotos) {
        if (!fotos.length) return;
        var hoy = new Date();
        var recuerdos = fotos.filter(function (f) { return Layout.haceAnios(f, hoy) !== null; });
        var horizontales = fotos.filter(function (f) { return Layout.orientacion(f) === 'horizontal'; });
        var pool = recuerdos.length ? recuerdos : (horizontales.length ? horizontales : fotos);
        var foto = pool[Math.floor(Math.random() * pool.length)];
        return fuente.url(foto).then(function (url) {
          caja.innerHTML = '<img alt=""><div class="recuerdo__pie"><span></span><i></i></div>';
          caja.querySelector('img').src = url;
          var anios = Layout.haceAnios(foto, hoy);
          caja.querySelector('span').textContent = anios
            ? 'Hace ' + anios + (anios === 1 ? ' año' : ' años') : 'Recuerdo';
          caja.querySelector('i').textContent = Fotos.fechaLarga(foto.fecha);
        });
      }).catch(function (err) { console.error(err); });
    }

    parte('recuerdo').addEventListener('click', alTocarRecuerdo);

    var timers = [];
    function cada(ms, fn) { timers.push(setInterval(fn, ms)); }

    return {
      iniciar: function () {
        pintarReloj();
        cargarClima();
        cargarAgenda();
        cargarRecuerdo();
        cargarBasquet();
        cargarClassroom();
        cada(10000, pintarReloj);
        cada(30000, function () { pintarProximo(); pintarColumnas(); pintarDias(); pintarBasquet(); });
        cada(60 * 60000, cargarBasquet);
        cada(30 * 60000, cargarClassroom);
        cada(5 * 60000, cargarAgenda);
        cada(30 * 60000, cargarClima);
        cada(10 * 60000, cargarRecuerdo);
      },
      reloj: function () { return Agenda.hora(new Date()); }
    };
  }

  root.Hoy = { crearHoy: crearHoy };
})(window);
