/*
 * Pantalla "Agentes": qué hace el panel solo y el registro de lo que hizo.
 */
(function (root) {
  'use strict';

  var ICONOS = { mails: '✉️', classroom: '📚', colegio: '🎒', 'básquet': '🏀', basquet: '🏀', calendario: '📅' };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function hace(iso) {
    if (!iso) return 'nunca';
    var min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return 'recién';
    if (min < 60) return 'hace ' + min + ' min';
    if (min < 1440) return 'hace ' + Math.round(min / 60) + ' h';
    return 'hace ' + Math.round(min / 1440) + ' d';
  }

  /* "Hoy", "Ayer" o "12 oct", para agrupar el registro por día. */
  function dia(iso, ahora) {
    var d = new Date(iso);
    var a = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dias = Math.round((a - x) / 86400000);
    return dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : d.getDate() + ' ' + MESES[d.getMonth()];
  }

  function crearAgentes(contenedor, fuente) {
    var datos = null;
    var error = null;

    contenedor.innerHTML =
      '<div class="cole__principal">' +
      '  <div class="listas__cab"><div><span class="lbl">Lo que el panel hace solo</span><h2 class="listas__titulo">Agentes</h2></div></div>' +
      '  <div class="registro" data-r="registro"></div>' +
      '</div>' +
      '<div class="cole__lado" data-r="lado"></div>';

    function parte(n) { return contenedor.querySelector('[data-r="' + n + '"]'); }

    function tarjeta(icono, titulo, texto, estado, apagado) {
      var c = el('div', 'box agente' + (apagado ? ' agente--apagado' : ''));
      var cab = el('div', 'agente__cab');
      cab.appendChild(el('span', 'agente__icono', icono));
      cab.appendChild(el('b', null, titulo));
      c.appendChild(cab);
      c.appendChild(el('p', 'agente__texto', texto));
      if (estado) c.appendChild(el('small', 'agente__estado', estado));
      return c;
    }

    function pintar() {
      var lista = parte('registro');
      lista.innerHTML = '';
      if (error) {
        lista.appendChild(el('p', 'listas__vacio', 'No se pudo leer el registro: ' + error));
      } else if (!datos || !datos.registro.length) {
        lista.appendChild(el('p', 'listas__vacio', datos
          ? 'Todavía no hay nada en el registro. Ejecutá activarAgentes en el Apps Script.'
          : 'Cargando…'));
      } else {
        var ahora = new Date();
        var ultimoDia = null;
        datos.registro.forEach(function (r) {
          var d = dia(r.fecha, ahora);
          if (d !== ultimoDia) { lista.appendChild(el('span', 'lbl registro__dia', d)); ultimoDia = d; }
          var fila = el('div', 'registro__fila');
          var f = new Date(r.fecha);
          fila.appendChild(el('span', 'registro__hora', pad(f.getHours()) + ':' + pad(f.getMinutes())));
          fila.appendChild(el('span', 'registro__icono', ICONOS[String(r.agente).toLowerCase()] || '🤖'));
          fila.appendChild(el('span', 'registro__texto', r.texto));
          lista.appendChild(fila);
        });
      }

      var lado = parte('lado');
      lado.innerHTML = '';
      var activo = datos && datos.calendario;
      lado.appendChild(tarjeta('📅', 'Calendario automático',
        'Pasa a "Familia · automático" los turnos y vencimientos de los mails, las entregas de Classroom y los eventos del cole. Te llegan al celular con los avisos de Google Calendar.',
        activo ? 'Revisa cada hora · última vez ' + hace(datos.ultimaCorrida) : 'Sin activar: ejecutá activarAgentes en el Apps Script',
        !activo));
      lado.appendChild(tarjeta('🏀', 'Básquet', 'Copia los partidos de Thi al calendario "Básquet Thiago" y los actualiza si cambian.', 'Revisa cada 3 horas'));
      var ia = datos && datos.ia;
      lado.appendChild(tarjeta('✨', 'Asistente con IA',
        'Lee los comunicados y Classroom, resume la semana, arma la lista de pendientes, pasa las fechas al calendario y prepara repasos para las pruebas de Thi (Cole → Repaso).',
        ia ? 'Todos los días a las 6 · última vez ' + hace(ia.generado) : 'Sin activar: falta la clave de Gemini (ver README)',
        !ia));
    }

    function cargar() {
      if (!fuente.agentes) return Promise.resolve();
      return fuente.agentes().then(function (d) { datos = d; error = null; })
        .catch(function (err) { console.error(err); error = err.message; })
        .then(pintar);
    }

    return { cargar: cargar, alMostrar: cargar };
  }

  root.VistaAgentes = { crearAgentes: crearAgentes };
})(window);
