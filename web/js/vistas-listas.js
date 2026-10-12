/*
 * Vistas de Tareas y Compras.
 *
 * Los cambios se ven al instante en la pantalla y se mandan a la planilla
 * en segundo plano; si fallan, se vuelve atrás y se avisa.
 */
(function (root) {
  'use strict';

  var COLORES = ['#2f5fd0', '#d39b1e', '#c2306b', '#2e7d4f', '#6b4fbf', '#0f7c86'];
  var TILDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  /* Datos compartidos por las vistas y la barra lateral. */
  function crearListas(fuente, opciones) {
    opciones = opciones || {};
    var datos = null;
    var oyentes = [];
    var avisar = opciones.avisar || function () {};

    function publicar(d) {
      datos = d;
      oyentes.forEach(function (f) { f(d); });
    }

    // Aplica el cambio en pantalla ya mismo y después lo confirma con la planilla.
    function cambiar(local, remoto, textoError) {
      if (!datos) return Promise.resolve();
      var antes = copia(datos);
      var nuevo = copia(datos);
      local(nuevo);
      publicar(nuevo);
      return remoto().then(publicar).catch(function (err) {
        console.error(err);
        publicar(antes);
        avisar((textoError || 'No se pudo guardar') + ': ' + err.message);
      });
    }

    return {
      alCambiar: function (f) { oyentes.push(f); if (datos) f(datos); },
      datos: function () { return datos; },
      cargar: function () {
        if (!fuente.listas) return Promise.resolve();
        return fuente.listas().then(publicar).catch(function (err) {
          console.error(err);
          if (!datos) publicar({ compras: [], habituales: [], tareas: [], estrellas: {}, error: err.message });
        });
      },
      marcarCompra: function (id, comprado) {
        return cambiar(function (d) {
          d.compras.forEach(function (c) { if (c.id === id) c.comprado = comprado; });
        }, function () { return fuente.compra('marcar', { id: id, valor: comprado ? '1' : '0' }); });
      },
      cantidad: function (id, cantidad) {
        cantidad = Math.max(1, cantidad);
        return cambiar(function (d) {
          d.compras.forEach(function (c) { if (c.id === id) c.cantidad = cantidad; });
        }, function () { return fuente.compra('cantidad', { id: id, cantidad: cantidad }); });
      },
      agregar: function (item, categoria) {
        item = String(item || '').trim();
        if (!item) return Promise.resolve();
        return cambiar(function (d) {
          var ya = d.compras.filter(function (c) {
            return !c.comprado && c.item.toLowerCase() === item.toLowerCase();
          })[0];
          if (ya) ya.cantidad += 1;
          else d.compras.push({ id: 'nuevo-' + Date.now(), item: item, cantidad: 1,
            categoria: categoria || 'Otros', comprado: false });
        }, function () {
          var datosPedido = { item: item, cantidad: 1 };
          if (categoria) datosPedido.categoria = categoria;
          return fuente.compra('agregar', datosPedido);
        }, 'No se pudo agregar');
      },
      marcarTarea: function (id, hecha) {
        return cambiar(function (d) {
          d.tareas.forEach(function (t) {
            if (t.id !== id || t.hecha === hecha) return;
            t.hecha = hecha;
            d.estrellas[t.persona] = (d.estrellas[t.persona] || 0) + (hecha ? t.estrellas : -t.estrellas);
          });
        }, function () { return fuente.tarea('marcar', { id: id, valor: hecha ? '1' : '0' }); });
      }
    };
  }

  function colorDe(persona, colores, orden) {
    if (colores && colores[persona]) return colores[persona];
    if (/^cualquiera$/i.test(persona)) return '#141414';
    var i = orden.indexOf(persona);
    if (i < 0) { orden.push(persona); i = orden.length - 1; }
    return COLORES[i % COLORES.length];
  }

  function crearTareas(contenedor, listas, opciones) {
    opciones = opciones || {};
    var colores = opciones.colores || {};
    var ordenColores = [];
    var momento = Listas.momentoActual(new Date());

    contenedor.innerHTML =
      '<div class="listas__cab"><div><span class="lbl">Tareas de hoy</span><h2 class="listas__titulo"></h2></div>' +
      '<div class="seg" role="group" aria-label="Momento del día"></div></div>' +
      '<div class="personas"></div>';
    var titulo = contenedor.querySelector('.listas__titulo');
    var seg = contenedor.querySelector('.seg');
    var cuerpo = contenedor.querySelector('.personas');

    Listas.MOMENTOS.forEach(function (m) {
      var b = el('button', null, m.toUpperCase());
      b.addEventListener('click', function () { momento = m; pintar(listas.datos()); });
      b.setAttribute('data-momento', m);
      seg.appendChild(b);
    });

    function pintar(d) {
      if (!d) return;
      titulo.textContent = momento === 'Mañana' ? 'A la mañana' : momento === 'Tarde' ? 'A la tarde' : 'A la noche';
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-momento') === momento));
      });
      cuerpo.innerHTML = '';
      if (d.error) {
        cuerpo.appendChild(el('p', 'listas__vacio', 'No se pudieron leer las tareas: ' + d.error));
        return;
      }
      var cols = Listas.columnasDeTareas(d.tareas, new Date(), momento);
      if (!cols.length) {
        cuerpo.appendChild(el('p', 'listas__vacio', 'No hay tareas para este momento.'));
        return;
      }
      cuerpo.style.gridTemplateColumns = 'repeat(' + Math.max(3, cols.length) + ', 1fr)';
      cols.forEach(function (c) {
        var color = colorDe(c.persona, colores, ordenColores);
        var col = el('section', 'persona');
        col.style.setProperty('--c', color);
        var cab = el('header');
        cab.style.background = color;
        var av = el('span', 'persona__av', c.persona.charAt(0).toUpperCase());
        av.style.color = color;
        cab.appendChild(av);
        var nombre = el('div');
        nombre.appendChild(el('b', null, c.persona));
        var estrellas = d.estrellas && d.estrellas[c.persona];
        nombre.appendChild(el('small', null, c.hechas + ' de ' + c.total +
          (estrellas ? ' · ★ ' + estrellas + ' esta semana' : '')));
        cab.appendChild(nombre);
        col.appendChild(cab);

        var items = el('div', 'persona__items');
        c.tareas.forEach(function (t) {
          var b = el('button', 'tarea' + (t.hecha ? ' tarea--hecha' : ''));
          b.innerHTML = '<span class="caja">' + TILDE + '</span><span class="tarea__txt"></span>';
          b.querySelector('.tarea__txt').textContent = t.tarea;
          if (t.estrellas) b.querySelector('.tarea__txt').appendChild(el('small', null, '★ ' + t.estrellas));
          b.addEventListener('click', function () { listas.marcarTarea(t.id, !t.hecha); });
          items.appendChild(b);
        });
        col.appendChild(items);
        if (c.hechas === c.total) col.appendChild(el('p', 'persona__listo', '¡Listo!'));
        cuerpo.appendChild(col);
      });
    }

    listas.alCambiar(pintar);
    return {
      alMostrar: function () { momento = Listas.momentoActual(new Date()); pintar(listas.datos()); }
    };
  }

  function crearCompras(contenedor, listas, opciones) {
    opciones = opciones || {};
    var avisar = opciones.avisar || function () {};

    contenedor.innerHTML =
      '<div class="compras__lista"><span class="lbl">Lista compartida</span>' +
      '<h2 class="listas__titulo">Compras <small></small></h2><div class="compras__grupos"></div></div>' +
      '<div class="compras__lado">' +
      '<form class="agregar"><input id="nuevo-item" autocomplete="off" placeholder="+ Agregar algo…" aria-label="Agregar a la lista">' +
      '<button type="submit">Agregar</button></form>' +
      '<span class="lbl">Habituales · tocá para sumar</span><div class="habituales"></div></div>';
    var contador = contenedor.querySelector('h2 small');
    var grupos = contenedor.querySelector('.compras__grupos');
    var habituales = contenedor.querySelector('.habituales');
    var form = contenedor.querySelector('.agregar');
    var input = contenedor.querySelector('#nuevo-item');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var texto = input.value;
      input.value = '';
      input.blur();
      listas.agregar(texto);
    });

    function pintar(d) {
      if (!d) return;
      var pend = Listas.pendientes(d.compras).length;
      contador.textContent = pend + (pend === 1 ? ' para comprar' : ' para comprar');
      grupos.innerHTML = '';
      if (d.error) {
        grupos.appendChild(el('p', 'listas__vacio', 'No se pudo leer la lista: ' + d.error));
      } else if (!d.compras.length) {
        grupos.appendChild(el('p', 'listas__vacio', 'La lista está vacía.'));
      }
      Listas.comprasPorCategoria(d.compras).forEach(function (g) {
        grupos.appendChild(el('div', 'categoria lbl', g.categoria));
        g.items.forEach(function (c) {
          var fila = el('div', 'fila' + (c.comprado ? ' fila--hecha' : ''));
          var marcar = el('button', 'fila__marcar');
          marcar.innerHTML = '<span class="caja">' + TILDE + '</span><span class="fila__item"></span>';
          marcar.querySelector('.fila__item').textContent = c.item;
          marcar.addEventListener('click', function () {
            listas.marcarCompra(c.id, !c.comprado);
            if (!c.comprado) {
              avisar('✓ ' + c.item + ' tachado', function () { listas.marcarCompra(c.id, false); });
            }
          });
          fila.appendChild(marcar);
          var cant = el('div', 'cantidad');
          var menos = el('button', null, '−');
          menos.setAttribute('aria-label', 'Uno menos de ' + c.item);
          menos.disabled = c.cantidad <= 1 || c.comprado;
          menos.addEventListener('click', function () { listas.cantidad(c.id, c.cantidad - 1); });
          var mas = el('button', null, '+');
          mas.setAttribute('aria-label', 'Uno más de ' + c.item);
          mas.disabled = c.comprado;
          mas.addEventListener('click', function () { listas.cantidad(c.id, c.cantidad + 1); });
          cant.appendChild(menos);
          cant.appendChild(el('b', null, String(c.cantidad)));
          cant.appendChild(mas);
          fila.appendChild(cant);
          grupos.appendChild(fila);
        });
      });

      habituales.innerHTML = '';
      Listas.habitualesConEstado(d.habituales || [], d.compras).forEach(function (h) {
        var b = el('button', 'habitual' + (h.enLista ? ' habitual--en-lista' : ''));
        b.appendChild(el('b', null, h.item));
        b.appendChild(el('small', null, h.enLista ? '✓ en la lista' + (h.cantidad > 1 ? ' ×' + h.cantidad : '') : h.categoria));
        b.addEventListener('click', function () { listas.agregar(h.item, h.categoria); });
        habituales.appendChild(b);
      });
    }

    listas.alCambiar(pintar);
    return { alMostrar: function () { pintar(listas.datos()); } };
  }

  root.VistasListas = { crearListas: crearListas, crearTareas: crearTareas, crearCompras: crearCompras };
})(window);
