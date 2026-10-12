/*
 * Pantalla "Avisos": mails importantes de Gmail (turnos, cole, vencimientos...).
 * Las búsquedas se editan en la hoja "Mails" de la planilla.
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
    return 'hace ' + Math.round(min / 60) + ' h';
  }

  function crearAvisos(contenedor, fuente, opciones) {
    opciones = opciones || {};
    var alCambiar = opciones.alCambiar || function () {};
    var datos = null;
    var error = null;
    var filtro = null; // categoría elegida (null = todas)

    contenedor.innerHTML =
      '<div class="cole__principal">' +
      '  <div class="listas__cab"><div><span class="lbl">Mails importantes</span><h2 class="listas__titulo">Avisos <small data-r="nuevos"></small></h2>' +
      '    <button class="cole__vistos" data-r="vistos" hidden>Marcar todos como vistos</button></div>' +
      '    <div class="seg" role="group" aria-label="Categoría" data-r="filtros"></div></div>' +
      '  <div class="comunicados" data-r="lista"></div>' +
      '</div>' +
      '<div class="cole__lado">' +
      '  <div class="box" data-r="fechas"></div>' +
      '  <p class="cole__pie" data-r="pie"></p>' +
      '</div>';

    function parte(n) { return contenedor.querySelector('[data-r="' + n + '"]'); }

    function pintarFiltros() {
      var caja = parte('filtros');
      caja.innerHTML = '';
      [null].concat(Mails.categorias(datos)).forEach(function (c) {
        var b = el('button', null, c ? c.toUpperCase() : 'TODOS');
        b.setAttribute('aria-pressed', String(c === filtro));
        b.addEventListener('click', function () { filtro = c; pintar(); });
        caja.appendChild(b);
      });
    }

    function chipCategoria(nombre) {
      var c = Mails.categoria(nombre);
      var chip = el('span', 'mail__cat', c.icono + ' ' + nombre);
      chip.style.color = c.color;
      return chip;
    }

    function pintarLista() {
      var caja = parte('lista');
      caja.innerHTML = '';
      if (error) { caja.appendChild(el('p', 'listas__vacio', 'No se pudieron leer los mails: ' + error)); return; }
      var ahora = new Date();
      var vistos = Mails.vistos();
      var nuevos = {};
      Mails.nuevos(datos, ahora, vistos).forEach(function (m) { nuevos[m.id] = true; });
      var lista = ((datos && datos.mails) || []).filter(function (m) { return !filtro || m.categoria === filtro; });
      if (!lista.length) {
        caja.appendChild(el('p', 'listas__vacio', datos ? 'No hay mails importantes de las últimas 3 semanas.' : 'Cargando…'));
        return;
      }
      lista.forEach(function (m) {
        var item = el('button', 'comunicado mail' + (nuevos[m.id] ? ' comunicado--nuevo' : ''));
        var cab = el('div', 'comunicado__cab');
        cab.appendChild(el('b', 'comunicado__titulo', m.asunto));
        cab.appendChild(el('span', 'comunicado__fecha', Cole.fechaCorta(m.recibido, ahora)));
        item.appendChild(cab);
        var de = el('span', 'comunicado__de');
        de.appendChild(chipCategoria(m.categoria));
        de.appendChild(document.createTextNode(' · ' + m.de));
        item.appendChild(de);
        if (m.resumen) item.appendChild(el('p', 'comunicado__resumen', m.resumen));
        if (m.cuando) item.appendChild(el('span', 'mail__cuando', '📅 ' + Mails.textoCuando(m.cuando, ahora)));
        item.addEventListener('click', function () {
          if (nuevos[m.id]) { Mails.marcarVistos([m.id]); pintar(); }
        });
        caja.appendChild(item);
      });
    }

    function pintarFechas() {
      var caja = parte('fechas');
      caja.innerHTML = '';
      caja.appendChild(el('span', 'lbl', 'Fechas que vienen'));
      var ahora = new Date();
      var lista = Mails.conFecha(datos, ahora);
      if (!lista.length) { caja.appendChild(el('p', 'cole__vacio', 'Ningún mail menciona fechas próximas.')); return; }
      lista.slice(0, 8).forEach(function (m) {
        var fila = el('div', 'fecha-mail');
        var punto = el('i');
        punto.style.background = Mails.categoria(m.categoria).color;
        fila.appendChild(punto);
        fila.appendChild(el('b', null, Mails.textoCuando(m.cuando, ahora)));
        fila.appendChild(el('span', null, m.asunto));
        caja.appendChild(fila);
      });
      caja.appendChild(el('p', 'mail__nota', 'También están en la agenda de Hoy.'));
    }

    function pintar() {
      var n = Mails.nuevos(datos, new Date()).length;
      parte('nuevos').textContent = n ? n + (n === 1 ? ' nuevo' : ' nuevos') : '';
      parte('vistos').hidden = !n;
      pintarFiltros();
      pintarLista();
      pintarFechas();
      parte('pie').textContent = datos
        ? 'Buscado en tu Gmail ' + hace(datos.actualizado) + '. Las búsquedas se editan en la hoja "Mails" de la planilla.'
        : '';
      alCambiar(datos);
    }

    parte('vistos').addEventListener('click', function () {
      Mails.marcarVistos(Mails.nuevos(datos, new Date()).map(function (m) { return m.id; }));
      pintar();
    });

    function cargar() {
      if (!fuente.mails) return Promise.resolve();
      return fuente.mails().then(function (d) {
        datos = d;
        error = null;
      }).catch(function (err) {
        console.error(err);
        error = err.message;
      }).then(pintar);
    }

    return { cargar: cargar, alMostrar: cargar, datos: function () { return datos; } };
  }

  root.VistaAvisos = { crearAvisos: crearAvisos };
})(window);
