/**
 * Datos de Colegium que manda la extensión de Chrome (extension-colegium/).
 * Se guardan en la hoja "Colegium" de la planilla de listas, partidos en trozos
 * porque una celda admite hasta 50.000 caracteres.
 *
 *   POST {action: 'colegium', token, datos}   → guarda
 *   ?action=colegium&token=...                → { datos, recibido }
 *
 * También guarda lo de Classroom (POST/GET action 'classroom'), con el mismo formato.
 */

var TROZO_COLEGIUM_ = 40000;
var MAXIMO_COLEGIUM_ = 600000; // caracteres; bastante más de lo que manda la extensión

function hojaColegium_() {
  return hojaDatos_('Colegium');
}

function hojaDatos_(nombre) {
  var libro = planilla_();
  return libro.getSheetByName(nombre) || libro.insertSheet(nombre);
}

function guardarColegium_(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('No llegaron datos de Colegium');
  return guardarJson_('Colegium', 'COLEGIUM_RECIBIDO', datos);
}

function leerColegium_() {
  return leerJson_('Colegium', 'COLEGIUM_RECIBIDO');
}

/* Classroom: lo manda el script que corre en la cuenta de Thi (apps-script-classroom/). */
function guardarClassroom_(datos) {
  if (!datos || typeof datos !== 'object' || !datos.tareas) throw new Error('No llegaron datos de Classroom');
  return guardarJson_('Classroom', 'CLASSROOM_RECIBIDO', datos);
}

function leerClassroom_() {
  return leerJson_('Classroom', 'CLASSROOM_RECIBIDO');
}

/** Guarda un JSON en una hoja, partido en trozos (una celda admite 50.000 caracteres). */
function guardarJson_(nombreHoja, propiedad, datos) {
  var texto = JSON.stringify(datos);
  if (texto.length > MAXIMO_COLEGIUM_) throw new Error('Los datos de ' + nombreHoja + ' son demasiado grandes');
  return conLock_(function () {
    var hoja = hojaDatos_(nombreHoja);
    hoja.clearContents();
    var filas = [];
    for (var i = 0; i < texto.length; i += TROZO_COLEGIUM_) filas.push([texto.slice(i, i + TROZO_COLEGIUM_)]);
    hoja.getRange(1, 1, filas.length, 1).setValues(filas);
    var recibido = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty(propiedad, recibido);
    return { ok: true, recibido: recibido };
  });
}

function leerJson_(nombreHoja, propiedad) {
  var hoja = hojaDatos_(nombreHoja);
  var ultima = hoja.getLastRow();
  if (!ultima) return { datos: null, recibido: null };
  var texto = hoja.getRange(1, 1, ultima, 1).getValues().map(function (f) { return f[0]; }).join('');
  return {
    datos: texto ? JSON.parse(texto) : null,
    recibido: PropertiesService.getScriptProperties().getProperty(propiedad)
  };
}
