/**
 * Tareas y compras, guardadas en una planilla de Google Sheets.
 *
 * Ejecutá una vez crearPlanilla(): crea "Panel de Cocina · Listas" en tu Drive con
 * las hojas Compras, Habituales, Tareas e Historial, y guarda su ID en la
 * propiedad PLANILLA_ID. La planilla se puede editar a mano (también desde el celular).
 *
 * Pedidos:
 *   ?action=listas                                       → { compras, habituales, tareas, estrellas }
 *   ?action=compra&op=agregar&item=Leche&cantidad=2&categoria=Lácteos
 *   ?action=compra&op=marcar&id=...&valor=1|0           (comprado / no comprado)
 *   ?action=compra&op=cantidad&id=...&cantidad=3
 *   ?action=tarea&op=marcar&id=...&valor=1|0            (hecha hoy / no)
 * Todos los cambios devuelven las listas actualizadas.
 */

var HOJAS_ = {
  Compras: ['id', 'item', 'cantidad', 'categoria', 'comprado', 'comprado_el', 'agregado_el'],
  Habituales: ['item', 'categoria'],
  Tareas: ['id', 'tarea', 'persona', 'momento', 'estrellas', 'dias', 'hecha_el'],
  Historial: ['fecha', 'persona', 'tarea', 'estrellas']
};

var ZONA_ = 'America/Argentina/Buenos_Aires';

function hoyIso_() {
  return Utilities.formatDate(new Date(), ZONA_, 'yyyy-MM-dd');
}

/** Valor de celda → "yyyy-MM-dd" (Sheets convierte las fechas en objetos Date). */
function fechaIso_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, ZONA_, 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

function planilla_() {
  var id = PropertiesService.getScriptProperties().getProperty('PLANILLA_ID');
  if (!id) throw new Error('Falta la planilla: ejecutá crearPlanilla en el editor de Apps Script');
  return SpreadsheetApp.openById(id);
}

/* Una celda vacía o una casilla sin tildar no cuentan como datos. */
function vacia_(v) {
  return v === '' || v === null || v === undefined || v === false;
}

function filaVacia_(fila) {
  return fila.every(vacia_);
}

/**
 * Filas de una hoja como objetos, con el número de fila para poder editarlas.
 * A las filas cargadas a mano sin id les asigna uno.
 */
function leerHoja_(libro, nombre) {
  var hoja = libro.getSheetByName(nombre);
  var valores = hoja.getDataRange().getValues();
  var columnas = valores.shift();
  var colId = columnas.indexOf('id');
  var filas = [];
  valores.forEach(function (fila, i) {
    if (filaVacia_(fila)) return;
    var o = { _fila: i + 2 };
    columnas.forEach(function (c, j) { o[c] = fila[j]; });
    if (colId >= 0 && vacia_(o.id)) {
      o.id = nuevoId_();
      hoja.getRange(o._fila, colId + 1).setValue(o.id);
    }
    filas.push(o);
  });
  return filas;
}

/** Escribe `valores` en la primera fila libre (sin contar casillas vacías) y devuelve su número. */
function agregarFila_(hoja, valores) {
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (filaVacia_(datos[i])) {
      hoja.getRange(i + 1, 1, 1, valores.length).setValues([valores]);
      return i + 1;
    }
  }
  hoja.appendRow(valores);
  return hoja.getLastRow();
}

function columna_(nombreHoja, columna) {
  return HOJAS_[nombreHoja].indexOf(columna) + 1;
}

function nuevoId_() {
  return Utilities.getUuid().slice(0, 8);
}

/** Lunes de la semana de `fecha` ("yyyy-MM-dd"). */
function lunesDe_(fecha) {
  var d = new Date(fecha + 'T12:00:00');
  var dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  return Utilities.formatDate(d, ZONA_, 'yyyy-MM-dd');
}

/** Estrellas de la semana por persona, a partir del historial. */
function estrellasDeLaSemana_(historial, hoy) {
  var desde = lunesDe_(hoy);
  var r = {};
  historial.forEach(function (h) {
    var f = fechaIso_(h.fecha);
    if (f >= desde && f <= hoy) r[h.persona] = (r[h.persona] || 0) + (Number(h.estrellas) || 0);
  });
  return r;
}

function listas_() {
  var libro = planilla_();
  var hoy = hoyIso_();
  var compras = leerHoja_(libro, 'Compras')
    // Lo comprado se sigue viendo tachado durante el día y después desaparece.
    .filter(function (c) { return !c.comprado || fechaIso_(c.comprado_el) === hoy; })
    .map(function (c) {
      return { id: String(c.id), item: String(c.item), cantidad: Number(c.cantidad) || 1,
               categoria: String(c.categoria || 'Otros'), comprado: c.comprado === true };
    });
  var habituales = leerHoja_(libro, 'Habituales').map(function (h) {
    return { item: String(h.item), categoria: String(h.categoria || 'Otros') };
  });
  var tareas = leerHoja_(libro, 'Tareas').map(function (t) {
    return { id: String(t.id), tarea: String(t.tarea), persona: String(t.persona || 'Cualquiera'),
             momento: String(t.momento || ''), estrellas: Number(t.estrellas) || 0,
             dias: String(t.dias || ''), hecha: fechaIso_(t.hecha_el) === hoy };
  });
  return {
    compras: compras,
    habituales: habituales,
    tareas: tareas,
    estrellas: estrellasDeLaSemana_(leerHoja_(libro, 'Historial'), hoy),
    hoy: hoy
  };
}

function conLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function compra_(p) {
  return conLock_(function () {
    var libro = planilla_();
    var hoja = libro.getSheetByName('Compras');
    if (p.op === 'agregar') {
      var item = String(p.item || '').trim();
      if (!item) throw new Error('Falta el nombre de lo que hay que comprar');
      // Si ya está en la lista sin comprar, suma cantidad en vez de duplicar.
      var existente = leerHoja_(libro, 'Compras').filter(function (c) {
        return !c.comprado && String(c.item).toLowerCase() === item.toLowerCase();
      })[0];
      if (existente) {
        hoja.getRange(existente._fila, columna_('Compras', 'cantidad'))
          .setValue((Number(existente.cantidad) || 1) + (Number(p.cantidad) || 1));
      } else {
        var categoria = p.categoria || categoriaHabitual_(libro, item) || 'Otros';
        var fila = agregarFila_(hoja, [nuevoId_(), item, Number(p.cantidad) || 1, categoria, false, '', hoyIso_()]);
        hoja.getRange(fila, columna_('Compras', 'comprado')).insertCheckboxes();
      }
    } else {
      var fila = buscarPorId_(libro, 'Compras', p.id);
      if (p.op === 'marcar') {
        var comprado = p.valor === '1';
        hoja.getRange(fila, columna_('Compras', 'comprado'), 1, 2).setValues([[comprado, comprado ? hoyIso_() : '']]);
      } else if (p.op === 'cantidad') {
        var cantidad = Math.max(1, Number(p.cantidad) || 1);
        hoja.getRange(fila, columna_('Compras', 'cantidad')).setValue(cantidad);
      } else {
        throw new Error('Operación desconocida: ' + p.op);
      }
    }
    return listas_();
  });
}

function categoriaHabitual_(libro, item) {
  var h = leerHoja_(libro, 'Habituales').filter(function (x) {
    return String(x.item).toLowerCase() === item.toLowerCase();
  })[0];
  return h ? String(h.categoria) : null;
}

function buscarPorId_(libro, hoja, id) {
  var fila = leerHoja_(libro, hoja).filter(function (o) { return String(o.id) === String(id); })[0];
  if (!fila) throw new Error('No encontré ese elemento (¿lo borraron de la planilla?)');
  return fila._fila;
}

function tarea_(p) {
  return conLock_(function () {
    if (p.op !== 'marcar') throw new Error('Operación desconocida: ' + p.op);
    var libro = planilla_();
    var tareas = leerHoja_(libro, 'Tareas');
    var t = tareas.filter(function (x) { return String(x.id) === String(p.id); })[0];
    if (!t) throw new Error('No encontré esa tarea (¿la borraron de la planilla?)');
    var hoy = hoyIso_();
    var hecha = p.valor === '1';
    var yaEstaba = fechaIso_(t.hecha_el) === hoy;
    libro.getSheetByName('Tareas').getRange(t._fila, columna_('Tareas', 'hecha_el')).setValue(hecha ? hoy : '');

    var historial = libro.getSheetByName('Historial');
    if (hecha && !yaEstaba) {
      agregarFila_(historial, [hoy, t.persona, t.tarea, Number(t.estrellas) || 0]);
    } else if (!hecha && yaEstaba) {
      // Destildar devuelve las estrellas: borra la anotación de hoy de esa tarea.
      var h = leerHoja_(libro, 'Historial').filter(function (x) {
        return fechaIso_(x.fecha) === hoy && x.persona === t.persona && x.tarea === t.tarea;
      }).pop();
      if (h) historial.deleteRow(h._fila);
    }
    return listas_();
  });
}

/** Ejecutalo una vez desde el editor: crea la planilla con ejemplos. */
function crearPlanilla() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('PLANILLA_ID')) {
    Logger.log('Ya existe: ' + SpreadsheetApp.openById(props.getProperty('PLANILLA_ID')).getUrl());
    return;
  }
  var libro = SpreadsheetApp.create('Panel de Cocina · Listas');
  var ejemplos = {
    Compras: [
      [nuevoId_(), 'Leche', 2, 'Lácteos', false, '', hoyIso_()],
      [nuevoId_(), 'Yerba', 1, 'Almacén', false, '', hoyIso_()],
      [nuevoId_(), 'Bananas', 6, 'Verdulería', false, '', hoyIso_()]
    ],
    Habituales: [
      ['Leche', 'Lácteos'], ['Yerba', 'Almacén'], ['Pan', 'Panadería'], ['Huevos', 'Almacén'],
      ['Bananas', 'Verdulería'], ['Café', 'Almacén'], ['Queso', 'Lácteos'], ['Papel de cocina', 'Limpieza'],
      ['Detergente', 'Limpieza']
    ],
    Tareas: [
      [nuevoId_(), 'Tender la cama', 'Thi', 'Mañana', 1, '', ''],
      [nuevoId_(), 'Preparar el bolso de básquet', 'Thi', 'Mañana', 1, 'sáb', ''],
      [nuevoId_(), 'Tarea del colegio', 'Thi', 'Tarde', 2, 'lun,mar,mié,jue,vie', ''],
      [nuevoId_(), 'Sacar la basura', 'Javi', 'Noche', 1, '', ''],
      [nuevoId_(), 'Hacer las compras', 'Dan', 'Tarde', 2, '', ''],
      [nuevoId_(), 'Regar las plantas', 'Cualquiera', 'Tarde', 2, 'mié,sáb', '']
    ],
    Historial: []
  };
  Object.keys(HOJAS_).forEach(function (nombre, i) {
    var hoja = i === 0 ? libro.getSheets()[0].setName(nombre) : libro.insertSheet(nombre);
    var columnas = HOJAS_[nombre];
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight('bold');
    hoja.setFrozenRows(1);
    if (ejemplos[nombre].length) {
      hoja.getRange(2, 1, ejemplos[nombre].length, columnas.length).setValues(ejemplos[nombre]);
    }
  });
  var tareas = libro.getSheetByName('Tareas');
  tareas.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Mañana', 'Tarde', 'Noche'], true).setAllowInvalid(true).build());
  tareas.getRange(1, 6).setNote('Días en que toca, separados por coma: lun,mar,mié,jue,vie,sáb,dom. Vacío = todos los días.');
  libro.getSheetByName('Compras').getRange(2, columna_('Compras', 'comprado'), ejemplos.Compras.length, 1).insertCheckboxes();
  props.setProperty('PLANILLA_ID', libro.getId());
  Logger.log('Planilla creada: ' + libro.getUrl());
}

/** Para probar desde el editor. */
function probarListas() {
  var l = listas_();
  Logger.log('Compras pendientes: ' + l.compras.filter(function (c) { return !c.comprado; }).length);
  Logger.log('Tareas: ' + l.tareas.length + ' · estrellas de la semana: ' + JSON.stringify(l.estrellas));
}
