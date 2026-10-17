/*
 * Motor de diseño de diapositivas.
 *
 * Recibe la lista de fotos (con ancho, alto y fecha) y decide cómo mostrarlas:
 *   - horizontal          → "completa"  (pantalla completa)
 *   - panorámica          → "centrada"  (entera, con fondo desenfocado)
 *   - cuadrada            → "centrada"
 *   - verticales seguidas → "par" o "triptico", priorizando fotos del mismo día
 *   - vertical suelta     → se empareja con otra suelta; si no hay, "centrada"
 *   - video               → "video" (solo, entero, con fondo desenfocado)
 *
 * Es una función pura (sin DOM) para poder probarla con `node --test`.
 * Se carga como script clásico (Chrome 106 del marco) y también como módulo de Node.
 */
(function (root) {
  'use strict';

  var HORIZONTAL = 1.15;   // ancho/alto desde el que una foto es horizontal
  var VERTICAL = 0.87;     // ancho/alto hasta el que una foto es vertical
  var PANORAMICA = 2.2;    // más ancha que esto no se recorta: va centrada
  var HOLGURA_TRIPTICO = 1.12; // cuánto recorte se tolera para meter 3 verticales

  function proporcion(foto) {
    return foto.ancho / foto.alto;
  }

  function orientacion(foto) {
    var r = proporcion(foto);
    if (r >= PANORAMICA) return 'panoramica';
    if (r >= HORIZONTAL) return 'horizontal';
    if (r <= VERTICAL) return 'vertical';
    return 'cuadrada';
  }

  function dia(foto) {
    return foto.fecha ? String(foto.fecha).slice(0, 10) : null;
  }

  function porFecha(a, b) {
    var fa = a.fecha || '', fb = b.fecha || '';
    if (fa < fb) return -1;
    if (fa > fb) return 1;
    return 0;
  }

  /*
   * Parte un grupo de verticales del mismo día en tripticos y pares.
   * Devuelve { diapositivas, suelta } donde `suelta` es una vertical que sobró.
   */
  function agruparVerticales(grupo, proporcionPantalla) {
    var diapositivas = [];
    var i = 0;
    while (i < grupo.length) {
      var quedan = grupo.length - i;
      if (quedan >= 3 && quedan !== 4) {
        var tres = grupo.slice(i, i + 3);
        var anchoTotal = tres.reduce(function (s, f) { return s + proporcion(f); }, 0);
        if (anchoTotal <= proporcionPantalla * HOLGURA_TRIPTICO) {
          diapositivas.push({ tipo: 'triptico', fotos: tres });
          i += 3;
          continue;
        }
      }
      if (quedan >= 2) {
        diapositivas.push({ tipo: 'par', fotos: grupo.slice(i, i + 2) });
        i += 2;
        continue;
      }
      return { diapositivas: diapositivas, suelta: grupo[i] };
    }
    return { diapositivas: diapositivas, suelta: null };
  }

  function armarDiapositivas(fotos, opciones) {
    opciones = opciones || {};
    var proporcionPantalla = opciones.proporcionPantalla || 1.6;

    var ordenadas = fotos.slice().sort(porFecha);
    var diapositivas = [];
    var sueltas = [];
    var grupo = [];

    function cerrarGrupo() {
      if (!grupo.length) return;
      var r = agruparVerticales(grupo, proporcionPantalla);
      diapositivas = diapositivas.concat(r.diapositivas);
      if (r.suelta) sueltas.push(r.suelta);
      grupo = [];
    }

    ordenadas.forEach(function (foto) {
      if (foto.video) {
        if (opciones.sinVideos) return;
        diapositivas.push({ tipo: 'video', fotos: [foto] });
        return;
      }
      var o = orientacion(foto);
      if (o === 'vertical') {
        if (grupo.length && dia(grupo[0]) !== dia(foto)) cerrarGrupo();
        grupo.push(foto);
        return;
      }
      cerrarGrupo();
      diapositivas.push({ tipo: o === 'horizontal' ? 'completa' : 'centrada', fotos: [foto] });
    });
    cerrarGrupo();

    // Las verticales que quedaron solas se emparejan entre sí aunque sean de días distintos.
    for (var i = 0; i + 1 < sueltas.length; i += 2) {
      diapositivas.push({ tipo: 'par', fotos: [sueltas[i], sueltas[i + 1]] });
    }
    if (sueltas.length % 2 === 1) {
      diapositivas.push({ tipo: 'centrada', fotos: [sueltas[sueltas.length - 1]] });
    }
    return diapositivas;
  }

  /*
   * Años desde que se sacó la foto, si fue "un día como hoy" (mismo día y mes,
   * otro año). Si no, null.
   */
  function haceAnios(foto, hoy) {
    var d = dia(foto);
    if (!d) return null;
    var anio = Number(d.slice(0, 4));
    var mesDia = d.slice(5, 10);
    var hoyMesDia = pad(hoy.getMonth() + 1) + '-' + pad(hoy.getDate());
    var anios = hoy.getFullYear() - anio;
    return mesDia === hoyMesDia && anios > 0 ? anios : null;
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // Generador pseudoaleatorio con semilla, para que los tests sean repetibles.
  function aleatorio(semilla) {
    var s = semilla >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /*
   * Ordena la secuencia: primero los recuerdos de "un día como hoy" (los más
   * viejos primero) y después el resto mezclado.
   */
  function ordenar(diapositivas, hoy, azar) {
    azar = azar || Math.random;
    var recuerdos = [];
    var resto = [];
    diapositivas.forEach(function (d) {
      var anios = null;
      d.fotos.forEach(function (f) {
        var a = haceAnios(f, hoy);
        if (a !== null && (anios === null || a > anios)) anios = a;
      });
      var conDato = Object.assign({}, d, { haceAnios: anios });
      (anios !== null ? recuerdos : resto).push(conDato);
    });
    recuerdos.sort(function (a, b) { return b.haceAnios - a.haceAnios; });
    for (var i = resto.length - 1; i > 0; i--) {
      var j = Math.floor(azar() * (i + 1));
      var t = resto[i]; resto[i] = resto[j]; resto[j] = t;
    }
    return recuerdos.concat(resto);
  }

  /*
   * Primero lo que no se vio (o se vio hace más tiempo), así no se repiten las mismas cada vez
   * que se recarga la lista o la página. vistas: { idFoto: cuándo se mostró (ms) }.
   * Los recuerdos ("un día como hoy") van primero una vez por día. Respeta el orden que ya
   * traía la secuencia entre las que empatan (el azar de ordenar).
   */
  function priorizarNoVistas(secuencia, vistas, hoy) {
    vistas = vistas || {};
    var inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    return secuencia.map(function (d, i) {
      var clave = 0;
      d.fotos.forEach(function (f) { clave = Math.max(clave, Number(vistas[f.id]) || 0); });
      if (d.haceAnios && clave < inicioHoy) clave = 0;
      return { d: d, clave: clave, i: i };
    }).sort(function (a, b) { return a.clave - b.clave || a.i - b.i; }).map(function (x) { return x.d; });
  }

  var api = {
    priorizarNoVistas: priorizarNoVistas,
    orientacion: orientacion,
    armarDiapositivas: armarDiapositivas,
    haceAnios: haceAnios,
    ordenar: ordenar,
    aleatorio: aleatorio
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Layout = api;
})(typeof window !== 'undefined' ? window : this);
