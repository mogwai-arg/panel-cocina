/*
 * Reconoce las respuestas de Colegium que nos interesan y se queda solo con lo útil.
 * Se usa dentro de la página (extensión) y en los tests.
 */
(function (root) {
  'use strict';

  var TIPOS = [
    { tipo: 'comunicados', patron: /\/comunicados\/v2\/\d+\/v2\/recibidos\// },
    { tipo: 'comunicado', patron: /\/comunicados\/v2\/\d+\/\d+\/leer$/ },
    { tipo: 'horario', patron: /\/horarios\/estudiante\/[^/]+\/semana$/ },
    { tipo: 'asistencia', patron: /\/asistencia\/estudiante\/[^/]+$/ },
    { tipo: 'faltas', patron: /\/asistencia\/estudiante\/[^/]+\/lista$/ },
    { tipo: 'eventos', patron: /\/familias\/\d+\/eventos$/ },
    { tipo: 'archivos', patron: /\/familias\/\d+\/archivos$/ },
    { tipo: 'colegio', patron: /\/api\/usuario\/rol\/\d+\/info$/ },
    { tipo: 'calificaciones', patron: /\/alumno\/obtenerDetalleCalificaciones$/, metodo: 'POST' },
    { tipo: 'tiny', patron: /\/api\/generico\/tiny\/\d+$/ }
  ];

  function reconocer(ruta, metodo) {
    metodo = metodo || 'GET';
    for (var i = 0; i < TIPOS.length; i++) {
      if (TIPOS[i].patron.test(ruta) && (TIPOS[i].metodo || 'GET') === metodo) return TIPOS[i].tipo;
    }
    return null;
  }

  /* Cuerpo de un pedido (JSON o formulario) → objeto. */
  function leerCuerpo(cuerpo) {
    if (!cuerpo) return {};
    if (typeof cuerpo === 'object' && !(typeof URLSearchParams !== 'undefined' && cuerpo instanceof URLSearchParams)) return cuerpo;
    var s = String(cuerpo);
    try { return JSON.parse(s); } catch (e) { /* no es JSON */ }
    var o = {};
    s.split('&').forEach(function (par) {
      var i = par.indexOf('=');
      if (i > 0) o[decodeURIComponent(par.slice(0, i).replace(/\+/g, ' '))] = decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
    });
    return o;
  }

  /* Ids de un objeto (campos "id" o "..._id") para cruzar materias entre secciones. */
  function idsDe(o) {
    var r = [];
    if (!o || typeof o !== 'object') return r;
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (/(^id$|_id$|^rel_?id$)/i.test(k) && (typeof v === 'string' || typeof v === 'number') && String(v)) r.push(String(v));
    });
    return r;
  }

  function texto(html, max) {
    var t = String(html || '')
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    return max && t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  /* Fecha de Colegium (segundos Unix en texto) → ISO. */
  function fechaUnix(s) {
    var n = Number(s);
    return n ? new Date(n * 1000).toISOString() : null;
  }

  function nombreMateria(a) {
    if (!a) return '';
    if (typeof a === 'string') return a;
    return a.nombre || a.asignatura || a.nombre_asignatura || a.materia || a.descripcion || a.titulo || '';
  }

  var NORMALIZAR = {
    comunicados: function (r) {
      return (r.recibidos || []).map(function (c) {
        return {
          id: String(c.comunicado_id || c.id),
          titulo: texto(c.titulo, 140),
          remitente: c.remitente || '',
          rol: c.rolRemitenteLabel || '',
          fecha: fechaUnix(c.fecha),
          // La lista ya trae el texto del mensaje: se guarda entero (hasta 4000 caracteres)
          // para poder leerlo en el panel sin abrirlo en Colegium.
          resumen: texto(c.mensaje, 4000),
          leido: String(c.is_leido) === '1',
          destacado: String(c.is_destacado || c.destacado) === '1',
          adjuntos: Number(c.cantidadAdjuntos) || 0
        };
      });
    },
    comunicado: function (r) {
      var n = r.notificacion || {};
      return {
        id: String(n.id),
        titulo: texto(n.titulo, 140),
        mensaje: texto(n.mensaje, 3000),
        adjuntos: (n.adjuntos || []).map(function (a) { return a.nombre; })
      };
    },
    horario: function (r) {
      var dias = (r.result && r.result.dias) || {};
      // _indice: id de materia → nombre, para ponerle nombre a las calificaciones.
      var out = { _indice: {} };
      Object.keys(dias).forEach(function (d) {
        out[d] = dias[d].map(function (b) {
          (b.asignaturas || []).forEach(function (a) {
            var n = nombreMateria(a);
            if (n) idsDe(a).forEach(function (id) { out._indice[id] = n; });
          });
          return {
            inicio: b.inicio,
            fin: b.fin,
            modulo: b.modulo || '',
            materias: (b.asignaturas || []).map(nombreMateria).filter(Boolean)
          };
        });
      });
      return out;
    },
    calificaciones: function (r, extra) {
      var cuerpo = leerCuerpo(extra && extra.cuerpo);
      var periodos = (r.data && r.data.calificacionPeriodos) || {};
      var materiaId = null;
      var lista = [];
      Object.keys(periodos).forEach(function (clave) {
        var instancias = periodos[clave];
        if (clave.charAt(0) === '_' || !Array.isArray(instancias)) return;
        var periodo = { id: clave, nombre: '', final: null, evaluaciones: [] };
        instancias.forEach(function (inst) {
          periodo.nombre = periodo.nombre || inst.periodo_nombre || '';
          (inst.notasInscriptos || []).forEach(function (ni) {
            var notas = ni.notasEvaluaciones || {};
            Object.keys(notas).forEach(function (k) {
              var n = notas[k];
              materiaId = materiaId || n.materia_id || null;
              var nota = [n.nota_publicada, n.nota_oficial, n.nota_capturada, n.nota_promeditable]
                .filter(function (x) { return x !== null && x !== undefined && String(x).trim() !== ''; })[0];
              var ev = {
                nombre: texto(n.nombre, 80),
                tipo: n.abreviatura || '',
                nota: nota !== undefined ? String(nota) : '',
                concepto: texto(n.observaciones, 40),
                fecha: fechaUnix(n.updated_at)
              };
              if (!ev.nota && !ev.concepto) return;
              // La raíz (sin padre) es la nota final del período.
              if (String(n.tipo) === '0' || n.parent_id === null) periodo.final = ev;
              else periodo.evaluaciones.push(ev);
            });
          });
        });
        periodo.evaluaciones.sort(function (a, b) { return (b.fecha || '') < (a.fecha || '') ? -1 : 1; });
        if (periodo.evaluaciones.length || periodo.final) lista.push(periodo);
      });
      return {
        relId: String(cuerpo.relId || cuerpo.rel_id || ''),
        materiaId: materiaId ? String(materiaId) : null,
        titulo: (extra && extra.titulo) || '',
        periodos: lista
      };
    },
    tiny: function (r, extra) {
      var numero = ((extra && extra.ruta) || '').split('/').pop();
      return { numero: numero, valor: r.result && r.result.valor ? String(r.result.valor) : null };
    },
    asistencia: function (r) {
      var a = r.result || {};
      return {
        presente: Number(a.porcentaje_presente) || null,
        inasistencias: Number(a.total_inasistencias) || 0,
        tardanzas: Number(a.total_tardanzas) || 0
      };
    },
    faltas: function (r) {
      return (r.result || []).map(function (f) {
        return {
          fecha: (f.fecha_format || '').slice(0, 10),
          estado: f.estado_simbolo || '',
          tipo: f.caracteristica || '',
          justificacion: f.justificacion_estado_familia || ''
        };
      });
    },
    eventos: function (r) {
      return (r.result || []).map(function (e) {
        return {
          titulo: texto(e.titulo || e.nombre || e.descripcion, 140),
          inicio: e.fecha_inicio_format || e.inicio || fechaUnix(e.fecha_inicio) || e.fecha || null,
          fin: e.fecha_fin_format || e.fin || fechaUnix(e.fecha_fin) || null,
          categoria: (e.categoria && (e.categoria.nombre || e.categoria)) || e.categoria_nombre || ''
        };
      });
    },
    archivos: function (r) {
      return (r.files || []).map(function (f) {
        return {
          nombre: f.file_nombre || f.file_informacion || '',
          autor: f.usuario_creador || '',
          fecha: fechaUnix(f.file_creation),
          leido: String(f.leido) === '1'
        };
      });
    },
    colegio: function (r) {
      var c = r.result || {};
      return { colegio: c.colegio_nombre || '', alumno: c.usuario || '' };
    }
  };

  function normalizar(tipo, respuesta, extra) {
    return NORMALIZAR[tipo] ? NORMALIZAR[tipo](respuesta || {}, extra || {}) : null;
  }

  /*
   * Junta un dato nuevo con lo que ya se tenía. Los comunicados se acumulan
   * (los últimos 60); los detalles abiertos se guardan aparte (los últimos 20).
   */
  function combinar(estado, tipo, datos, ahora) {
    estado = estado || {};
    var e = JSON.parse(JSON.stringify(estado));
    if (tipo === 'comunicados') {
      var porId = {};
      (e.comunicados || []).concat(datos).forEach(function (c) { porId[c.id] = c; });
      e.comunicados = Object.keys(porId).map(function (k) { return porId[k]; })
        .sort(function (a, b) { return (b.fecha || '') < (a.fecha || '') ? -1 : 1; })
        .slice(0, 60);
    } else if (tipo === 'comunicado') {
      var detalles = (e.detalles || []).filter(function (d) { return d.id !== datos.id; });
      detalles.unshift(datos);
      e.detalles = detalles.slice(0, 20);
      (e.comunicados || []).forEach(function (c) { if (c.id === datos.id) c.leido = true; });
    } else if (tipo === 'calificaciones') {
      if (!datos.relId) return estado;
      e.calificaciones = e.calificaciones || {};
      var previo = e.calificaciones[datos.relId];
      if (!datos.titulo && previo) datos.titulo = previo.titulo; // no perder el nombre ya visto
      e.calificaciones[datos.relId] = datos;
    } else if (tipo === 'tiny') {
      if (!datos.valor) return estado;
      e.tiny = e.tiny || {};
      e.tiny[datos.numero] = datos.valor;
      var claves = Object.keys(e.tiny);
      if (claves.length > 300) delete e.tiny[claves[0]];
      return e; // no cuenta como actualización visible
    } else {
      e[tipo] = datos;
    }
    e.actualizado = e.actualizado || {};
    e.actualizado[tipo] = (ahora || new Date()).toISOString();
    return e;
  }

  var api = { reconocer: reconocer, normalizar: normalizar, combinar: combinar, texto: texto, leerCuerpo: leerCuerpo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.__panelColegium = api;
})(typeof window !== 'undefined' ? window : this);
