/**
 * Datos guardados de cada foto: giro leído del archivo (gir_), giro a mano (man_) y
 * tamaño medido de la miniatura (tam_). Van en la hoja "Datos de fotos" de la planilla.
 *
 * Antes iban en las Propiedades del script, una por foto: con cientos de fotos la pantalla
 * de Propiedades de Google se vuelve de solo lectura (muestra 50) y no se puede agregar
 * nada. La primera vez que se usa, se mudan solas a la hoja y se borran de Propiedades.
 */

var DATOS_FOTOS_ = null;        // clave → valor, cargado una vez por ejecución
var DATOS_FOTOS_CAMBIOS_ = false;
var CLAVE_DATO_FOTO_ = /^(gir|man|tam)_/;

function hojaDatosFotos_() {
  var libro = planilla_();
  var hoja = libro.getSheetByName('Datos de fotos');
  if (!hoja) {
    hoja = libro.insertSheet('Datos de fotos');
    hoja.getRange(1, 1, 1, 2).setValues([['clave', 'valor']]).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function datosFotos_() {
  if (DATOS_FOTOS_) return DATOS_FOTOS_;
  var d = {};
  var hoja = hojaDatosFotos_();
  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues().forEach(function (f) {
      if (f[0]) d[String(f[0])] = String(f[1]);
    });
  }
  DATOS_FOTOS_ = d;
  mudarDatosFotosDePropiedades_();
  return d;
}

/* Lo que todavía esté en Propiedades (versiones anteriores) pasa a la hoja. */
function mudarDatosFotosDePropiedades_() {
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  var quedan = {};
  var movidas = 0;
  Object.keys(todas).forEach(function (k) {
    if (CLAVE_DATO_FOTO_.test(k)) {
      if (DATOS_FOTOS_[k] === undefined) DATOS_FOTOS_[k] = todas[k];
      movidas++;
    } else {
      quedan[k] = todas[k];
    }
  });
  if (!movidas) return;
  DATOS_FOTOS_CAMBIOS_ = true;
  guardarDatosFotos_();
  props.setProperties(quedan, true); // true: borra las demás (las de fotos, ya copiadas a la hoja)
  Logger.log('Pasé ' + movidas + ' datos de fotos de Propiedades a la hoja "Datos de fotos".');
}

function datoFoto_(clave) {
  return datosFotos_()[clave];
}

function guardarDatoFoto_(clave, valor) {
  var d = datosFotos_();
  if (valor === null || valor === undefined) delete d[clave]; else d[clave] = String(valor);
  DATOS_FOTOS_CAMBIOS_ = true;
}

function guardarDatosFotos_() {
  if (!DATOS_FOTOS_ || !DATOS_FOTOS_CAMBIOS_) return;
  var filas = Object.keys(DATOS_FOTOS_).map(function (k) { return [k, DATOS_FOTOS_[k]]; });
  var hoja = hojaDatosFotos_();
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).clearContent();
  if (filas.length) hoja.getRange(2, 1, filas.length, 2).setValues(filas);
  DATOS_FOTOS_CAMBIOS_ = false;
}

/** Ejecutar una vez si la pantalla de Propiedades no deja agregar nada: muda los datos de fotos. */
function ordenarPropiedades() {
  datosFotos_();
  Logger.log('Listo. Propiedades que quedan: ' +
    Object.keys(PropertiesService.getScriptProperties().getProperties()).join(', '));
}
