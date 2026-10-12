/*
 * De dónde salen las fotos.
 *
 *   Fuentes.demo()          → imágenes de ejemplo en web/demo/ (sin configurar nada)
 *   Fuentes.drive(url, tk)  → tu carpeta de Drive, a través del Apps Script
 *
 * Las dos devuelven el mismo formato:
 *   listar(): Promise<foto[]>      foto = { id, ancho, alto, fecha }
 *   url(foto): Promise<string>     (de un video: su miniatura)
 *   video(foto): Promise<string>   URL reproducible del video (foto.video === true)
 *   agenda(): Promise<evento[]>    ver js/agenda.js
 *   clima(): Promise<clima>        ver js/clima.js
 *   basquet(): Promise<partidos>   ver js/basquet.js
 *   listas(), compra(op, datos), tarea(op, datos)   ver js/listas.js y apps-script/Listas.gs
 *   colegium(): Promise<{ datos, recibido }>         ver js/cole.js y extension-colegium/
 *   classroom(): Promise<{ datos, recibido }>        ver js/classroom.js y apps-script-classroom/
 *   mails(): Promise<{ mails, actualizado }>          ver js/mails.js y apps-script/Mails.gs
 */
(function (root) {
  'use strict';

  function hace(anios, mes, dia) {
    var hoy = new Date();
    var d = new Date(hoy.getFullYear() - anios, mes === undefined ? hoy.getMonth() : mes,
      dia === undefined ? hoy.getDate() : dia, 12);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T12:00';
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function demo() {
    // "Un día como hoy" se arma con fechas relativas a hoy, para que siempre se vea.
    var fotos = [
      { id: 'playa', ancho: 1600, alto: 1200, fecha: hace(3) },
      { id: 'montana', ancho: 1920, alto: 1080, fecha: hace(1, 6, 14) },
      { id: 'cumple-1', ancho: 1080, alto: 1920, fecha: hace(1, 2, 3) },
      { id: 'cumple-2', ancho: 1080, alto: 1920, fecha: hace(1, 2, 3) },
      { id: 'cumple-3', ancho: 1080, alto: 1920, fecha: hace(1, 2, 3) },
      { id: 'plaza-1', ancho: 1200, alto: 1600, fecha: hace(0, 0, 20) },
      { id: 'plaza-2', ancho: 1200, alto: 1600, fecha: hace(0, 0, 20) },
      { id: 'perro', ancho: 1200, alto: 1600, fecha: hace(2, 4, 9) },
      { id: 'asado', ancho: 1200, alto: 1200, fecha: hace(0, 1, 11) },
      { id: 'glaciar', ancho: 3600, alto: 1200, fecha: hace(2, 0, 28) },
      { id: 'lago', ancho: 1600, alto: 1200, fecha: hace(6) },
      { id: 'primer-dia', ancho: 1200, alto: 1600, fecha: hace(4, 2, 1) },
      { id: 'video', video: true, mime: 'video/mp4', ancho: 640, alto: 360, segundos: 6, fecha: hace(1, 8, 2) }
    ];
    return {
      listar: function () { return Promise.resolve(fotos); },
      url: function (foto) { return Promise.resolve('demo/' + foto.id + (foto.video ? '.jpg' : '.svg')); },
      video: function (foto) { return Promise.resolve('demo/' + foto.id + '.mp4'); },
      girar: function () { return Promise.resolve({}); },
      agenda: function () { return Promise.resolve(agendaEjemplo(new Date())); },
      clima: function () { return Promise.resolve(Clima.ejemplo(new Date())); },
      basquet: function () { return Promise.resolve(basquetEjemplo(new Date())); },
      listas: function () { return Promise.resolve(listasDemo.copia()); },
      compra: function (op, datos) { return Promise.resolve(listasDemo.compra(op, datos)); },
      tarea: function (op, datos) { return Promise.resolve(listasDemo.tarea(op, datos)); },
      colegium: function () { return Promise.resolve(coleEjemplo(new Date())); },
      classroom: function () { return Promise.resolve(classroomEjemplo(new Date())); },
      mails: function () { return Promise.resolve(mailsEjemplo(new Date())); }
    };
  }

  // Mails de ejemplo (remitentes inventados), con fechas relativas a hoy.
  function mailsEjemplo(ahora) {
    function dia(sumar, h, m) { return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + sumar, h || 0, m || 0).toISOString(); }
    function mail(id, categoria, asunto, de, recibido, resumen, cuando) {
      return { id: id, categoria: categoria, asunto: asunto, de: de, recibido: recibido, resumen: resumen, link: '', cuando: cuando, sinLeer: false };
    }
    return {
      actualizado: new Date(ahora.getTime() - 6 * 60000).toISOString(),
      mails: [
        mail('m1', 'Salud', 'Recordatorio de turno – Clínica Pediátrica', 'Turnos Online', dia(0, 8, 12),
          'Le recordamos su turno con la Dra. Gómez (Pediatría) el próximo martes. Por favor presentarse 15 minutos antes con la credencial.',
          { fecha: dia(8, 10, 30), conHora: true }),
        mail('m2', 'Pagos', 'Tu factura de luz ya está disponible', 'Empresa de energía', dia(-1, 19, 40),
          'El total a pagar es $ 48.230. La fecha de vencimiento es el 22 de este mes.', { fecha: dia(10), conHora: false }),
        mail('m3', 'Cole', 'Reunión de padres 4° B', 'Secretaría del colegio', dia(-2, 11, 5),
          'Los esperamos el jueves a las 19 h en el SUM para conversar sobre el viaje de fin de año.', { fecha: dia(3, 19, 0), conHora: true }),
        mail('m4', 'Salud', 'Resultados de laboratorio disponibles', 'Laboratorio', dia(-4, 10, 0),
          'Ya puede descargar los resultados de los estudios realizados.', null),
        mail('m5', 'Viajes', 'Confirmación de reserva', 'Hotel Costa', dia(-6, 21, 30),
          'Reserva confirmada para 3 personas. Check-in desde las 14 h.', { fecha: dia(40), conHora: false })
      ]
    };
  }

  // Classroom de ejemplo, con fechas relativas a hoy.
  function classroomEjemplo(ahora) {
    function dia(sumar, h, m) {
      return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + sumar, h === undefined ? 23 : h, m === undefined ? 59 : m).toISOString();
    }
    function t(id, titulo, curso, estado, vence, extra) {
      return Object.assign({ id: id, titulo: titulo, curso: curso, estado: estado, vence: vence, descripcion: '', link: '' }, extra || {});
    }
    return {
      recibido: new Date(ahora.getTime() - 40 * 60000).toISOString(),
      datos: {
        actualizado: new Date(ahora.getTime() - 40 * 60000).toISOString(),
        cursos: [{ nombre: 'Matemática' }, { nombre: 'Geografía' }, { nombre: 'Literatura' }, { nombre: 'Inglés' }],
        tareas: [
          t('c1', 'Mapa de climas de Argentina', 'Geografía', 'atrasada', dia(-1)),
          t('c2', 'Guía de ejercicios: funciones lineales', 'Matemática', 'pendiente', dia(1, 8, 0)),
          t('c3', 'Leer capítulos 3 y 4 de "El Principito"', 'Literatura', 'pendiente', dia(3)),
          t('c4', 'Vocabulary quiz practice', 'Inglés', 'pendiente', dia(9)),
          t('c5', 'TP Polinomios', 'Matemática', 'devuelta', dia(-3), { nota: 9, notaMax: 10 }),
          t('c6', 'Cuestionario de la unidad 2', 'Geografía', 'entregada', dia(-2))
        ],
        avisos: [
          { curso: 'Matemática', texto: 'Recuerden traer la calculadora el jueves para la evaluación.', fecha: new Date(ahora.getTime() - 5 * 3600000).toISOString() }
        ]
      }
    };
  }

  // Datos de Colegium de ejemplo (nombres inventados).
  function coleEjemplo(ahora) {
    function hace(horas) { return new Date(ahora.getTime() - horas * 3600000).toISOString(); }
    function b(inicio, fin, modulo, materia) { return { inicio: inicio, fin: fin, modulo: modulo, materias: [materia] }; }
    var semana = {
      lun: [b('07:40', '08:40', '1er hora', 'Matemática'), b('08:40', '09:40', '2da hora', 'Lengua y Literatura'),
            b('10:00', '11:00', '3er hora', 'Historia'), b('11:00', '12:00', '4ta hora', 'Comunicación'),
            b('12:10', '13:10', '5ta hora', 'Educación Física')],
      mar: [b('07:40', '08:40', '1er hora', 'Inglés'), b('08:40', '09:40', '2da hora', 'Química'),
            b('10:00', '11:00', '3er hora', 'Geografía'), b('11:00', '12:00', '4ta hora', 'Matemática')],
      mie: [b('07:40', '08:40', '1er hora', 'Biología'), b('08:40', '09:40', '2da hora', 'Lengua y Literatura'),
            b('10:00', '11:00', '3er hora', 'Arte'), b('11:00', '12:00', '4ta hora', 'Comunicación')],
      jue: [b('07:40', '08:40', '1er hora', 'Física'), b('08:40', '09:40', '2da hora', 'Historia'),
            b('10:00', '11:00', '3er hora', 'Inglés'), b('11:00', '12:00', '4ta hora', 'Matemática')],
      vie: [b('07:40', '08:40', '1er hora', 'Geografía'), b('08:40', '09:40', '2da hora', 'Química'),
            b('10:00', '11:00', '3er hora', 'Educación Física')]
    };
    return {
      recibido: hace(2),
      datos: {
        colegio: { colegio: 'Colegio de ejemplo', alumno: 'Thiago' },
        periodos: [{ id: 'j5', nombre: '1er cuatrimestre', actual: false }, { id: 'jV', nombre: '2do cuatrimestre', actual: true }],
        comunicados: [
          { id: 'c1', titulo: 'Gira deportiva a Miramar', remitente: 'Paula Gómez', rol: 'Administración', fecha: hace(5),
            resumen: 'Buenos días, les envío las novedades sobre la gira deportiva: salida el viernes 6 a las 7 h desde el colegio. Traer DNI y autorización firmada.',
            leido: false, destacado: true, adjuntos: 1 },
          { id: 'c2', titulo: 'Prueba integradora de Matemática', remitente: 'Laura Pérez', rol: 'Docente', fecha: hace(28),
            resumen: 'El jueves 22 tomaremos la prueba integradora. Temas: funciones lineales y sistemas de ecuaciones.',
            leido: false, destacado: false, adjuntos: 0 },
          { id: 'c3', titulo: 'Inscripción Activamente 2026', remitente: 'Dirección', rol: 'Director', fecha: hace(120),
            resumen: 'Les recordamos que está abierta la inscripción al programa Activamente.', leido: true, destacado: false, adjuntos: 4 },
          { id: 'c4', titulo: 'Acto del Día de la Diversidad Cultural', remitente: 'Preceptoría', rol: 'Preceptor', fecha: hace(150),
            resumen: 'El acto será el martes a las 8 h. Los alumnos de 4° B participan con una lectura.', leido: true, destacado: false, adjuntos: 0 }
        ],
        detalles: [{ id: 'c3', titulo: 'Inscripción Activamente 2026',
          mensaje: 'Estimadas familias:\nLes recordamos que está abierta la inscripción al programa Activamente 2026. Pueden inscribirse hasta el 30 de octubre completando el formulario adjunto.\nSaludos cordiales,\nDirección', adjuntos: ['Folleto.pdf'] }],
        horario: semana,
        asistencia: { presente: 95.8, inasistencias: 7.25, tardanzas: 0.25 },
        faltas: [{ fecha: '2026-10-08', estado: 'A', tipo: 'Injustificada', justificacion: 'pendiente' },
                 { fecha: '2026-09-21', estado: 'A', tipo: 'Justificada', justificacion: 'pendiente' }],
        archivos: [
          { nombre: 'Actividades Geografía 4°.pdf', autor: 'Carolina S.', fecha: hace(30), leido: false },
          { nombre: 'Pausa de hidratación.pdf', autor: 'Daiana A.', fecha: hace(200), leido: false },
          { nombre: 'Cronograma de evaluaciones.pdf', autor: 'Preceptoría', fecha: hace(400), leido: true }
        ],
        calificaciones: (function () {
          function ev(nombre, tipo, concepto, dias, nota) {
            return { nombre: nombre, tipo: tipo, nota: nota || '', concepto: concepto, fecha: hace(dias * 24) };
          }
          function materia(relId, titulo, finalPrimero, evals) {
            return { relId: relId, materiaId: null, titulo: titulo, periodos: [
              { id: 'j5', nombre: '1er cuatrimestre', final: { nombre: 'Nota final', tipo: 'NF', nota: finalPrimero, concepto: '', fecha: hace(24 * 90) }, evaluaciones: [] },
              { id: 'jV', nombre: '2do cuatrimestre', final: null, evaluaciones: evals }] };
          }
          return {
            m1: materia('m1', 'Matemática', '8', [ev('Polinomios', 'TP', 'MB', 4), ev('Calificación parcial', 'CP', 'EXC', 20)]),
            m2: materia('m2', 'Química', '6', [ev('Tabla periódica', 'Ev', 'R', 6), ev('Laboratorio', 'TP', 'B', 15)]),
            m3: materia('m3', 'Lengua y Literatura', '9', [ev('Análisis de cuento', 'TP', 'EXC', 3)]),
            m4: materia('m4', 'Inglés', '7', [ev('Reading', 'Ev', 'B', 9), ev('Vocabulary', 'TC', 'MB', 25)]),
            m5: materia('m5', 'Historia', '7', [])
          };
        })(),
        actualizado: { comunicados: hace(2), horario: hace(50), asistencia: hace(50), archivos: hace(50), calificaciones: hace(3) }
      }
    };
  }

  // Listas de ejemplo que se pueden tocar (los cambios se pierden al recargar).
  var listasDemo = (function () {
    var n = 100;
    function id() { return 'd' + (n++); }
    var estado = {
      compras: [
        { id: id(), item: 'Leche', cantidad: 2, categoria: 'Lácteos', comprado: false },
        { id: id(), item: 'Queso cremoso', cantidad: 1, categoria: 'Lácteos', comprado: false },
        { id: id(), item: 'Yerba', cantidad: 1, categoria: 'Almacén', comprado: false },
        { id: id(), item: 'Galletitas para la vianda', cantidad: 3, categoria: 'Almacén', comprado: false },
        { id: id(), item: 'Bananas', cantidad: 6, categoria: 'Verdulería', comprado: false },
        { id: id(), item: 'Paltas', cantidad: 2, categoria: 'Verdulería', comprado: true },
        { id: id(), item: 'Cartulina celeste', cantidad: 1, categoria: 'Librería', comprado: false }
      ],
      habituales: [
        { item: 'Leche', categoria: 'Lácteos' }, { item: 'Yerba', categoria: 'Almacén' },
        { item: 'Pan', categoria: 'Panadería' }, { item: 'Huevos', categoria: 'Almacén' },
        { item: 'Bananas', categoria: 'Verdulería' }, { item: 'Café', categoria: 'Almacén' },
        { item: 'Manteca', categoria: 'Lácteos' }, { item: 'Papel de cocina', categoria: 'Limpieza' },
        { item: 'Detergente', categoria: 'Limpieza' }
      ],
      tareas: [
        { id: id(), tarea: 'Tender la cama', persona: 'Thi', momento: 'Mañana', estrellas: 1, dias: '', hecha: true },
        { id: id(), tarea: 'Desayunar y lavar la taza', persona: 'Thi', momento: 'Mañana', estrellas: 1, dias: '', hecha: false },
        { id: id(), tarea: 'Tarea del colegio', persona: 'Thi', momento: 'Tarde', estrellas: 2, dias: '', hecha: false },
        { id: id(), tarea: 'Preparar el bolso de básquet', persona: 'Thi', momento: 'Tarde', estrellas: 1, dias: '', hecha: true },
        { id: id(), tarea: 'Practicar tiros libres', persona: 'Thi', momento: 'Tarde', estrellas: 2, dias: '', hecha: false },
        { id: id(), tarea: 'Pagar expensas', persona: 'Javi', momento: 'Tarde', estrellas: 1, dias: '', hecha: true },
        { id: id(), tarea: 'Llamar al plomero', persona: 'Javi', momento: 'Tarde', estrellas: 1, dias: '', hecha: true },
        { id: id(), tarea: 'Sacar la basura', persona: 'Javi', momento: 'Noche', estrellas: 1, dias: '', hecha: false },
        { id: id(), tarea: 'Hacer las compras', persona: 'Dan', momento: 'Tarde', estrellas: 2, dias: '', hecha: false },
        { id: id(), tarea: 'Cocinar la cena', persona: 'Dan', momento: 'Noche', estrellas: 2, dias: '', hecha: false },
        { id: id(), tarea: 'Regar las plantas', persona: 'Cualquiera', momento: 'Tarde', estrellas: 2, dias: '', hecha: false },
        { id: id(), tarea: 'Vaciar el lavavajillas', persona: 'Cualquiera', momento: '', estrellas: 3, dias: '', hecha: false },
        { id: id(), tarea: 'Poner la mesa', persona: 'Cualquiera', momento: 'Noche', estrellas: 1, dias: '', hecha: false }
      ],
      estrellas: { Thi: 42, Javi: 9, Dan: 15 }
    };
    function copia() { return JSON.parse(JSON.stringify(estado)); }
    function buscar(lista, idBuscado) {
      var x = lista.filter(function (o) { return o.id === idBuscado; })[0];
      if (!x) throw new Error('No encontré ese elemento');
      return x;
    }
    return {
      copia: copia,
      compra: function (op, d) {
        if (op === 'agregar') {
          var existente = estado.compras.filter(function (c) {
            return !c.comprado && c.item.toLowerCase() === d.item.toLowerCase();
          })[0];
          if (existente) existente.cantidad += Number(d.cantidad) || 1;
          else estado.compras.push({ id: id(), item: d.item, cantidad: Number(d.cantidad) || 1,
            categoria: d.categoria || 'Otros', comprado: false });
        } else if (op === 'marcar') {
          buscar(estado.compras, d.id).comprado = d.valor === '1';
        } else if (op === 'cantidad') {
          buscar(estado.compras, d.id).cantidad = Math.max(1, Number(d.cantidad) || 1);
        }
        return copia();
      },
      tarea: function (op, d) {
        var t = buscar(estado.tareas, d.id);
        var hecha = d.valor === '1';
        if (hecha !== t.hecha) {
          estado.estrellas[t.persona] = (estado.estrellas[t.persona] || 0) + (hecha ? t.estrellas : -t.estrellas);
        }
        t.hecha = hecha;
        return copia();
      }
    };
  })();

  // Escudo de ejemplo: un círculo con las iniciales.
  function escudoEjemplo(letras, fondo, texto) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="46" fill="' + fondo + '" stroke="#141414" stroke-width="4"/>' +
      '<text x="50" y="62" font-family="Arial" font-weight="700" font-size="34" text-anchor="middle" fill="' +
      texto + '">' + letras + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function basquetEjemplo(ahora) {
    var EQUIPO = 'ARGENTINO DE CASTELAR NORTE A';
    function sabado(semanas) {
      var d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 11, 0);
      d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7) + semanas * 7);
      return d.toISOString();
    }
    function equipo(nombre, escudo, puntos) { return { nombre: nombre, escudo: escudo, puntos: puntos }; }
    var castelar = escudoEjemplo('A', '#8fb8de', '#141414');
    var p = function (fecha, local, visitante, cancha) {
      return { fecha: fecha, cancha: cancha, local: local, visitante: visitante };
    };
    return {
      equipo: EQUIPO,
      categoria: 'CADETES MASCULINO',
      partidos: [
        p(sabado(-3), equipo(EQUIPO, castelar, 73), equipo('LANUS A', escudoEjemplo('L', '#7a1f2b', '#fff'), 75), 'Argentino de Castelar'),
        p(sabado(-2), equipo('RIVER PLATE', escudoEjemplo('R', '#fff', '#d0302b'), 60), equipo(EQUIPO, castelar, 81), 'River Plate'),
        p(sabado(-1), equipo(EQUIPO, castelar, 82), equipo('MIDLAND', escudoEjemplo('M', '#1f3f8f', '#fff'), 65), 'Argentino de Castelar'),
        p(sabado(1), equipo(EQUIPO, castelar, null), equipo('PEDRO ECHAGÜE AZUL', escudoEjemplo('PE', '#f2c230', '#1f3f8f'), null), 'Argentino de Castelar'),
        p(sabado(2), equipo('OBRAS', escudoEjemplo('O', '#e6e6e6', '#141414'), null), equipo(EQUIPO, castelar, null), 'Obras Sanitarias')
      ]
    };
  }

  // Eventos de ejemplo relativos a ahora, para que la demo siempre tenga algo que mostrar.
  function agendaEjemplo(ahora) {
    var CAL = {
      javi: ['Javi', '#2f5fd0'],
      thiago: ['Thi', '#d39b1e'],
      dan: ['Dan', '#7b4fc4'],
      familia: ['Familia', '#2e7d4f'],
      cumples: ['Cumpleaños', '#c2306b']
    };
    function en(min) { return new Date(ahora.getTime() + min * 60000).toISOString(); }
    function dia(sumar, h, m) {
      return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + sumar, h, m || 0).toISOString();
    }
    function ev(titulo, inicio, fin, cal, extra) {
      return Object.assign({ titulo: titulo, inicio: inicio, fin: fin, todoElDia: false, lugar: '',
        calendario: CAL[cal][0], color: CAL[cal][1] }, extra || {});
    }
    return [
      ev('Fútbol', en(26), en(116), 'thiago', { lugar: 'Club Arquitectura' }),
      ev('Llamada con el contador', en(140), en(170), 'javi'),
      ev('Inglés', en(200), en(260), 'thiago'),
      ev('Cena con los abuelos', en(330), en(450), 'familia', { lugar: 'Casa de los abuelos' }),
      ev('Acto del colegio · ir de blanco', dia(1, 8), dia(1, 9, 30), 'thiago'),
      ev('Dentista', dia(1, 18, 30), dia(1, 19, 15), 'javi'),
      ev('Pagar expensas', dia(1, 0), dia(2, 0), 'familia', { todoElDia: true }),
      ev('Prueba de matemática', dia(2, 8), dia(2, 9), 'thiago'),
      ev('Cumple de la abuela Marta', dia(3, 0), dia(4, 0), 'cumples', { todoElDia: true }),
      ev('Reunión de padres', dia(4, 19), dia(4, 20), 'familia'),
      ev('Partido de fútbol', dia(5, 10), dia(5, 12), 'thiago')
    ];
  }

  function drive(urlScript, token, opciones) {
    opciones = opciones || {};
    var latitud = opciones.latitud, longitud = opciones.longitud;
    var ancho = opciones.ancho || 1600;
    var maxCache = opciones.maxCache || 40;
    var cache = new Map(); // id → blob URL, en orden de uso
    var videos = crearVideos(pedir, token, opciones.maxVideosGuardados || 15);

    function pedir(params) {
      var qs = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      return fetch(urlScript + '?' + qs).catch(function () {
        throw new Error('No hay conexión con el Apps Script. Revisá la URL en config.js');
      }).then(function (r) {
        if (!r.ok) throw new Error('El Apps Script respondió con el error ' + r.status);
        return r.text();
      }).then(function (texto) {
        try {
          return JSON.parse(texto);
        } catch (e) {
          throw new Error('El Apps Script devolvió una página en vez de datos. ' +
            'Revisá que la implementación tenga acceso "Cualquier persona"');
        }
      }).then(function (datos) {
        if (datos.error) throw new Error(datos.error);
        return datos;
      });
    }

    function olvidar(id) {
      if (!cache.has(id)) return;
      URL.revokeObjectURL(cache.get(id));
      cache.delete(id);
    }

    function guardar(id, url) {
      cache.set(id, url);
      if (cache.size > maxCache) {
        var viejo = cache.keys().next().value;
        URL.revokeObjectURL(cache.get(viejo));
        cache.delete(viejo);
      }
    }

    return {
      listar: function () {
        return pedir({ action: 'lista', token: token }).then(function (d) { return d.fotos; });
      },
      url: function (foto) {
        if (cache.has(foto.id)) {
          var u = cache.get(foto.id);
          cache.delete(foto.id); cache.set(foto.id, u); // marcar como recién usada
          return Promise.resolve(u);
        }
        return pedir({ action: 'img', id: foto.id, ancho: ancho, token: token }).then(function (d) {
          var blob = new Blob([base64ABytes(d.data)], { type: d.mime });
          return (foto.girar ? girar(blob, foto.girar) : Promise.resolve(blob)).then(function (b) {
            var url = URL.createObjectURL(b);
            guardar(foto.id, url);
            return url;
          });
        });
      },
      video: videos.url,
      // Gira a mano una foto (queda guardado en el Apps Script).
      girar: function (foto, grados) {
        return pedir({ action: 'girar', id: foto.id, grados: grados, token: token }).then(function (d) {
          olvidar(foto.id);
          return d;
        });
      },
      agenda: function () {
        var nombres = opciones.nombresCalendarios || {};
        return pedir({ action: 'agenda', dias: 7, token: token }).then(function (d) {
          return d.eventos.map(function (e) {
            if (nombres[e.calendario]) e.calendario = nombres[e.calendario];
            return e;
          });
        });
      },
      clima: function () { return Clima.obtener(latitud, longitud); },
      basquet: function () { return pedir({ action: 'basquet', token: token }); },
      listas: function () { return pedir({ action: 'listas', token: token }); },
      compra: function (op, datos) {
        return pedir(Object.assign({ action: 'compra', op: op, token: token }, datos));
      },
      tarea: function (op, datos) {
        return pedir(Object.assign({ action: 'tarea', op: op, token: token }, datos));
      },
      colegium: function () { return pedir({ action: 'colegium', token: token }); },
      mails: function () { return pedir({ action: 'mails', token: token }); },
      classroom: function () {
        var nombres = opciones.nombresCalendarios || {};
        return pedir({ action: 'classroom', token: token }).then(function (r) {
          ((r.datos && r.datos.eventos) || []).forEach(function (e) {
            if (nombres[e.calendario]) e.calendario = nombres[e.calendario];
          });
          return r;
        });
      }
    };
  }

  /*
   * Gira una imagen (grados, sentido horario). Es para las fotos del iPhone cuyo
   * giro Drive no aplica en la miniatura (el Apps Script avisa con foto.girar).
   */
  function girar(blob, grados) {
    return createImageBitmap(blob).then(function (img) {
      var deCostado = grados === 90 || grados === 270;
      var c = document.createElement('canvas');
      c.width = deCostado ? img.height : img.width;
      c.height = deCostado ? img.width : img.height;
      var ctx = c.getContext('2d');
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate(grados * Math.PI / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      if (img.close) img.close();
      return new Promise(function (ok) {
        c.toBlob(function (b) { ok(b || blob); }, 'image/jpeg', 0.92);
      });
    }).catch(function () { return blob; });
  }

  function base64ABytes(b64) {
    var bytes = atob(b64);
    var arr = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return arr;
  }

  /*
   * Videos de Drive: se bajan por partes a través del Apps Script y se guardan
   * en el almacenamiento del navegador (Cache Storage), así cada video se baja
   * una sola vez. En memoria quedan solo los dos últimos.
   */
  function crearVideos(pedir, token, maxGuardados) {
    var NOMBRE = 'panel-videos';
    var enMemoria = new Map();
    var enCurso = {};

    function abrir() {
      if (!root.caches) return Promise.resolve(null);
      return caches.open(NOMBRE).catch(function () { return null; });
    }

    function clave(id) { return 'https://panel.local/videos/' + encodeURIComponent(id); }

    // El .mov del iPhone es el mismo formato que .mp4: así Chrome lo acepta mejor.
    function tipo(foto) { return foto.mime === 'video/quicktime' || !foto.mime ? 'video/mp4' : foto.mime; }

    function bajar(foto) {
      var partes = [];
      function siguiente(n) {
        return pedir({ action: 'video', id: foto.id, parte: n, token: token }).then(function (d) {
          if (d.data) partes.push(base64ABytes(d.data));
          var total = d.partes || 1;
          if (d.data && n + 1 < total) return siguiente(n + 1);
          return new Blob(partes, { type: tipo(foto) });
        });
      }
      return siguiente(0);
    }

    function guardar(c, id, blob) {
      if (!c) return Promise.resolve();
      return c.put(clave(id), new Response(blob, { headers: { 'Content-Type': blob.type } })).then(function () {
        return c.keys();
      }).then(function (ks) {
        // Los más viejos se borran para no llenar el marco.
        var sobran = ks.length - maxGuardados;
        return Promise.all(ks.slice(0, Math.max(0, sobran)).map(function (k) { return c.delete(k); }));
      }).catch(function (e) { console.warn('No se pudo guardar el video', e); });
    }

    function enMem(id, blob) {
      var u = URL.createObjectURL(blob);
      enMemoria.set(id, u);
      while (enMemoria.size > 2) {
        var viejo = enMemoria.keys().next().value;
        URL.revokeObjectURL(enMemoria.get(viejo));
        enMemoria.delete(viejo);
      }
      return u;
    }

    function url(foto) {
      if (enMemoria.has(foto.id)) return Promise.resolve(enMemoria.get(foto.id));
      if (enCurso[foto.id]) return enCurso[foto.id];
      var c0 = null;
      var p = abrir().then(function (c) {
        c0 = c;
        return c ? c.match(clave(foto.id)) : null;
      }).then(function (r) {
        if (r) return r.blob();
        return bajar(foto).then(function (blob) {
          return guardar(c0, foto.id, blob).then(function () { return blob; });
        });
      }).then(function (blob) {
        delete enCurso[foto.id];
        return enMem(foto.id, blob);
      }, function (err) {
        delete enCurso[foto.id];
        throw err;
      });
      enCurso[foto.id] = p;
      return p;
    }

    return { url: url };
  }

  root.Fuentes = { demo: demo, drive: drive };
})(window);
