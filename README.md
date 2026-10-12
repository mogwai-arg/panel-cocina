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
| Partidos de básquet de Thi (FeBAMBA) | ✅ primera versión |
| Tareas y compras (Google Sheets) | ✅ primera versión |
| Colegium (extensión de Chrome) | ✅ primera versión |
| Classroom de Thi (tareas, entregas, avisos) | ✅ |
| Avisos: mails importantes (turnos, cole, vencimientos) | ✅ con búsquedas de Gmail, sin IA |
| Ubicación de Thi (OwnTracks) con avisos de llegada | ✅ |
| Instalación en el marco por ADB, con backup de Frameo | pendiente |
| Videos de Drive | ✅ en la compu · falta probar qué formatos reproduce el marco |

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
  Ver [Básquet](#básquet).

## Básquet

Los partidos salen del sitio de la federación (FeBAMBA usa el sistema Gesdeportiva,
el mismo de la app de CAB). El Apps Script lee el fixture una vez por hora y se
queda con los partidos del equipo de Thiago.

**Sigue a Thiago aunque cambie de categoría.** Con su año de nacimiento calcula la
categoría de cada temporada (14–15 años: Cadetes, 16–17: Juveniles), busca en el
menú del sitio el torneo del año (por ejemplo `formativas-2027`) y, dentro de esa
categoría, el equipo de su club. Si el club tiene varios equipos en la categoría
(Norte A, Centro B...), usa el de `BASQUET_EQUIPO`; si ese nombre ya no existe,
la tarjeta muestra un aviso con las opciones. Entre temporadas sigue mostrando la
del año anterior.

Propiedades del script:

| Propiedad | Ejemplo | Para qué |
|---|---|---|
| `BASQUET_NACIMIENTO` | `2011` | año de nacimiento de Thiago (sin esto queda fijo en Cadetes 2026) |
| `BASQUET_CLUB` | `ARGENTINO DE CASTELAR` | club, como figura en el fixture |
| `BASQUET_EQUIPO` | `ARGENTINO DE CASTELAR NORTE A` | equipo preferido si el club tiene varios |
| `BASQUET_RAMA` | `MASCULINO` | |
| `BASQUET_TORNEO` | `formativas` | nombre del torneo en la URL del sitio |
| `BASQUET_SITIO` | `https://www.febamba.com` | |
| `BASQUET_COMPETICION` y `BASQUET_CATEGORIA` | `2015` y `5077` | para fijar torneo y categoría a mano |

Para probarlo desde el editor: ejecutá `probarBasquet`.

### Partidos en tu Google Calendar

Ejecutá una vez `activarSincronizacionBasquet`: crea el calendario **Básquet Thiago**,
copia los partidos y los mantiene al día cada 3 horas (cambios de horario o cancha, y
el resultado en el título: "🏀 Ganaron 96–73 vs San Miguel Verde"). Así los ves también
en el celular. Con la sincronización activa, el panel toma los partidos de ese
calendario y no los duplica.

## Tareas y Compras

Viven en una planilla de Google Sheets (**Panel de Cocina · Listas**) que se puede
editar a mano, también desde la app de Sheets del celular. Para crearla, agregá el
archivo [`apps-script/Listas.gs`](apps-script/Listas.gs) al proyecto de Apps Script
(**+ → Apps Script**, nombre `Listas`) y ejecutá `crearPlanilla` una vez.

- **Compras**: agrupadas por categoría, con cantidad. Tocar tacha (con "Deshacer");
  lo tachado desaparece al día siguiente. "Agregar algo…" o los **habituales**
  (hoja Habituales) suman a la lista; si ya estaba, suman cantidad.
- **Tareas**: una columna por persona, filtradas por mañana, tarde o noche
  (arranca en el momento actual). En la columna `dias` de la planilla van los días
  en que toca (`lun,mié,vie`); vacío = todos los días. Cada tarea suma `estrellas`
  y la cabecera muestra las de la semana (se cuentan desde la hoja Historial).
- La barra lateral muestra cuántas compras y tareas de hoy quedan pendientes.

## Colegium

Colegium está detrás de una verificación de Cloudflare que bloquea el acceso
automático, así que no se puede leer desde el Apps Script. En cambio, una extensión
de Chrome propia (`extension-colegium/`) mira las respuestas que la página ya recibe
**mientras alguien la usa** y manda lo útil al panel. No hace pedidos propios a
Colegium (por eso no marca nada como leído), no guarda la contraseña y no esquiva
ninguna protección.

**Modo automático:** mientras haya una pestaña de Colegium abierta (por ejemplo,
fijada al inicio de Chrome), la extensión repite cada 30 minutos los mismos pedidos
que hace la página, con la sesión abierta en esa pestaña. Cada sección se aprende
la primera vez que entrás a ella; después se actualiza sola. Si Colegium cierra la
sesión, el panel lo avisa. Con varias pestañas o compus, actualiza una sola por vez.

| Dato | Automático | Se aprende entrando a |
|---|---|---|
| Comunicados con su texto (título, quién, fecha, leído, adjuntos) | sí | Colegium (la portada) |
| Asistencia y faltas sin justificar | sí | Asistencia |
| Archivos compartidos | sí | Archivos |
| Eventos | sí | Calendario |
| Calificaciones (por materia: evaluaciones, conceptos, nota final) | sí | cada materia → Calificaciones, una vez |
| Horario de la semana (y nombres de las materias para las notas) | no (cambia poco) | Horario |
| Adjuntos de un comunicado | no: abrirlo lo marca como leído en Colegium | ese comunicado |

La URL y el TOKEN y lo aprendido de cada sección se guardan en tu cuenta de Chrome:
en otra compu con la misma cuenta solo hay que instalar la extensión.

El panel muestra todo en la pantalla **Cole**, con dos pestañas: **Comunicados** y
**Notas** (por materia, el **período actual** —el que Colegium marca como actual— con
sus últimas evaluaciones; las que tienen notas bajas —R, M o menos de 4— van primero).
Cada materia dice cómo viene comparada con el período anterior (mejora, pareja o
baja) y arriba hay un mensaje general de aliento. Para comparar, los conceptos se
llevan a números: EXC 10, MB 8,5, B 7, R 5, M 3. La barra lateral muestra los
comunicados sin leer: cuentan los que no se leyeron en Colegium ni se abrieron en
el panel (abrirlos en el panel no los marca como leídos en Colegium). Mesas de examen y boletines todavía no tienen datos para
saber cómo vienen.

**Instalación**

1. Agregá [`apps-script/Colegium.gs`](apps-script/Colegium.gs) al proyecto de Apps Script
   (**+ → Apps Script**, nombre `Colegium`), actualizá `Código.gs` y hacé una nueva versión
   de la implementación.
2. Chrome → `chrome://extensions` → **Modo de desarrollador** → **Cargar extensión sin
   empaquetar** → carpeta `extension-colegium`. Si ya estaba, tocá **↻ Actualizar**.
3. En la extensión, **Configurar**: la misma URL y TOKEN de `web/config.js`.
4. Abrí Colegium e iniciá sesión. El ícono de la extensión muestra qué tomó y si lo
   mandó al panel.

Los datos quedan en la hoja **Colegium** de la planilla de listas.

## Classroom (tareas de Thi)

Una pestaña **Classroom** en Cole con lo que Thi tiene que entregar (lo vencido en rojo,
lo de hoy en naranja), lo entregado esta semana (con la nota si ya lo corrigieron) y los
avisos de los profes. Las entregas de la semana también aparecen en la agenda de **Hoy**
("Entregar: …"), y el número de la barra lateral suma lo que vence hoy o mañana.

Como Classroom está en la cuenta de Gmail de Thi, hay un segundo Apps Script que corre
**en su cuenta**, solo lee, y le manda los datos al panel cada hora:

1. Entrá a [script.google.com](https://script.google.com) **con la cuenta de Thi** →
   Nuevo proyecto → llamalo "Panel · Classroom".
2. Pegá `apps-script-classroom/Classroom.gs`. En ⚙️ Configuración del proyecto tildá
   "Mostrar el archivo de manifiesto appsscript.json" y pegá `apps-script-classroom/appsscript.json`.
3. ⚙️ → Propiedades del script: `PANEL_URL` (la URL /exec del panel, la de config.js) y
   `TOKEN` (el mismo del panel).
4. Ejecutá `probarClassroom`: pide permisos (de solo lectura) y muestra materias y tareas.
5. Ejecutá `activarClassroom`: desde ahí se manda solo cada hora.

El mismo script manda los **eventos de los calendarios de Thi** (el suyo y el del curso de
Classroom, que no es público: solo lo ven los alumnos). Van a su columna en Hoy; los que ya
ves porque te compartió el calendario no se repiten, y las entregas del calendario del curso
tampoco (ya están como "Entregar: …").

En el Apps Script del panel no hay que configurar nada más que publicar la versión nueva.

## Avisos (mails importantes)

La pantalla **Avisos** muestra los mails de las últimas 3 semanas que importan, por
categoría: **Salud** (turnos, OSDE, laboratorio), **Cole**, **Pagos** (vencimientos, VEP,
expensas) y **Viajes**. Si el mail menciona una fecha futura ("martes 20 de octubre a las
10:30", "vence el 22/10") la muestra y la pone en la agenda de **Hoy**, para que un turno
no se pierda. No usa IA ni paga nada: son búsquedas de Gmail. Solo lee (no marca nada).

Las búsquedas están en la hoja **Mails** de la planilla (se crea sola): una fila por
categoría, con lo mismo que escribirías en el buscador de Gmail, por ejemplo
`from:osde.com.ar OR subject:turno`. Conviene buscar en el asunto (`subject:(…)`): buscando
en todo el mail se cuela publicidad que tiene esas palabras en el pie. La columna
**cuenta** dice en qué Gmail se busca: **Javi**, **Thi** o **Ambas**. Los de Thi los busca
el script de su cuenta (el de Classroom) cada hora, y en el panel dicen "para Thi". Para probarlas: `probarMails` en el editor (la primera vez pide permiso para
leer Gmail).

## Ubicación de Thi (OwnTracks)

En **Hoy**, arriba de la foto: dónde está Thi ("En Colegio · desde las 07:42", o "A 1,2 km
de Casa"), cuándo fue el último dato y la batería, con un mapita. Y si querés, **te llega
un mail cuando llega o se va** de un lugar (como Findmykid, pero gratis).

1. En tu Apps Script: agregá `Ubicacion.gs`, reemplazá `Code.gs` y `appsscript.json`
   (pide permiso para mandarte mails), publicá **Nueva versión** y ejecutá `probarUbicacion`
   (crea la hoja **Lugares** y muestra la URL para OwnTracks).
2. Hoja **Lugares**: en Google Maps, clic derecho sobre el lugar → clic en las coordenadas
   (se copian) → pegalas en la columna `coordenadas`. `radio_m` = qué tan cerca cuenta como
   "estar ahí" (150 m va bien). Tildá `avisar` donde quieras el mail de llegada/salida.
3. En el iPhone de Thi, OwnTracks → ⚙️ (Settings):
   - **Mode**: `HTTP`
   - **URL**: `<URL /exec>?action=ubicacion&quien=Thi&token=<TOKEN>`
   - Autenticación: apagada (el token va en la URL).
   - En Ajustes del iPhone → OwnTracks → Ubicación: **Siempre** y **Ubicación exacta**
     activada; y "Actualización en segundo plano" activada.
   - En el mapa de OwnTracks, el botón de arriba elige el modo: **Significant** (gasta poca
     batería: manda cuando se mueve unos cientos de metros) o **Move** (más preciso, gasta más).

Con el teléfono quieto OwnTracks puede pasar horas sin mandar nada: el panel muestra el
último dato y "hace cuánto".

**Avisos al celular sin mail (ntfy, gratis):**
1. Instalá **ntfy** en tu celular (App Store / Play Store) → **+** → suscribite a un tema con
   un nombre difícil de adivinar, por ejemplo `thi-casa-8k2p9x` (quien sepa el nombre ve los
   avisos).
2. En el Apps Script → Propiedades del script → `NTFY_TEMA` = ese mismo nombre.
3. Ejecutá `probarAviso`: te tiene que llegar "📍 Thi llegó a Prueba".

Con `NTFY_TEMA` ya no llegan mails (si los querés igual: propiedad `AVISOS_POR_MAIL` = `si`).
El marco además muestra un cartel "📍 Thi llegó a Colegio" cuando cambia de lugar.

## Fotos y panel, alternados

Mientras están las fotos, **cada 10 minutos** aparece el panel Hoy **30 segundos** y vuelve
solo a las fotos (si alguien toca la pantalla en ese rato, se queda en el panel). De noche,
con la pantalla en descanso, no lo hace.

Se prende y apaga **tocando la hora de la barra lateral** → Ajustes (queda guardado en ese
aparato). Los tiempos se cambian en `config.js` → `ALTERNAR: { activo, cadaMinutos, segundosPanel }`.

## Descanso de la pantalla

- **De noche** (por defecto de 23 a 7) la pantalla queda negra. Se prende y apaga desde
  Ajustes (tocando la hora de la barra lateral). Un toque la despierta
  5 minutos (ese primer toque no aprieta nada). Se configura en `config.js` → `DESCANSO`:
  horario, `modo: 'tenue'` en vez de negro, o `noche: false` para no usarlo.
- **Sin nadie cerca**: el marco tiene sensor de movimiento. Cuando lo conectemos (al
  instalarlo en el marco), si no pasa nadie en 20 minutos la pantalla se atenúa, y vuelve
  sola cuando alguien pasa. El sensor avisa llamando a `window.panelMovimiento()`.

## Fotos

- **Horizontal** → pantalla completa.
- **Verticales** → collage de 2, o tríptico de 3 si son finitas (9:16).
  Primero junta fotos del mismo día; las que quedan solas se emparejan entre sí.
- **Panorámicas, cuadradas y verticales sin pareja** → enteras, con la misma
  foto desenfocada de fondo.
- **Un día como hoy** → las fotos de esta fecha de otros años salen primero,
  con el cartel "Hace N años".
- **Videos** (.mov y .mp4 de las mismas carpetas) → enteros, sin sonido, y al
  terminar sigue con las fotos. Los horizontales llenan la pantalla; los verticales
  van con fondo desenfocado. Se saltean:
  - los de menos de 4 segundos (son las Live Photos del iPhone),
  - los de más de 100 MB (tardarían demasiado),
  - los recién subidos que Drive todavía está procesando (aparecen en un rato).

  Cada video se baja una sola vez (por partes, a través del Apps Script) y queda
  guardado en el navegador; se guardan los últimos 15. Si el navegador no puede
  reproducir alguno (por ejemplo, HEVC en un Chrome viejo), lo saltea y no lo
  vuelve a intentar. En `probar()` del Apps Script se ve cuántos videos encontró.
- **Fotos del iPhone acostadas o boca abajo**: algunas HEIC guardan el giro de una
  forma que Drive no lee. El Apps Script lo lee del archivo y el panel las gira.
  Se revisan de a poco al listar; para revisarlas todas de una, ejecutá
  `revisarGiros` desde el editor.
- **Girar a mano**: algunas fotos perdieron el dato de giro (pasadas por WhatsApp,
  editadas…) y nadie puede saber que están acostadas. Mantené apretada la foto
  (en la compu: mantener el clic, o la tecla G) → ↺ / ↻. Queda guardado para siempre.
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

Cada vez que cambies cualquier archivo del Apps Script hay que hacer **Implementar →
Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Guardar no
alcanza: la URL `/exec` sigue usando la última versión publicada (si el panel o la
extensión responden "Acción desconocida", casi siempre es esto).

## Estructura

```
apps-script/   backend (Google Apps Script): Code.gs, Listas.gs y Colegium.gs
web/           lo que muestra el marco (HTML/CSS/JS sin dependencias, compatible con Chrome 106)
  js/layout.js   motor de diseño de diapositivas (función pura)
  js/fuentes.js  de dónde salen las fotos: demo o Drive
  js/fotos.js    slideshow
  js/agenda.js   lógica de la agenda (función pura)
  js/clima.js    clima de Open-Meteo
  js/basquet.js  lógica de la tarjeta de básquet (función pura)
  js/listas.js   lógica de tareas y compras (función pura)
  js/vistas-listas.js  vistas Tareas y Compras
  js/cole.js     lógica de la pantalla Cole (función pura)
  js/vista-cole.js  pantalla Cole
  js/hoy.js      vista "Hoy"
  js/app.js      arranque, barra lateral, inactividad
extension-colegium/  extensión de Chrome que manda los datos de Colegium al panel
test/          tests (`node --test`)
scripts/       generador de imágenes de ejemplo
```
