/**
 * Datos de Colegium que manda la extensión de Chrome (extension-colegium/).
 * Se guardan en la hoja "Colegium" de la planilla de listas, partidos en trozos
 * porque una celda admite hasta 50.000 caracteres.
 *
 *   POST {action: 'colegium', token, datos}   → guarda
 *   ?action=colegium&token=...                → { datos, recibido }
 */

var TROZO_COLEGIUM_ = 40000;
var MAXIMO_COLEGIUM_ = 600000; // caracteres; bastante más de lo que manda la extensión

function hojaColegium_() {
  var libro = planilla_();
  return libro.getSheetByName('Colegium') || libro.insertSheet('Colegium');
}

function guardarColegium_(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('No llegaron datos de Colegium');
  var texto = JSON.stringify(datos);
  if (texto.length > MAXIMO_COLEGIUM_) throw new Error('Los datos de Colegium son demasiado grandes');
  return conLock_(function () {
    var hoja = hojaColegium_();
    hoja.clearContents();
    var filas = [];
    for (var i = 0; i < texto.length; i += TROZO_COLEGIUM_) filas.push([texto.slice(i, i + TROZO_COLEGIUM_)]);
    hoja.getRange(1, 1, filas.length, 1).setValues(filas);
    var recibido = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperty('COLEGIUM_RECIBIDO', recibido);
    return { ok: true, recibido: recibido };
  });
}

function leerColegium_() {
  var hoja = hojaColegium_();
  var ultima = hoja.getLastRow();
  if (!ultima) return { datos: null, recibido: null };
  var texto = hoja.getRange(1, 1, ultima, 1).getValues().map(function (f) { return f[0]; }).join('');
  return {
    datos: texto ? JSON.parse(texto) : null,
    recibido: PropertiesService.getScriptProperties().getProperty('COLEGIUM_RECIBIDO')
  };
}
