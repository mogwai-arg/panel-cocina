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
      '<div class="reloj"><b data-r="hora"></b><div><span data-r="dia"></span><span data-r="fecha"></span></div>' +
      '<p class="saludo" data-r="saludo"></p></div>' +
      '<div class="clima" data-r="clima"></div>' +
      '<div class="quienes" data-r="quienes"></div>' +
      '<button class="recuerdo" data-r="recuerdo" aria-label="Ver fotos"></button>' +
      '<div class="proximo" data-r="proximo"></div>' +
      '<div class="columnas" data-r="columnas"></div>' +
      '<div class="pendientes-hoy" data-r="pendientes" hidden></div>' +
      '<div class="manana" data-r="manana" hidden></div>' +
      '<div class="lateral"><div class="basquet" data-r="basquet" hidden></div>' +
      '<div class="dias" data-r="dias"></div></div>';

    function parte(nombre) { return contenedor.querySelector('[data-r="' + nombre + '"]'); }

    var eventos = [];
    var errorAgenda = null;
    var basquet = null; // datos crudos de los partidos
    var aula = null;    // Classroom: las entregas van a la agenda
    var classroomConfig = opciones.classroom || {};
    var mails = null;   // mails importantes con fecha → agenda
    var mailsConfig = opciones.mails || {};

    function pintarReloj() {
      var ahora = new Date();
      parte('hora').textContent = Agenda.hora(ahora);
      parte('dia').textContent = DIAS[ahora.getDay()];
      parte('fecha').textContent = ahora.getDate() + ' de ' + MESES[ahora.getMonth()];
      parte('saludo').textContent = saludo(ahora);
    }

    // "Buen día. Esto es lo de hoy." / "Buenas noches. Esto es lo de mañana."
    function saludo(ahora) {
      var m = ahora.getHours() * 60 + ahora.getMinutes();
      if (m >= 5 * 60 && m < 12 * 60) return 'Buen día. Esto es lo de hoy.';
      if (m < 19 * 60 + 30 && m >= 12 * 60) return 'Buenas tardes. Esto es lo de hoy.';
      return 'Buenas noches. Esto es lo de mañana.';
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
        '<p class="clima__nota"></p>' + curvaClima(c);
      caja.querySelector('b').textContent = c.temp + '°';
      caja.querySelector('em').textContent = desc.texto;
      caja.querySelector('small').textContent = 'Máx ' + c.max + '° · Mín ' + c.min + '°';
      caja.querySelector('.clima__nota').textContent = Clima.frase(c);
    }

    /*
     * Curva de temperatura de las próximas 12 horas (SVG): la temperatura cada 2 horas,
     * barritas celestes si puede llover y una marca al amanecer y al atardecer.
     * Todo son números que arma Clima.curva, así que se puede escribir como texto.
     */
    function curvaClima(c) {
      var ANCHO = 358, ALTO = 92, X0 = 14, Y0 = 20, ALTO_CURVA = 40;
      var r = Clima.curva(c, ANCHO - 2 * X0, ALTO_CURVA, 0);
      var ps = r.puntos.map(function (p) { return { x: p.x + X0, y: p.y + Y0, temp: p.temp, hora: p.hora, lluvia: p.lluvia }; });
      if (ps.length < 2) return '';
      // Curva suave (Catmull-Rom → Bézier)
      var d = 'M' + ps[0].x + ' ' + ps[0].y;
      for (var i = 0; i < ps.length - 1; i++) {
        var p0 = ps[i - 1] || ps[i], p1 = ps[i], p2 = ps[i + 1], p3 = ps[i + 2] || p2;
        d += ' C' + (p1.x + (p2.x - p0.x) / 6).toFixed(1) + ' ' + (p1.y + (p2.y - p0.y) / 6).toFixed(1) +
          ' ' + (p2.x - (p3.x - p1.x) / 6).toFixed(1) + ' ' + (p2.y - (p3.y - p1.y) / 6).toFixed(1) +
          ' ' + p2.x + ' ' + p2.y;
      }
      var base = Y0 + ALTO_CURVA + 8;
      var svg = '<svg class="curva" viewBox="0 0 ' + ANCHO + ' ' + ALTO + '" aria-hidden="true">';
      ps.forEach(function (p) {
        if (p.lluvia < 20) return;
        var h = Math.round(p.lluvia / 100 * 22);
        svg += '<rect class="curva__lluvia" x="' + (p.x - 5) + '" y="' + (base - h) + '" width="10" height="' + h + '" rx="2"/>';
      });
      svg += '<path class="curva__area" d="' + d + ' L' + ps[ps.length - 1].x + ' ' + base + ' L' + ps[0].x + ' ' + base + 'Z"/>';
      svg += '<path class="curva__linea" d="' + d + '"/>';
      r.sol.forEach(function (m) {
        var x = m.x + X0;
        svg += '<line class="curva__sol" x1="' + x + '" y1="10" x2="' + x + '" y2="' + base + '"/>' +
          '<circle class="curva__sol-ic curva__sol-ic--' + m.tipo + '" cx="' + x + '" cy="7" r="4"/>' +
          '<text class="curva__sol-txt" x="' + (x + 7) + '" y="10">' + m.hora + '</text>';
      });
      ps.forEach(function (p, j) {
        if (j % 2) return;
        svg += '<circle class="curva__punto' + (j === 0 ? ' curva__punto--ahora' : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="' + (j === 0 ? 4 : 2.5) + '"/>' +
          '<text class="curva__temp" x="' + p.x + '" y="' + (p.y - 8) + '">' + p.temp + '°</text>' +
          '<text class="curva__hora" x="' + p.x + '" y="' + (ALTO - 4) + '">' + (j === 0 ? 'AHORA' : p.hora + ' h') + '</text>';
      });
      return svg + '</svg>';
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
        col.setAttribute('data-quien', String(c.calendario).toLowerCase());
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

    /*
     * La semana: siete días con el clima (ícono y máxima) y un puntito por cada calendario
     * que tiene algo ese día. Tocando un día se ve lo de ese día; si no, los próximos días.
     */
    var diaElegido = null;     // 'YYYY-MM-DD'
    var diaElegidoTimer = null;
    var climaDatos = null;
    var CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    function iso(f) { return f.getFullYear() + '-' + (f.getMonth() < 9 ? '0' : '') + (f.getMonth() + 1) + '-' + (f.getDate() < 10 ? '0' : '') + f.getDate(); }
    function eventosDelDia(fecha) {
      var desde = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
      var hasta = new Date(desde.getTime() + 86400000);
      return eventos.filter(function (e) {
        var i = new Date(e.inicio), f = new Date(e.fin || e.inicio);
        return i < hasta && (f > desde || i >= desde);
      }).sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });
    }

    function pintarDias() {
      var caja = parte('dias');
      caja.innerHTML = '';
      var ahora = new Date();
      var climaPorDia = {};
      ((climaDatos && climaDatos.dias) || []).forEach(function (d) { climaPorDia[d.fecha] = d; });

      var tira = el('div', 'semana');
      for (var i = 0; i < 7; i++) {
        var fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
        var clave = iso(fecha);
        var pill = el('button', 'pill' + (clave === diaElegido ? ' pill--elegido' : '') + (i === 0 ? ' pill--hoy' : ''));
        pill.appendChild(el('small', null, i === 0 ? 'Hoy' : CORTOS[fecha.getDay()]));
        pill.appendChild(el('b', null, String(fecha.getDate())));
        var cd = climaPorDia[clave];
        var cl = el('span', 'pill__clima');
        if (cd) {
          cl.innerHTML = icono(Clima.describir(cd.codigo).icono, 'ic ic--mini');
          cl.appendChild(el('i', null, cd.max + '°'));
        }
        pill.appendChild(cl);
        var puntos = el('span', 'pill__puntos');
        var colores = [];
        eventosDelDia(fecha).forEach(function (e) {
          var c = color(e.color);
          if (colores.indexOf(c) < 0 && colores.length < 3) colores.push(c);
        });
        colores.forEach(function (c) { var p = el('i'); p.style.background = c; puntos.appendChild(p); });
        pill.appendChild(puntos);
        pill.addEventListener('click', elegirDia.bind(null, clave));
        tira.appendChild(pill);
      }
      caja.appendChild(tira);

      var lista, vacio, conHora;
      if (diaElegido) {
        var p = diaElegido.split('-');
        var f = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        var cd2 = climaPorDia[diaElegido];
        var cab = el('div', 'dias__cab');
        cab.appendChild(el('span', 'lbl', Agenda.etiquetaDia(f, ahora)));
        if (cd2) {
          cab.appendChild(el('span', 'dias__clima', (cd2.lluvia >= 30 ? 'Lluvia ' + cd2.lluvia + '%' : Clima.describir(cd2.codigo).texto) +
            ' · ' + cd2.max + '°/' + cd2.min + '°'));
        }
        caja.appendChild(cab);
        lista = eventosDelDia(f);
        vacio = 'Nada agendado ese día.';
        conHora = true;
      } else {
        caja.appendChild(el('span', 'lbl', 'Próximos días'));
        lista = Agenda.proximosDias(eventos, ahora, basquet ? 2 : 7);
        vacio = 'Nada agendado.';
      }
      if (!lista.length) {
        caja.appendChild(el('p', 'dias__vacio', vacio));
        return;
      }
      lista.forEach(function (e) {
        var fila = el('div', 'dia');
        var punto = el('i');
        punto.style.background = color(e.color);
        fila.appendChild(punto);
        fila.appendChild(el('b', null, conHora ? (e.todoElDia ? 'Todo el día' : Agenda.hora(e.inicio)) : Agenda.etiquetaDia(e.inicio, ahora)));
        fila.appendChild(el('span', null, e.titulo));
        caja.appendChild(fila);
      });
    }

    function elegirDia(clave) {
      diaElegido = diaElegido === clave ? null : clave;
      clearTimeout(diaElegidoTimer);
      // Al rato vuelve solo a "Próximos días".
      if (diaElegido) diaElegidoTimer = setTimeout(function () { diaElegido = null; pintarDias(); }, 60000);
      pintarDias();
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

    function eventosDeMails() {
      if (!mails || mailsConfig.enAgenda === false || !root.Mails) return [];
      return root.Mails.comoEventos(mails, new Date(), mailsConfig.calendario || 'Avisos');
    }

    function cargarMails() {
      if (!fuente.mails) return Promise.resolve();
      return fuente.mails().then(function (d) { mails = d; }).catch(function (err) {
        console.error(err);
      }).then(cargarAgenda);
    }

    // Dónde está cada persona que manda su ubicación (OwnTracks).
    var ubicaciones = null;
    var lugarVisto = {}; // quién → último lugar mostrado, para avisar los cambios en pantalla
    function avisarCambiosDeLugar(personas) {
      personas.forEach(function (p) {
        var antes = lugarVisto[p.quien];
        lugarVisto[p.quien] = p.lugar || null;
        if (antes === undefined || antes === (p.lugar || null) || !opciones.avisar) return;
        var texto = p.lugar ? '📍 ' + p.quien + ' llegó a ' + p.lugar : '📍 ' + p.quien + ' salió de ' + antes;
        opciones.avisar(texto, null, 20000);
      });
    }

    /*
     * Quiénes y dónde (arriba a la derecha, como en el panel de Wes): cada persona de
     * config.js con su ubicación si manda OwnTracks; si no, cómo vienen sus tareas de hoy.
     */
    var progresoTareas = {};
    function pintarQuienes() {
      var caja = parte('quienes');
      var colores = opciones.personas || {};
      var personas = Object.keys(colores);
      var ubis = {};
      ((ubicaciones && ubicaciones.personas) || []).forEach(function (p) {
        ubis[String(p.quien).toLowerCase()] = p;
        if (personas.map(function (x) { return x.toLowerCase(); }).indexOf(String(p.quien).toLowerCase()) < 0) personas.push(p.quien);
      });
      caja.innerHTML = '';
      caja.hidden = !personas.length;
      var ahora = new Date();
      personas.forEach(function (nombre) {
        var fila = el('div', 'quien');
        var av = el('span', 'quien__av', inicial(nombre));
        av.style.borderColor = color(colores[nombre] || '#6d6b66');
        av.style.color = color(colores[nombre] || '#6d6b66');
        fila.appendChild(av);
        fila.appendChild(el('b', 'quien__nombre', nombre));
        var estado = el('span', 'quien__estado');
        var u = ubis[nombre.toLowerCase()];
        if (u && root.Ubicacion) {
          var d = root.Ubicacion.describir(u, ahora);
          estado.appendChild(el('span', 'quien__donde' + (d.viejo ? ' quien__donde--viejo' : ''), '📍 ' + d.titulo));
          estado.appendChild(el('small', d.bateriaBaja ? 'quien__alerta' : null, d.detalle));
        } else if (progresoTareas[nombre]) {
          var t = progresoTareas[nombre];
          estado.appendChild(el('span', 'quien__tareas', t.hechas === t.total ? '✓ Tareas listas' : 'Tareas ' + t.hechas + '/' + t.total));
        }
        fila.appendChild(estado);
        caja.appendChild(fila);
      });
    }

    function pintarDonde() {
      var personas = (ubicaciones && ubicaciones.personas) || [];
      avisarCambiosDeLugar(personas);
      pintarQuienes();
    }

    function cargarUbicacion() {
      if (!fuente.ubicacion) return Promise.resolve();
      return fuente.ubicacion().then(function (d) { ubicaciones = d; }).catch(function (err) {
        console.error(err);
      }).then(pintarDonde);
    }

    function cargarClassroom() {
      if (!fuente.classroom) return Promise.resolve();
      return fuente.classroom().then(function (r) {
        aula = r && r.datos;
      }).catch(function (err) {
        console.error(err);
      }).then(function () { if (planManana) pintarManana(); return cargarAgenda(); });
    }

    function cargarAgenda() {
      return fuente.agenda().then(function (lista) {
        lista = lista || [];
        var deThi = aula ? Classroom.eventosDeSuCuenta(aula, lista, classroomConfig.calendario || 'Thi',
          classroomConfig.color || '#d39b1e', opciones.nombresCortos) : [];
        var todos = lista.concat(deThi);
        if (aula && classroomConfig.enAgenda !== false) todos = Classroom.sinRepetidos(todos, aula);
        eventos = todos.concat(eventosDeBasquet(), eventosDeClassroom(), eventosDeMails());
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
      return fuente.clima().then(function (c) {
        climaDatos = c;
        pintarClima(c);
      }).catch(function (err) {
        console.error(err);
        pintarClima(null);
      }).then(function () { pintarDias(); pintarManana(); });
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

    // "hoy" / "mañana" / "en 5 días"
    function faltanDias(fecha) {
      var a = new Date(), f = new Date(fecha);
      var n = Math.round((new Date(f.getFullYear(), f.getMonth(), f.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
      return n <= 0 ? 'hoy' : n === 1 ? 'mañana' : 'en ' + n + ' días';
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
        var medio = el('div', 'duelo__medio');
        medio.appendChild(el('span', 'duelo__vs', 'vs'));
        medio.appendChild(el('b', 'chip', faltanDias(p.fecha)));
        duelo.appendChild(medio);
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
          caja.querySelector('i').textContent = Fotos.fechaLarga(foto.fecha) +
            (foto.lugar && opciones.mostrarLugar !== false ? ' · ' + foto.lugar : '');
        });
      }).catch(function (err) { console.error(err); });
    }

    /* ===== Tareas pendientes de este momento del día (fila de chips abajo) ===== */
    var listas = opciones.listas || null;
    function datosListas() { return listas && listas.datos ? listas.datos() : null; }

    function marcar(t) {
      if (!listas) return;
      listas.marcarTarea(t.id, !t.hecha);
      if (!t.hecha && opciones.avisar) {
        opciones.avisar('✓ ' + t.tarea, function () { listas.marcarTarea(t.id, false); }, 5000);
      }
    }

    function pintarPendientes() {
      var caja = parte('pendientes');
      var d = datosListas();
      var ahora = new Date();
      var momento = Listas.momentoActual(ahora);
      var faltan = ((d && d.tareas) || []).filter(function (t) {
        return !t.hecha && Listas.tocaHoy(t, ahora) &&
          (!t.momento || String(t.momento).toLowerCase().trim() === momento.toLowerCase());
      });
      caja.innerHTML = '';
      caja.hidden = !faltan.length;
      if (!faltan.length) return;
      caja.appendChild(el('span', 'lbl', 'Falta ' + (momento === 'Mañana' ? 'esta mañana' : momento === 'Tarde' ? 'esta tarde' : 'esta noche')));
      var colores = opciones.personas || {};
      var MAX = 4;
      faltan.slice(0, MAX).forEach(function (t) {
        var b = el('button', 'tchip');
        var av = el('span', 'tchip__av', inicial(t.persona));
        av.style.background = color(colores[t.persona] || '#6d6b66');
        b.appendChild(av);
        b.appendChild(el('span', 'tchip__txt', t.tarea));
        b.addEventListener('click', function () { marcar(t); });
        caja.appendChild(b);
      });
      if (faltan.length > MAX) {
        var mas = el('button', 'tchip tchip--mas', '+' + (faltan.length - MAX) + ' más');
        mas.addEventListener('click', function () { if (opciones.irA) opciones.irA('tareas'); });
        caja.appendChild(mas);
      }
    }

    /* ===== Mañana de cole ===== */
    var cole = null;   // datos de Colegium (horario)
    var ia = null;     // asistente: pendientes y repasos
    var planManana = null;
    var CLAVE_LISTO = 'panel-manana-listo';
    var personaCole = opciones.personaCole || 'Thi';
    function listoEl() { try { return window.localStorage.getItem(CLAVE_LISTO); } catch (e) { return null; } }

    function calcularManana() {
      var op = Object.assign({}, opciones.manana ? opciones.manana() : { activo: false });
      op.horario = cole && cole.horario;
      op.listoEl = listoEl();
      planManana = root.Manana ? root.Manana.plan(new Date(), op) : null;
      return planManana;
    }

    var mananaPintada = false;
    function pintarManana() {
      var antes = mananaPintada;
      var plan = calcularManana();
      mananaPintada = !!plan;
      var caja = parte('manana');
      contenedor.classList.toggle('hoy--manana', !!plan);
      caja.hidden = !plan;
      if (antes !== !!plan && opciones.alCambiarManana) opciones.alCambiarManana(!!plan);
      if (!plan) { caja.innerHTML = ''; return; }
      var ahora = new Date();
      caja.innerHTML = '';

      // Arriba: hora de salir y cuenta regresiva
      var cuenta = Manana.cuentaRegresiva(plan.faltan);
      var cab = el('div', 'manana__cab' + (cuenta.tarde ? ' manana__cab--ya' : ''));
      var info = el('div', 'proximo__info');
      info.appendChild(el('span', 'lbl', 'Mañana de cole · ' + personaCole));
      info.appendChild(el('h2', 'proximo__titulo', 'Salir a las ' + plan.salida));
      info.appendChild(el('p', 'proximo__detalle', plan.primera
        ? 'Entra ' + plan.primera.inicio + ' · ' + plan.primera.materia
        : 'Hoy hay cole'));
      var num = el('div', 'proximo__cuenta');
      num.appendChild(el('b', cuenta.grande.length > 3 ? 'largo' : '', cuenta.grande));
      num.appendChild(el('span', null, cuenta.chico));
      cab.appendChild(info);
      cab.appendChild(num);
      caja.appendChild(cab);

      var cuerpo = el('div', 'manana__cuerpo');

      // Izquierda: lo que hay que hacer antes de salir
      var izq = el('section', 'manana__lista');
      var tareas = Manana.tareasDeLaManana((datosListas() || {}).tareas, personaCole, ahora, Listas.tocaHoy);
      var hechas = tareas.filter(function (t) { return t.hecha; }).length;
      var t1 = el('div', 'manana__tit');
      t1.appendChild(el('span', 'lbl', 'Antes de salir'));
      if (tareas.length) t1.appendChild(el('b', 'manana__progreso', hechas + '/' + tareas.length));
      izq.appendChild(t1);
      if (!tareas.length) {
        izq.appendChild(el('p', 'dias__vacio', 'No hay tareas de la mañana para ' + personaCole + ' en la planilla.'));
      }
      tareas.slice(0, 6).forEach(function (t) {
        var b = el('button', 'check' + (t.hecha ? ' check--hecha' : ''));
        b.appendChild(el('span', 'check__caja', t.hecha ? '✓' : ''));
        b.appendChild(el('span', 'check__txt', t.tarea));
        b.addEventListener('click', function () { marcar(t); });
        izq.appendChild(b);
      });
      var listo = el('button', 'manana__listo', tareas.length && hechas === tareas.length ? '¡Todo listo! Nos vamos ✓' : 'Listo ✓');
      listo.addEventListener('click', function () {
        try { window.localStorage.setItem(CLAVE_LISTO, Manana.diaIso(new Date())); } catch (e) { /* nada */ }
        if (opciones.avisar) opciones.avisar('¡Que tengas un lindo día, ' + personaCole + '! 🎒', null, 6000);
        pintarManana();
      });
      izq.appendChild(listo);
      cuerpo.appendChild(izq);

      // Derecha: materias, qué no olvidar y qué llevar
      var der = el('section', 'manana__info');
      if (plan.clases.length) {
        der.appendChild(el('span', 'lbl', 'Hoy en el cole'));
        var clases = el('div', 'manana__clases');
        plan.clases.slice(0, 7).forEach(function (c) {
          var f = el('div', 'clase');
          f.appendChild(el('b', null, c.inicio));
          f.appendChild(el('span', null, c.materia));
          clases.appendChild(f);
        });
        der.appendChild(clases);
      }
      var ojo = Manana.paraHoy(aula, ia, ahora);
      if (ojo.length) {
        der.appendChild(el('span', 'lbl', 'No olvidar'));
        ojo.slice(0, 4).forEach(function (x) {
          der.appendChild(el('p', 'manana__ojo manana__ojo--' + x.tipo, x.texto));
        });
      }
      var llevar = Manana.consejosClima(climaDatos, plan.salida);
      if (llevar.length) {
        der.appendChild(el('span', 'lbl', 'Qué llevar'));
        llevar.forEach(function (x) { der.appendChild(el('p', 'manana__llevar', x.icono + ' ' + x.texto)); });
      }
      cuerpo.appendChild(der);
      caja.appendChild(cuerpo);
    }

    function cargarCole() {
      var pedidos = [];
      if (fuente.colegium) {
        pedidos.push(fuente.colegium().then(function (r) { cole = r && r.datos; }).catch(function (err) { console.error(err); }));
      }
      if (fuente.ia) {
        pedidos.push(fuente.ia().then(function (r) { ia = r && r.datos; }).catch(function (err) { console.error(err); }));
      }
      return Promise.all(pedidos).then(pintarManana);
    }

    if (listas) listas.alCambiar(function () { pintarPendientes(); if (planManana) pintarManana(); });

    parte('recuerdo').addEventListener('click', alTocarRecuerdo);

    var timers = [];
    function cada(ms, fn) { timers.push(setInterval(fn, ms)); }

    return {
      // Progreso de las tareas de hoy por persona (lo manda app.js cuando cambian las listas).
      tareas: function (progreso) {
        progresoTareas = {};
        (progreso || []).forEach(function (p) { progresoTareas[p.persona] = p; });
        pintarQuienes();
      },
      iniciar: function () {
        pintarQuienes();
        pintarReloj();
        cargarClima();
        cargarAgenda();
        cargarRecuerdo();
        cargarBasquet();
        cargarClassroom();
        cargarMails();
        cargarCole();
        cargarUbicacion();
        cada(10000, pintarReloj);
        cada(30000, function () {
          pintarProximo(); pintarColumnas(); pintarDias(); pintarBasquet(); pintarQuienes();
          pintarPendientes(); pintarManana();
        });
        cada(30 * 60000, cargarCole);
        cada(60 * 60000, cargarBasquet);
        cada(30 * 60000, cargarClassroom);
        cada(15 * 60000, cargarMails);
        cada(2 * 60000, cargarUbicacion);
        cada(5 * 60000, cargarAgenda);
        cada(30 * 60000, cargarClima);
        cada(10 * 60000, cargarRecuerdo);
      },
      reloj: function () { return Agenda.hora(new Date()); },
      // ¿Se está mostrando la mañana de cole? (app.js no pasa a fotos ni apaga la pantalla)
      enManana: function () { return !!calcularManana(); },
      repintarManana: function () { pintarManana(); }
    };
  }

  root.Hoy = { crearHoy: crearHoy };
})(window);
