/**
 * Dónde se sacó cada foto: Drive guarda las coordenadas (si la foto las tiene, como casi
 * todas las del celular) y acá se pasan a un nombre ("Miramar", "Orlando, Estados Unidos")
 * con el servicio de mapas de Apps Script (gratis). Cada lugar (redondeado a ~1 km) se busca
 * una sola vez y queda guardado en la hoja "Datos de fotos" (clave lug_<lat>,<lon>).
 */

var SEGUNDOS_LUGARES_POR_LISTA = 8;

function claveLugar_(lat, lon) {
  return 'lug_' + Number(lat).toFixed(2) + ',' + Number(lon).toFixed(2);
}

/*
 * De la respuesta del geocodificador, el nombre corto: la localidad (o el partido, o la
 * provincia) y, si es fuera de la Argentina, el país. Puro, para los tests.
 */
function nombreDeGeocoder_(respuesta) {
  var resultados = (respuesta && respuesta.results) || [];
  var buscar = function (tipo) {
    for (var i = 0; i < resultados.length; i++) {
      var comps = resultados[i].address_components || [];
      for (var j = 0; j < comps.length; j++) {
        if ((comps[j].types || []).indexOf(tipo) >= 0) return comps[j].long_name;
      }
    }
    return '';
  };
  var lugar = buscar('locality') || buscar('administrative_area_level_2') || buscar('administrative_area_level_1') ||
    buscar('natural_feature');
  var pais = buscar('country');
  if (!lugar) return pais || '';
  return pais && pais !== 'Argentina' ? lugar + ', ' + pais : lugar;
}

function nombreLugar_(lat, lon) {
  try {
    return nombreDeGeocoder_(Maps.newGeocoder().setLanguage('es').reverseGeocode(lat, lon));
  } catch (e) {
    Logger.log('No se pudo buscar el lugar ' + lat + ',' + lon + ': ' + e.message);
    return null; // se reintenta en otra vuelta
  }
}

/** A las fotos con coordenadas (foto._coord) les pone foto.lugar. Busca con un límite de tiempo. */
function ponerLugares_(fotos, segundos) {
  var hasta = Date.now() + segundos * 1000;
  var pendientes = 0;
  fotos.forEach(function (foto) {
    var c = foto._coord;
    delete foto._coord;
    if (!c) return;
    var clave = claveLugar_(c[0], c[1]);
    var nombre = datoFoto_(clave);
    if (nombre === undefined) {
      if (Date.now() > hasta) { pendientes++; return; }
      nombre = nombreLugar_(c[0], c[1]);
      if (nombre === null) { pendientes++; return; }
      guardarDatoFoto_(clave, nombre);
    }
    if (nombre) foto.lugar = nombre;
  });
  if (ultimoResumen_) ultimoResumen_.lugaresPendientes = pendientes;
  return pendientes;
}
