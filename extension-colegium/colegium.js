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
    { tipo: 'colegio', patron: /\/api\/usuario\/rol\/\d+\/info$/ }
  ];

  function reconocer(ruta) {
    for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i].patron.test(ruta)) return TIPOS[i].tipo;
    return null;
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
          resumen: texto(c.mensaje, 400),
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
      var out = {};
      Object.keys(dias).forEach(function (d) {
        out[d] = dias[d].map(function (b) {
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

  function normalizar(tipo, respuesta) {
    return NORMALIZAR[tipo] ? NORMALIZAR[tipo](respuesta || {}) : null;
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
    } else {
      e[tipo] = datos;
    }
    e.actualizado = e.actualizado || {};
    e.actualizado[tipo] = (ahora || new Date()).toISOString();
    return e;
  }

  var api = { reconocer: reconocer, normalizar: normalizar, combinar: combinar, texto: texto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.__panelColegium = api;
})(typeof window !== 'undefined' ? window : this);
