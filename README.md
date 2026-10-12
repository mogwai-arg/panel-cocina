# Panel de Cocina

Panel familiar y marco de fotos para la cocina, pensado para un marco digital
Android barato (FLYAMAPIRIT WF107T, 10,1", 1280x800) en lugar de la app Frameo.

Costo de funcionamiento: $0. Usa Google Apps Script como backend (corre en los
servidores de Google con tu cuenta) y el propio marco como pantalla.

## Estado

| Módulo | Estado |
|---|---|
| Fotos desde Drive con diseño inteligente | ✅ funcionando con Drive |
| Panel "Hoy" (reloj, clima, agenda, próximo evento) | ✅ funcionando con Google Calendar |
| Partidos de básquet de Thiago (FeBAMBA) | ✅ primera versión |
| Tareas y compras (Google Sheets) | pendiente |
| Avisos del cole leídos de Gmail con IA | pendiente |
| Ubicación de Thiago (OwnTracks) | pendiente |
| Instalación en el marco por ADB, con backup de Frameo | pendiente |
| Videos de Drive (requiere probar qué reproduce el marco) | pendiente |

## Cómo se usa

- Al prender muestra el panel **Hoy**. Después de 3 minutos sin tocarlo pasa a las **fotos**.
- En las fotos: tocar vuelve al panel; deslizar a los costados cambia de foto.
- Tocar el recuadro del recuerdo (arriba a la derecha) abre las fotos.

## Hoy

- Reloj y fecha.
- Clima de [Open-Meteo](https://open-meteo.com) (gratis, sin clave) con una frase
  para las próximas horas: lluvia, si refresca o si hace calor.
- **Próximo**: el siguiente evento con horario, con cuenta regresiva si falta menos
  de hora y media.
- Una columna por calendario de Google Calendar con lo de hoy y mañana
  (las de más eventos primero, hasta 4).
- **Próximos días**: lo que viene a partir de pasado mañana.
- Un recuerdo: una foto de "un día como hoy" si hay, si no una al azar.
- **Básquet**: el próximo partido de Thiago con los dos escudos, día, hora y cancha;
  el último resultado y la racha de los últimos 5. Los partidos por jugar también
  entran en la agenda, así que el día del partido aparece en "Próximo" con cuenta regresiva.

## Básquet

Los partidos salen del sitio de la federación (FeBAMBA usa el sistema Gesdeportiva,
el mismo de la app de CAB). El Apps Script lee el fixture del torneo una vez por hora
y se queda con los partidos del equipo. Por defecto busca a **Argentino de Castelar
Norte A** en **Cadetes Masculino, Formativas 2026**. Para otro equipo o temporada,
cambiá estas propiedades del script:

| Propiedad | Por defecto | De dónde sale |
|---|---|---|
| `BASQUET_SITIO` | `https://www.febamba.com` | sitio de la federación |
| `BASQUET_COMPETICION` | `2015` | el número en la URL del torneo (`/detalle-torneo/2015/...`) |
| `BASQUET_CATEGORIA` | `5077` | el valor de la categoría en el selector de esa página |
| `BASQUET_EQUIPO` | `ARGENTINO DE CASTELAR NORTE A` | el nombre como figura en el fixture |

Para probarlo desde el editor: ejecutá `probarBasquet`.

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

Sin `config.js` usa fotos, agenda y clima de ejemplo.

Opciones en la URL, útiles para probar:
- `?demo=1` usa los datos de ejemplo aunque haya `config.js`
- `?vista=fotos` arranca en las fotos
- `?debug=1` muestra qué regla de diseño se aplicó en cada foto
- `?segundos=5` cambia de foto cada 5 segundos
- `?inactividad=1` vuelve a las fotos después de 1 minuto sin tocar

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

Para el calendario, ejecutá también `probarAgenda`: Google va a pedir permiso
para leer tu calendario. Por defecto se usan todos los calendarios que tenés
visibles en Google Calendar; si querés solo algunos, agregá la propiedad
`CALENDARIOS` con sus IDs separados por coma (el ID está en Google Calendar →
configuración del calendario → *Integrar el calendario*).

Cada vez que cambies `Code.gs` o `appsscript.json` hay que hacer **Implementar → Gestionar
implementaciones → Editar → Nueva versión** para que el cambio llegue al marco.

## Estructura

```
apps-script/   backend (Google Apps Script)
web/           lo que muestra el marco (HTML/CSS/JS sin dependencias, compatible con Chrome 106)
  js/layout.js   motor de diseño de diapositivas (función pura)
  js/fuentes.js  de dónde salen las fotos: demo o Drive
  js/fotos.js    slideshow
  js/agenda.js   lógica de la agenda (función pura)
  js/clima.js    clima de Open-Meteo
  js/basquet.js  lógica de la tarjeta de básquet (función pura)
  js/hoy.js      vista "Hoy"
  js/app.js      arranque, barra lateral, inactividad
test/          tests (`node --test`)
scripts/       generador de imágenes de ejemplo
```
