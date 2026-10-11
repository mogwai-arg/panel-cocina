# Panel de Cocina

Panel familiar y marco de fotos para la cocina, pensado para un marco digital
Android barato (FLYAMAPIRIT WF107T, 10,1", 1280x800) en lugar de la app Frameo.

Costo de funcionamiento: $0. Usa Google Apps Script como backend (corre en los
servidores de Google con tu cuenta) y el propio marco como pantalla.

## Estado

| Módulo | Estado |
|---|---|
| Fotos desde Drive con diseño inteligente | ✅ primera versión |
| Panel "Hoy" (reloj, clima, agenda, próximo evento) | pendiente |
| Tareas y compras (Google Sheets) | pendiente |
| Avisos del cole leídos de Gmail con IA | pendiente |
| Ubicación de Thiago (OwnTracks) | pendiente |
| Instalación en el marco por ADB | pendiente |

## Fotos

- **Horizontal** → pantalla completa.
- **Verticales** → collage de 2, o tríptico de 3 si son finitas (9:16).
  Primero junta fotos del mismo día; las que quedan solas se emparejan entre sí.
- **Panorámicas, cuadradas y verticales sin pareja** → enteras, con la misma
  foto desenfocada de fondo.
- **Un día como hoy** → las fotos de esta fecha de otros años salen primero,
  con el cartel "Hace N años".
- Toca a la derecha para avanzar y a la izquierda para volver.

La lógica de diseño está en [`web/js/layout.js`](web/js/layout.js) y tiene tests.

## Probarlo en la compu (modo demo)

```bash
npm test          # tests del motor de diseño
npm run serve     # abre http://localhost:8080
```

Sin `config.js` usa imágenes de ejemplo de `web/demo/`.
Agregá `?debug=1` a la URL para ver qué regla aplicó en cada diapositiva,
y `?segundos=5` para que pasen más rápido.

## Conectarlo a tu Drive

Hacelo con la cuenta de Google **dueña de las fotos**.

1. Entrá a <https://script.google.com> → **Nuevo proyecto**. Ponele "Panel de Cocina".
2. En **Configuración del proyecto** (engranaje) tildá
   *Mostrar el archivo de manifiesto "appsscript.json" en el editor*.
3. En el editor, reemplazá el contenido de `Código.gs` con
   [`apps-script/Code.gs`](apps-script/Code.gs) y el de `appsscript.json` con
   [`apps-script/appsscript.json`](apps-script/appsscript.json). Guardá.
4. En **Configuración del proyecto → Propiedades del script** agregá:
   - `CARPETAS`: el ID de la carpeta de fotos (lo que va después de
     `/folders/` en el link de Drive). Podés poner varias separadas por coma.
     Se incluyen las subcarpetas.
   - `TOKEN`: una clave larga inventada por vos (por ejemplo, 30 letras y números).
5. Elegí la función `probar` arriba y tocá **Ejecutar**. Google te va a pedir
   permisos para leer tu Drive: aceptalos. En el registro tiene que aparecer
   cuántas fotos encontró.
6. **Implementar → Nueva implementación → Aplicación web**.
   Ejecutar como: *Yo*. Quién tiene acceso: *Cualquier persona*. Copiá la URL que termina en `/exec`.
7. Copiá `web/config.example.js` como `web/config.js` y completá la URL y el TOKEN.

"Cualquier persona" significa que cualquiera con la URL **y** el TOKEN puede ver
las fotos. Sin el TOKEN, el script no devuelve nada. No compartas ninguno de los dos.

Cada vez que cambies `Code.gs` hay que hacer **Implementar → Gestionar
implementaciones → Editar → Nueva versión** para que el cambio llegue al marco.

## Estructura

```
apps-script/   backend (Google Apps Script)
web/           lo que muestra el marco (HTML/CSS/JS sin dependencias, compatible con Chrome 106)
  js/layout.js   motor de diseño de diapositivas (función pura)
  js/fuentes.js  de dónde salen las fotos: demo o Drive
  js/fotos.js    slideshow
test/          tests (`node --test`)
scripts/       generador de imágenes de ejemplo
```
