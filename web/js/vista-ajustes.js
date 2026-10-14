/*
 * Pantalla "Ajustes" (⚙️ en la barra lateral, o tocando la hora). Todo con botones
 * − / + e interruptores: el marco no tiene teclado.
 */
(function (root) {
  'use strict';

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  var NOMBRES_OPCION = { apagado: 'Negra', tenue: 'Tenue' };

  /*
   * Qué se muestra, en grupos. `si` (opcional): la fila solo se ve si ese interruptor
   * está prendido. `formato`: cómo se muestra el número.
   */
  var GRUPOS = [
    { titulo: 'Fotos', filas: [
      { clave: 'segundosFoto', texto: 'Cada foto se ve', formato: function (v) { return v + ' s'; } },
      { clave: 'videos', texto: 'Mostrar videos', detalle: 'Los de Drive, sin sonido' },
      { clave: 'lugarFoto', texto: 'Mostrar dónde se sacó', detalle: 'Al lado de la fecha, si la foto tiene ubicación' },
      { accion: 'fotosNuevas', texto: 'Buscar fotos nuevas ahora', detalle: 'Solas aparecen en menos de una hora (también las de subcarpetas)' }
    ] },
    { titulo: 'Panel y fotos', filas: [
      { clave: 'minutosInactividad', texto: 'Sin tocar, pasa a fotos a los', formato: function (v) { return v + ' min'; } },
      { clave: 'alternar', texto: 'Mostrar el panel cada tanto', detalle: 'Mientras están las fotos, el panel aparece un rato y vuelve' },
      { clave: 'alternarCada', si: 'alternar', texto: 'Aparece cada', formato: function (v) { return v + ' min'; } },
      { clave: 'alternarSegundos', si: 'alternar', texto: 'El panel queda', formato: function (v) { return v + ' s'; } }
    ] },
    { titulo: 'Mañana de cole', filas: [
      { clave: 'mananaCole', texto: 'Mostrar la mañana de cole', detalle: 'Días de clase: tareas de la mañana, hora de salir, materias y qué llevar' },
      { clave: 'mananaDesde', si: 'mananaCole', texto: 'Desde las' },
      { clave: 'viajeMinutos', si: 'mananaCole', texto: 'El viaje al cole tarda', formato: function (v) { return v + ' min'; } },
      { clave: 'salidaPorDefecto', si: 'mananaCole', texto: 'Salir a las (si no hay horario)' }
    ] },
    { titulo: 'Sensor de movimiento', filas: [
      { clave: 'sensor', texto: 'Usar el sensor', detalle: 'Si no pasa nadie, la pantalla descansa; vuelve sola al pasar' },
      { clave: 'sinMovimientoMinutos', si: 'sensor', texto: 'Sin nadie, descansa a los', formato: function (v) { return v + ' min'; } },
      { clave: 'sinMovimientoModo', si: 'sensor', texto: 'Al descansar, la pantalla queda' }
    ] },
    { titulo: 'Noche', filas: [
      { clave: 'oscuro', texto: 'Colores oscuros de noche', detalle: 'No encandila en la cocina a oscuras' },
      { clave: 'oscuroDesde', si: 'oscuro', texto: 'Desde las' },
      { clave: 'oscuroHasta', si: 'oscuro', texto: 'Hasta las' },
      { clave: 'noche', texto: 'Descanso nocturno', detalle: 'Un toque la despierta' },
      { clave: 'nocheDesde', si: 'noche', texto: 'Desde las' },
      { clave: 'nocheHasta', si: 'noche', texto: 'Hasta las' },
      { clave: 'nocheModo', si: 'noche', texto: 'La pantalla queda' },
      { clave: 'despiertoMinutos', si: 'noche', texto: 'Al tocarla, despierta', formato: function (v) { return v + ' min'; } }
    ] }
  ];

  function crearAjustes(contenedor, ajustes, opciones) {
    opciones = opciones || {};

    function interruptor(clave) {
      var l = el('label', 'interruptor');
      var i = el('input');
      i.type = 'checkbox';
      i.checked = !!ajustes.valor(clave);
      i.addEventListener('change', function () { ajustes.poner(clave, i.checked); pintar(); });
      l.appendChild(i);
      l.appendChild(el('span'));
      return l;
    }

    function pasos(fila, d) {
      var caja = el('div', 'pasos');
      var menos = el('button', 'pasos__btn', '−');
      var valor = el('b', 'pasos__valor');
      var mas = el('button', 'pasos__btn', '+');
      function mostrar() {
        var v = ajustes.valor(fila.clave);
        valor.textContent = d.tipo === 'opcion' ? (NOMBRES_OPCION[v] || v) : fila.formato ? fila.formato(v) : v;
      }
      menos.addEventListener('click', function () { ajustes.pasar(fila.clave, -1); mostrar(); });
      mas.addEventListener('click', function () { ajustes.pasar(fila.clave, 1); mostrar(); });
      mostrar();
      caja.appendChild(menos); caja.appendChild(valor); caja.appendChild(mas);
      return caja;
    }

    function pintar() {
      contenedor.innerHTML = '';
      var cab = el('div', 'listas__cab');
      var t = el('div');
      t.appendChild(el('span', 'lbl', 'Este aparato'));
      t.appendChild(el('h2', 'listas__titulo', 'Ajustes'));
      cab.appendChild(t);
      var restablecer = el('button', 'cole__vistos', 'Volver a los valores de fábrica');
      restablecer.addEventListener('click', function () { ajustes.restablecer(); pintar(); });
      cab.appendChild(restablecer);
      contenedor.appendChild(cab);

      var grilla = el('div', 'ajustes__grilla');
      GRUPOS.forEach(function (g) {
        var caja = el('section', 'box ajustes__grupo');
        caja.appendChild(el('span', 'lbl', g.titulo));
        g.filas.forEach(function (fila) {
          if (fila.si && !ajustes.valor(fila.si)) return;
          var f = el('div', 'ajuste' + (fila.si ? ' ajuste--sub' : ''));
          var txt = el('div', 'ajuste__txt');
          txt.appendChild(el('span', null, fila.texto));
          if (fila.detalle) txt.appendChild(el('small', null, fila.detalle));
          f.appendChild(txt);
          if (fila.accion) {
            var b = el('button', 'ajuste__accion', 'Buscar');
            b.addEventListener('click', function () {
              b.disabled = true;
              b.textContent = 'Buscando…';
              Promise.resolve(opciones.acciones && opciones.acciones[fila.accion] && opciones.acciones[fila.accion]())
                .then(function (texto) { b.textContent = texto || 'Listo'; })
                .catch(function (err) { b.textContent = 'No se pudo'; console.error(err); })
                .then(function () { setTimeout(function () { b.disabled = false; b.textContent = 'Buscar'; }, 6000); });
            });
            f.appendChild(b);
          } else {
            var d = ajustes.definicion[fila.clave];
            f.appendChild(d.tipo === 'si' ? interruptor(fila.clave) : pasos(fila, d));
          }
          caja.appendChild(f);
        });
        grilla.appendChild(caja);
      });
      contenedor.appendChild(grilla);
      contenedor.appendChild(el('p', 'cole__pie', 'Los cambios se guardan solos y valen para este aparato (el marco o la compu). ' +
        (opciones.info ? opciones.info() : '')));
    }

    return { alMostrar: pintar };
  }

  root.VistaAjustes = { crearAjustes: crearAjustes };
})(window);
