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
    var abierto = null;
    var error = null;
    var pestana = 'comunicados';

    contenedor.innerHTML =
      '<div class="cole__principal">' +
      '  <div class="listas__cab"><div><span class="lbl" data-r="colegio">Colegio</span><h2 class="listas__titulo"><span data-r="titulo">Comunicados</span> <small data-r="sinleer"></small></h2></div>' +
      '    <div class="seg" role="group" aria-label="Sección"><button data-tab="comunicados" aria-pressed="true">COMUNICADOS</button><button data-tab="notas" aria-pressed="false">NOTAS</button></div></div>' +
      '  <div class="comunicados" data-r="comunicados"></div>' +
      '  <div class="notas" data-r="notas" hidden></div>' +
      '</div>' +
      '<div class="cole__lado">' +
      '  <div class="box" data-r="horario"></div>' +
      '  <div class="box" data-r="asistencia"></div>' +
      '  <div class="box" data-r="archivos"></div>' +
      '  <p class="cole__pie" data-r="pie"></p>' +
      '</div>';

    function parte(n) { return contenedor.querySelector('[data-r="' + n + '"]'); }

    function pintarComunicados(d) {
      var caja = parte('comunicados');
      caja.innerHTML = '';
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
            alCambiar(d);
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
      var alumno = d && d.colegio && d.colegio.alumno ? String(d.colegio.alumno).split(' ')[0] : '';
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

    function pintarPestana() {
      contenedor.querySelectorAll('[data-tab]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === pestana));
      });
      parte('comunicados').hidden = pestana !== 'comunicados';
      parte('notas').hidden = pestana !== 'notas';
      parte('titulo').textContent = pestana === 'notas' ? 'Notas' : 'Comunicados';
      parte('sinleer').hidden = pestana !== 'comunicados';
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
    }

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
      return fuente.colegium().then(function (r) {
        respuesta = r;
        error = null;
      }).catch(function (err) {
        console.error(err);
        error = err.message;
      }).then(function () {
        pintar();
        alCambiar(respuesta && respuesta.datos);
      });
    }

    return { cargar: cargar, alMostrar: function () { abierto = null; cargar(); } };
  }

  root.VistaCole = { crearCole: crearCole };
})(window);
