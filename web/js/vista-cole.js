/*
 * Pantalla "Cole": comunicados, horario, asistencia y archivos de Colegium.
 * Los datos llegan cuando alguien abre Colegium en la compu con la extensión.
 */
(function (root) {
  'use strict';

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function hace(iso) {
    if (!iso) return 'nunca';
    var min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return 'recién';
    if (min < 60) return 'hace ' + min + ' min';
    if (min < 1440) return 'hace ' + Math.round(min / 60) + ' h';
    var d = Math.round(min / 1440);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }

  function numero(n) {
    return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }

  function crearCole(contenedor, fuente, opciones) {
    opciones = opciones || {};
    var alCambiar = opciones.alCambiar || function () {};
    var respuesta = null;
    var aula = null; // { datos, recibido } de Classroom
    var ia = null;   // resumen de la semana y repasos (asistente con IA)
    var errorAula = null;
    var abierto = null;
    var error = null;
    var pestana = 'comunicados';

    contenedor.innerHTML =
      '<div class="cole__principal">' +
      '  <div class="listas__cab"><div><span class="lbl" data-r="colegio">Colegio</span><h2 class="listas__titulo"><span data-r="titulo">Comunicados</span> <small data-r="sinleer"></small></h2>' +
      '    <button class="cole__vistos" data-r="vistos" hidden>Marcar todos como vistos</button></div>' +
      '    <div class="seg" role="group" aria-label="Sección"><button data-tab="comunicados" aria-pressed="true">COMUNICADOS</button><button data-tab="notas" aria-pressed="false">NOTAS</button><button data-tab="classroom" aria-pressed="false">CLASSROOM <span class="seg__num" data-r="urgentes" hidden></span></button><button data-tab="repaso" aria-pressed="false">REPASO ✨</button></div></div>' +
      '  <div class="comunicados" data-r="comunicados"></div>' +
      '  <div class="repaso" data-r="repaso" hidden></div>' +
      '  <div class="notas" data-r="notas" hidden></div>' +
      '  <div class="aula" data-r="classroom" hidden></div>' +
      '</div>' +
      '<div class="cole__lado">' +
      '  <div class="box" data-r="horario"></div>' +
      '  <div class="box" data-r="asistencia"></div>' +
      '  <div class="box" data-r="archivos"></div>' +
      '  <p class="cole__pie" data-r="pie"></p>' +
      '</div>';

    function parte(n) { return contenedor.querySelector('[data-r="' + n + '"]'); }

    // Resumen de la semana que arma el asistente con IA (arriba de los comunicados).
    function semanaIA() {
      var s = ia && ia.datos;
      if (!s || (!s.resumen && !(s.pendientes || []).length)) return null;
      var caja = el('div', 'semana-ia');
      caja.appendChild(el('span', 'lbl', '✨ Esta semana'));
      if (s.resumen) caja.appendChild(el('p', 'semana-ia__resumen', s.resumen));
      (s.pendientes || []).forEach(function (p) {
        var fila = el('div', 'semana-ia__pendiente');
        fila.appendChild(el('span', null, '☐ ' + p.texto));
        if (p.para) fila.appendChild(el('small', null, 'para el ' + Number(p.para.slice(8)) + '/' + Number(p.para.slice(5, 7))));
        caja.appendChild(fila);
      });
      return caja;
    }

    // Repasos para las pruebas que vienen: tocar una pregunta muestra la respuesta.
    function pintarRepaso() {
      var caja = parte('repaso');
      caja.innerHTML = '';
      var repasos = (ia && ia.datos && ia.datos.repasos) || [];
      if (!repasos.length) {
        caja.appendChild(el('p', 'listas__vacio', ia
          ? 'Cuando el cole avise de una prueba, acá aparece un repaso con preguntas para practicar.'
          : 'El asistente con IA todavía no está activado (ver README, sección Asistente con IA).'));
        return;
      }
      repasos.forEach(function (r) {
        var tarjeta = el('div', 'box repaso__prueba');
        var cab = el('div', 'repaso__cab');
        cab.appendChild(el('b', null, r.materia));
        if (r.fecha) cab.appendChild(el('span', 'repaso__fecha', 'Prueba ' + Cole.fechaCorta(r.fecha + 'T12:00:00', new Date()).replace(/ \d\d:\d\d$/, '')));
        tarjeta.appendChild(cab);
        tarjeta.appendChild(el('p', 'repaso__temas', r.temas));
        (r.preguntas || []).forEach(function (q, i) {
          var b = el('button', 'pregunta');
          b.appendChild(el('span', 'pregunta__n', String(i + 1)));
          var txt = el('span', 'pregunta__txt');
          txt.appendChild(el('b', null, q.pregunta));
          var resp = el('span', 'pregunta__resp', q.respuesta);
          resp.hidden = true;
          txt.appendChild(resp);
          txt.appendChild(el('small', 'pregunta__ver', 'Tocá para ver la respuesta'));
          b.appendChild(txt);
          b.addEventListener('click', function () {
            resp.hidden = !resp.hidden;
            b.classList.toggle('pregunta--abierta', !resp.hidden);
          });
          tarjeta.appendChild(b);
        });
        caja.appendChild(tarjeta);
      });
      caja.appendChild(el('p', 'aula__pie', 'Preguntas armadas por IA a partir de los temas que mandó el cole: revisalas con la carpeta.'));
    }

    function pintarComunicados(d) {
      var caja = parte('comunicados');
      caja.innerHTML = '';
      var semana = semanaIA();
      if (semana) caja.appendChild(semana);
      var lista = (d && d.comunicados) || [];
      if (!lista.length) {
        caja.appendChild(el('p', 'listas__vacio', 'Todavía no hay comunicados. Abrí Colegium en la compu con la extensión instalada.'));
        return;
      }
      lista.forEach(function (c) {
        var item = el('button', 'comunicado' + (Cole.esNuevo(c) ? ' comunicado--nuevo' : '') + (abierto === c.id ? ' comunicado--abierto' : ''));
        var cab = el('div', 'comunicado__cab');
        cab.appendChild(el('b', 'comunicado__titulo', c.titulo));
        cab.appendChild(el('span', 'comunicado__fecha', Cole.fechaCorta(c.fecha, new Date())));
        item.appendChild(cab);
        item.appendChild(el('span', 'comunicado__de', c.remitente + (c.rol ? ' · ' + c.rol : '') +
          (c.adjuntos ? ' · 📎 ' + c.adjuntos : '')));
        if (abierto === c.id) {
          var det = Cole.detalleDe(d, c.id);
          item.appendChild(el('p', 'comunicado__texto', det ? det.mensaje : c.resumen));
          if (det && det.adjuntos && det.adjuntos.length) {
            item.appendChild(el('span', 'comunicado__nota', 'Adjuntos: ' + det.adjuntos.join(', ')));
          } else if (!det && c.adjuntos) {
            item.appendChild(el('span', 'comunicado__nota', 'Para ver los adjuntos, abrilo en Colegium.'));
          }
        } else {
          item.appendChild(el('p', 'comunicado__resumen', c.resumen));
        }
        item.addEventListener('click', function () {
          abierto = abierto === c.id ? null : c.id;
          if (abierto && Cole.esNuevo(c)) {
            Cole.marcarVisto(c.id);
            pintarSinLeer(d);
            avisarCambio(d);
          }
          pintarComunicados(d);
        });
        caja.appendChild(item);
      });
    }

    function claseConcepto(ev) {
      if (Cole.esBaja(ev)) return ' nota--baja';
      if (Cole.esAlta(ev)) return ' nota--alta';
      return '';
    }

    function chipNota(ev, esFinal) {
      var chip = el('span', 'nota' + claseConcepto(ev) + (esFinal ? ' nota--final' : ''));
      chip.appendChild(el('b', null, ev.nota || ev.concepto || '–'));
      chip.appendChild(el('span', null, (esFinal ? 'Nota final' : (ev.tipo ? ev.tipo + ' · ' : '') + ev.nombre)));
      return chip;
    }

    function pintarNotas(d) {
      var caja = parte('notas');
      caja.innerHTML = '';
      var materias = Cole.resumenNotas(d, 4, new Date());
      if (!materias.length) {
        caja.appendChild(el('p', 'listas__vacio',
          'Todavía no hay notas. Entrá una vez a cada materia en Colegium (Asignaturas → la materia → Calificaciones) y después se actualizan solas.'));
        return;
      }
      var alumno = opciones.apodo || (d && d.colegio && d.colegio.alumno ? String(d.colegio.alumno).split(' ')[0] : '');
      var general = Cole.mensajeGeneral(materias, alumno, new Date());
      if (general) caja.appendChild(el('p', 'aliento aliento--' + general.tono, general.texto));
      materias.forEach(function (m) {
        var fila = el('div', 'materia' + (m.alerta ? ' materia--alerta' : ''));
        var cab = el('div', 'materia__cab');
        cab.appendChild(el('b', 'materia__nombre', m.nombre));
        cab.appendChild(el('span', 'materia__periodo', m.periodo));
        fila.appendChild(cab);
        var chips = el('div', 'materia__notas');
        if (m.final) chips.appendChild(chipNota(m.final, true));
        m.ultimas.forEach(function (ev) { chips.appendChild(chipNota(ev, false)); });
        if (!m.final && !m.ultimas.length) {
          chips.appendChild(el('span', 'cole__vacio', 'Sin notas todavía' + (m.periodo ? ' en el ' + m.periodo : '')));
        }
        fila.appendChild(chips);
        if (m.tendencia) fila.appendChild(el('p', 'materia__tendencia materia__tendencia--' + m.tendencia.estado, m.tendencia.mensaje));
        caja.appendChild(fila);
      });
    }

    function pintarClassroom() {
      var caja = parte('classroom');
      caja.innerHTML = '';
      var ahora = new Date();
      var d = aula && aula.datos;
      var n = d ? Classroom.urgentes(d, ahora) : 0;
      parte('urgentes').textContent = n;
      parte('urgentes').hidden = !n;
      if (!d) {
        caja.appendChild(el('p', 'listas__vacio', errorAula
          ? 'No se pudo leer Classroom: ' + errorAula
          : 'Classroom todavía no está conectado. Los pasos están en el README (sección Classroom).'));
        return;
      }
      var r = Classroom.resumen(d, ahora);
      var faltan = r.atrasadas.concat(r.pendientes);
      caja.appendChild(el('span', 'lbl aula__lbl', faltan.length ? 'Para entregar · ' + faltan.length : 'Para entregar'));
      if (!faltan.length) caja.appendChild(el('p', 'aula__aldia', '¡Al día! No hay nada pendiente 🙌'));
      faltan.forEach(function (t) {
        var c = Classroom.cuando(t.vence, ahora);
        var fila = el('div', 'entrega entrega--' + c.urgencia);
        var txt = el('div', 'entrega__txt');
        txt.appendChild(el('b', 'entrega__titulo', t.titulo));
        txt.appendChild(el('span', 'entrega__curso', t.curso));
        fila.appendChild(txt);
        fila.appendChild(el('span', 'entrega__cuando', c.texto));
        caja.appendChild(fila);
      });
      if (r.hechas.length) {
        caja.appendChild(el('span', 'lbl aula__lbl', 'Entregadas esta semana'));
        r.hechas.slice(0, 4).forEach(function (t) {
          var fila = el('div', 'entrega entrega--hecha');
          var txt = el('div', 'entrega__txt');
          txt.appendChild(el('b', 'entrega__titulo', '✓ ' + t.titulo));
          txt.appendChild(el('span', 'entrega__curso', t.curso + (t.estado === 'devuelta' ? ' · corregida' : '')));
          fila.appendChild(txt);
          if (t.nota !== null && t.nota !== undefined) {
            fila.appendChild(el('span', 'entrega__nota', t.nota + (t.notaMax ? '/' + t.notaMax : '')));
          }
          caja.appendChild(fila);
        });
      }
      if (r.avisos.length) {
        caja.appendChild(el('span', 'lbl aula__lbl', 'Avisos de los profes'));
        r.avisos.slice(0, 3).forEach(function (a) {
          var av = el('div', 'aviso-profe');
          av.appendChild(el('b', null, a.curso + ' · ' + Cole.fechaCorta(a.fecha, ahora)));
          av.appendChild(el('p', null, a.texto));
          caja.appendChild(av);
        });
      }
      caja.appendChild(el('p', 'aula__pie', 'Classroom actualizado ' + hace(aula.recibido) + '. Se actualiza solo cada hora.'));
    }

    function pintarPestana() {
      contenedor.querySelectorAll('[data-tab]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === pestana));
      });
      parte('comunicados').hidden = pestana !== 'comunicados';
      parte('notas').hidden = pestana !== 'notas';
      parte('classroom').hidden = pestana !== 'classroom';
      parte('repaso').hidden = pestana !== 'repaso';
      parte('titulo').textContent = { notas: 'Notas', classroom: 'Classroom', repaso: 'Repaso' }[pestana] || 'Comunicados';
      parte('sinleer').hidden = pestana !== 'comunicados';
      pintarSinLeer(respuesta && respuesta.datos);
    }

    contenedor.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { pestana = b.getAttribute('data-tab'); pintarPestana(); });
    });

    function pintarHorario(d) {
      var caja = parte('horario');
      caja.innerHTML = '';
      var h = Cole.horarioParaMostrar(d && d.horario, new Date());
      caja.appendChild(el('span', 'lbl', h ? 'Clases · ' + h.titulo : 'Clases'));
      if (!h) {
        caja.appendChild(el('p', 'cole__vacio', 'Entrá a Horario en Colegium para verlo acá.'));
        return;
      }
      h.bloques.forEach(function (b) {
        var fila = el('div', 'clase');
        fila.appendChild(el('span', 'clase__hora', b.inicio));
        fila.appendChild(el('span', 'clase__materia', b.materias.join(' / ')));
        caja.appendChild(fila);
      });
    }

    function pintarAsistencia(d) {
      var caja = parte('asistencia');
      caja.innerHTML = '';
      caja.appendChild(el('span', 'lbl', 'Asistencia'));
      var a = d && d.asistencia;
      if (!a) {
        caja.appendChild(el('p', 'cole__vacio', 'Entrá a Asistencia en Colegium para verla acá.'));
        return;
      }
      var fila = el('div', 'asis');
      fila.appendChild(el('b', null, (a.presente !== null ? numero(a.presente) : '–') + '%'));
      fila.appendChild(el('span', null, 'presente · ' + numero(a.inasistencias) + ' faltas' +
        (a.tardanzas ? ' · ' + numero(a.tardanzas) + ' tardanzas' : '')));
      caja.appendChild(fila);
      var pend = Cole.faltasPorJustificar(d);
      if (pend.length) {
        caja.appendChild(el('p', 'cole__alerta', pend.length === 1
          ? 'Falta del ' + pend[0].fecha.split('-').reverse().slice(0, 2).join('/') + ' sin justificar'
          : pend.length + ' faltas sin justificar'));
      } else if ((d.faltas || []).length) {
        caja.appendChild(el('p', 'cole__ok', 'Todas las faltas están justificadas'));
      }
    }

    function pintarArchivos(d) {
      var caja = parte('archivos');
      caja.innerHTML = '';
      var nuevos = Cole.archivosNuevos(d);
      caja.appendChild(el('span', 'lbl', 'Archivos' + (nuevos.length ? ' · ' + nuevos.length + ' sin ver' : '')));
      var lista = (d && d.archivos) || [];
      if (!d || !d.archivos) {
        caja.appendChild(el('p', 'cole__vacio', 'Entrá a Archivos en Colegium para verlos acá.'));
        return;
      }
      if (!lista.length) caja.appendChild(el('p', 'cole__vacio', 'No hay archivos compartidos.'));
      lista.slice(0, 3).forEach(function (a) {
        var fila = el('div', 'archivo' + (a.leido ? '' : ' archivo--nuevo'));
        fila.appendChild(el('span', 'archivo__nombre', a.nombre));
        fila.appendChild(el('small', null, a.autor + ' · ' + Cole.fechaCorta(a.fecha, new Date())));
        caja.appendChild(fila);
      });
    }

    function pintarSinLeer(d) {
      var n = Cole.sinLeer(d);
      parte('sinleer').textContent = n ? n + ' sin leer' : '';
      parte('vistos').hidden = !n || pestana !== 'comunicados';
    }

    parte('vistos').addEventListener('click', function () {
      var d = respuesta && respuesta.datos;
      ((d && d.comunicados) || []).forEach(function (c) { if (Cole.esNuevo(c)) Cole.marcarVisto(c.id); });
      pintarSinLeer(d);
      pintarComunicados(d);
      avisarCambio(d);
    });

    function pintar() {
      var d = respuesta && respuesta.datos;
      pintarSinLeer(d);
      parte('colegio').textContent = (d && d.colegio && d.colegio.colegio) || 'Colegio';
      if (error) {
        parte('comunicados').innerHTML = '';
        parte('comunicados').appendChild(el('p', 'listas__vacio', 'No se pudo leer lo de Colegium: ' + error));
      } else {
        pintarComunicados(d);
      }
      pintarNotas(d);
      pintarClassroom();
      pintarRepaso();
      pintarPestana();
      pintarHorario(d);
      pintarAsistencia(d);
      pintarArchivos(d);
      var pie = parte('pie');
      pie.className = 'cole__pie';
      if (d && d.sesion && d.sesion.vencida) {
        pie.className += ' cole__pie--alerta';
        pie.textContent = 'Colegium cerró la sesión: entrá de nuevo en la compu para que se siga actualizando. ' +
          'Datos de ' + hace(respuesta.recibido) + '.';
      } else {
        pie.textContent = 'Datos de Colegium ' + hace(respuesta && respuesta.recibido) +
          '. Se actualizan solos cada 30 min mientras haya una pestaña de Colegium abierta en la compu.';
      }
    }

    function cargar() {
      if (!fuente.colegium) return Promise.resolve();
      var cole = fuente.colegium().then(function (r) {
        respuesta = r;
        error = null;
      }).catch(function (err) {
        console.error(err);
        error = err.message;
      });
      var clase = (fuente.classroom ? fuente.classroom() : Promise.resolve(null)).then(function (r) {
        aula = r && r.datos ? r : null;
        errorAula = null;
      }).catch(function (err) {
        console.error(err);
        errorAula = err.message;
      });
      var asistente = (fuente.ia ? fuente.ia() : Promise.resolve(null)).then(function (r) {
        ia = r && r.datos ? r : null;
      }).catch(function (err) { console.error(err); ia = null; });
      return Promise.all([cole, clase, asistente]).then(function () {
        pintar();
        avisarCambio(respuesta && respuesta.datos);
      });
    }

    // La barra lateral suma comunicados sin leer y entregas urgentes de Classroom.
    function avisarCambio(d) {
      alCambiar(d, aula && aula.datos ? Classroom.urgentes(aula.datos, new Date()) : 0);
    }

    return { cargar: cargar, alMostrar: function () { abierto = null; cargar(); } };
  }

  root.VistaCole = { crearCole: crearCole };
})(window);
