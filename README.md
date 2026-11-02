# Calculadora para profesores

Aplicación web para el móvil en la que un profesor suma valores pulsando botones que define él. Cada pulsación se suma al total. Puede borrar el último valor y reiniciar con confirmación. El total y la lista de valores quedan a la vista.

Esta versión (v0.3.0) mantiene la suma en céntimos (T-002), borrar el último valor y reiniciar (T-004), la pantalla de móvil en vertical (T-005), el número de pregunta (T-007) y los botones definidos por el profesor (T-008). Añade las plantillas de botones (T-009) y actualizar la plantilla en uso (T-010).

Cada pulsación de suma añade su importe. «Borrar último» quita solo el último valor, sin preguntar. «Reset» pide confirmación y, si se acepta, deja el total en `0,00` y la lista vacía. El total y la lista se actualizan al momento, con coma y dos decimales. Cada línea se numera al pintarla según su posición, por ejemplo `P1: 1,00`. La página ocupa la altura de la pantalla: el total queda arriba, los botones abajo y solo la lista se desplaza. Tras añadir o borrar, la lista muestra el último valor.

## Qué se guarda y qué no

Se guardan solo las plantillas de botones, en el almacén local del navegador, con una sola clave: `calculadora-profes:v1`. El valor es un JSON con la versión (`1`), la lista de plantillas (nombre y botones en céntimos) y la última usada (`lastUsed`).

No se guarda el total, ni la lista de la suma, ni ningún dato personal. Cargar una plantilla cambia los botones de la calculadora y no toca el total ni la lista. Al recargar, el total vuelve a `0,00` y la lista queda vacía.

Una plantilla es un nombre y una lista de botones. «Usada» significa cargada, recién guardada o recién actualizada. Editar los botones no cambia la plantilla guardada hasta que se pulsa «Actualizar plantilla». Esa acción sustituye los botones de la plantilla en uso: el nombre no cambia y sigue siendo la última usada. Si no hay plantilla en uso, el botón queda desactivado. Si los botones actuales ya son los guardados —mismos céntimos y mismo orden—, no se pide confirmación y no se escribe. Un orden distinto sí cuenta como cambio: no se reordenan ni se comparan como un conjunto, porque el orden es el de la pantalla. Al recargar se ven los botones tal como quedaron en la última plantilla usada, no los editados después si no se actualizó.

Al abrir, si hay una última plantilla usada, sus botones son los de la calculadora. Si no hay ninguna, si se borró o si los datos no se pueden leer, salen 1, 0,5 y 0,25 (en pantalla, `1,00`, `0,50` y `0,25`). Esos tres no tienen trato especial: se editan y se quitan como cualquier otro.

Leer no escribe. Si el texto no es JSON, la versión o la estructura no valen, o alguna plantilla tiene un nombre o unos botones que no pasan la validación, no se borra lo que había en el dispositivo. Las plantillas inválidas se ignoran y las válidas se usan. La primera acción que sí guarda (guardar una plantilla nueva, cargarla, renombrarla, borrarla o actualizarla) escribe un documento válido y, a partir de ese momento, sustituye el valor anterior. Actualizar escribe el documento nuevo y solo entonces cambia la memoria: si la escritura falla, la plantilla en memoria sigue igual.

Si el almacén no existe, el acceso lanza o la escritura lanza (por ejemplo, no queda espacio), la calculadora sigue: se puede sumar, borrar y reiniciar. Un aviso en la pantalla explica que no se recordarán las plantillas. No se usa una ventana de aviso para esos fallos ni para los errores de nombre.

## Límites de los botones

Confirmados por el dueño:

- De 1 a 12 botones.
- Cada valor va de 0,01 a 100, ambos inclusive.
- No se admiten duplicados. Se comparan en céntimos: `0,5` y `.5` son el mismo botón.
- No se puede quitar el último. Con un solo botón, «Quitar» queda desactivado y se vuelve a activar al añadir otro.

Esos topes están en `calc.js` como `MIN_CENTS`, `MAX_CENTS`, `MIN_BUTTONS` y `MAX_BUTTONS`. Cada plantilla vuelve a pasar por esa misma validación al guardarse y al leerse.

El máximo de 100 es del botón, no del total. La suma puede pasar de 100 (por ejemplo, mil veces 0,25 son 250,00).

## Límites de las plantillas

En `storage.js`:

- `STORAGE_KEY`: `calculadora-profes:v1`
- `STORAGE_VERSION`: 1
- `MAX_TEMPLATES`: 20. La número 21 se rechaza.
- `MIN_TEMPLATE_NAME_LENGTH`: 1
- `MAX_TEMPLATE_NAME_LENGTH`: 30, después de quitar espacios de los extremos. Se guarda el nombre ya recortado. La cuenta es la de JavaScript (`length`, unidades UTF-16), la misma que usa el campo. El campo admite hasta 40 caracteres para que un nombre de 31 se pueda escribir y el error salga junto al campo, no para guardarlo.

Dos nombres que solo se distinguen por las mayúsculas cuentan como el mismo. La comparación usa `toLocaleLowerCase('es')`: el idioma va fijo para que el resultado sea el mismo en el móvil y en las pruebas, sin depender del idioma del sistema. El acento no se quita: «Áula» y «Aula» son distintos; «Aula» y «AULA» son el mismo. Al renombrar, el nombre de esa plantilla —aunque solo cambien las mayúsculas— no choca consigo mismo.

Los errores de nombre (vacío, solo espacios, más de 30 caracteres, repetido o plantilla número 21) salen junto al campo, con `aria-invalid` y `aria-describedby`. Borrar una plantilla pide confirmación, igual que Reset. Actualizar también pregunta, con el texto `¿Actualizar «nombre» con los botones actuales?`, y solo si los botones han cambiado. Si se cancela, no cambia ni la memoria ni el almacén. Guardar, cargar y renombrar no preguntan. El nombre de la plantilla en uso se ve en la pantalla de plantillas y se actualiza al guardar, cargar, renombrar o borrar. Si no hay ninguna, se lee «Ninguna plantilla en uso» y «Actualizar plantilla» lleva `disabled` y `aria-disabled="true"`.

## Cómo abrirla en local

**Abrir el fichero.** Entra en la carpeta del proyecto y abre `index.html` con el navegador.

**Servirla en local.** Desde la carpeta del proyecto:

```bash
python3 -m http.server
```

El servidor indica el puerto (8000 si está libre). Abre `http://127.0.0.1:8000/` en el navegador.

## Cómo probarla

1. Abre la página con uno de los dos métodos.
2. Comprueba que el total muestra `0,00` y que la lista indica que todavía no hay valores. Hay tres botones de suma: `1,00`, `0,50` y `0,25`. Junto a ellos, «Configurar botones» y «Borrar último» (desactivado si no hay valores). «Reset» está en la misma franja inferior, apartado, con borde distinto.
3. Pulsa `1,00`, después `0,50` y después `0,25`. El total debe mostrar `1,75` y la lista, en ese orden, `P1: 1,00`, `P2: 0,50` y `P3: 0,25`.
4. Pulsa «Borrar último». El total pasa a `1,50` y la lista queda en `P1: 1,00` y `P2: 0,50`. No pregunta.
5. Pulsa «Reset» y cancela. El total y la lista no cambian. Pulsa «Reset» y acepta: el total vuelve a `0,00` y se lee otra vez que todavía no hay valores. «Borrar último» queda desactivado.
6. Pulsa «Configurar botones». Añade `2`, edita `0,50` y cámbialo por `0,1`, y quita `0,25`. «Volver a la calculadora»: los botones de suma son los nuevos. Si habías sumado antes de configurarlos, el total y la lista siguen igual.
7. Prueba un valor que no sirva (`abc`, `1.234`, `0`, `-1`, `100,01` o un duplicado). El aviso sale junto al campo, en rojo, y no se crea ni se cambia el botón. No aparece una ventana de aviso.
8. Llega a 12 botones: el siguiente valor válido se rechaza con un texto que dice que no se pueden tener más de 12. Quita botones hasta dejar uno: «Quitar» de ese botón está desactivado, pulsarlo no hace nada y, al añadir otro, «Quitar» vuelve a poder usarse.
9. En «Configurar botones», entra en «Plantillas». Escribe `Aula` y pulsa «Guardar plantilla nueva». Cambia los botones (por ejemplo, deja solo `2,00`), vuelve a Plantillas y guarda `Grupo`. Pulsa «Cargar» en `Aula`. Los botones de la calculadora pasan a ser los de `Aula`. El total y la lista no cambian. Recarga la página: se ven los botones guardados de `Aula`, el total `0,00` y la lista vacía. `Grupo` sigue guardado con los botones que tenía al crearla. Editar después no la modifica hasta pulsar «Actualizar plantilla».
10. Renombra una plantilla a un nombre válido. Prueba el mismo nombre de otra con otras mayúsculas, un nombre vacío y uno de 31 caracteres: el texto rojo queda junto al campo. Renombrar la propia plantilla cambiando solo mayúsculas sí se puede. Borrar pregunta: si cancelas, sigue ahí; si aceptas, desaparece. Con 20 plantillas, la siguiente se rechaza con un texto junto al campo.
11. Con una plantilla en uso, cambia los botones y pulsa «Actualizar plantilla». Si cancelas, lo guardado sigue igual. Si aceptas, esa plantilla queda con los botones de ahora, el nombre no cambia y el total y la lista siguen igual. Vuelve a pulsar «Actualizar plantilla» sin cambiar nada: no pregunta y un texto dice que ya tiene esos botones. Si no hay plantilla en uso, el botón está desactivado.
12. Si el almacén del navegador no se puede usar, la página abre igual, se puede sumar y un aviso rojo explica que las plantillas no se recordarán. Si falla al actualizar, el aviso es el mismo tipo de texto (no una ventana) y la plantilla en memoria no cambia.
13. Ábrela en el móvil en vertical (o estrecha la ventana, entre unos 320 y 430 px de ancho). El total, los botones de suma y «Borrar último» siguen a la vista aunque la lista sea larga: solo se desplaza la lista, y el último valor queda visible. «Reset» también se alcanza sin mover la página, separado de la suma. Los botones miden al menos 48 px y el foco se ve al recorrerlos con el teclado. Con 12 botones, la zona de suma es una rejilla de 3 columnas (4 filas). El campo del nombre usa 18 px para que el móvil no haga zoom al escribir.

## Lógica de suma

`calc.js` está aparte de la pantalla. No lee la página, no guarda datos y no usa la red. En el navegador queda el objeto global `Calc`. Node lo carga con `require` para las pruebas, sin instalar nada.

Los importes se guardan en céntimos, como enteros. Así 0,1 y 0,2 suman 0,30.

### Formato

`formatCents` escribe siempre dos decimales y usa la coma como separador decimal. No pone separador de miles. Los botones de suma usan ese mismo formato.

- 150 céntimos → `1,50`
- 30 céntimos → `0,30`
- 25000 céntimos → `250,00`
- 0 céntimos → `0,00`

### Conversión y errores

`parseToCents` acepta un texto o un número. Recorta los espacios de los extremos y admite la coma o el punto. `.5` vale 0,50 y `1,` vale 1,00. La coma y el punto se tratan igual, así que `,5` y `1.` también valen. Solo vale un importe mayor que cero, con dos decimales como máximo. Rechaza el cero, los negativos, el texto, la notación científica (`1e2`) y más de un separador.

La parte entera y los decimales se leen del texto por separado y se convierten a un entero. No se multiplica un decimal binario por 100.

- Si el valor sirve: `{ ok: true, cents: <entero> }`
- Si no: `{ ok: false, error: "<mensaje en español>" }`

El mensaje indica el motivo: vacío, caracteres no numéricos, negativo, notación científica, más de un separador, más de dos decimales, cero, formato incompleto (un punto o una coma solos), valor no finito o demasiado grande para sumarlo con seguridad.

### Validación de un botón

`validateButtonValue(texto, céntimosYaUsados)` se apoya en `parseToCents` y además exige el rango 0,01–100 y que el valor no esté ya en otro botón. Devuelve `{ ok: true, cents }` o `{ ok: false, error }`.

`addButton`, `updateButton` y `removeButton` aplican esa validación. Devuelven una lista nueva y no modifican la que reciben. `removeButton` rechaza quitar el botón si solo queda uno. `addButton` rechaza el botón número 13. Un texto inválido no añade ni cambia nada, aunque ya haya 12 botones: en ese caso el mensaje explica el texto, no el cupo. Si el texto es válido y ya hay 12, el mensaje explica el máximo.

`createDefaultButtons` devuelve 100, 50 y 25 céntimos (1, 0,5 y 0,25).

### Estado de la suma

`createState` empieza con total 0 y lista vacía. `addValue` añade céntimos y devuelve otro estado; no cambia el anterior. `removeLast` quita el último valor; si la lista está vacía no falla y devuelve el mismo estado. `reset` deja el total a 0 y la lista vacía. `getTotal` y `getList` leen el estado. El total es la suma entera de la lista.

La lista de botones y la lista de la suma son independientes. Cambiar los botones, cargar una plantilla o actualizarla a mitad de una suma no modifica el total ni los valores ya apuntados.

## Plantillas

`storage.js` también está aparte de la pantalla. Recibe el almacén por parámetro (`createRepository(almacén)`), así las pruebas usan un objeto en memoria y no hace falta el navegador. En la página, `openBrowserStorage` obtiene el almacén del navegador y, si el acceso lanza, devuelve null. La pantalla solo habla con `ButtonStore`.

Al guardar, el nombre se recorta y los botones se validan otra vez con `formatCents` y `addButton`. Al leer, cada plantilla se valida de nuevo. Un fallo de lectura o un documento dañado no llama a la escritura. `setItem` va dentro de try/catch: si lanza, el cambio se deshace en memoria y la pantalla muestra el aviso.

`updateTemplateButtons` actualiza solo la plantilla en uso. Valida los botones antes de escribir. Si son los mismos céntimos en el mismo orden, no llama a `setItem`. Si hay que guardarlos, escribe primero y solo entonces sustituye la lista en memoria; el nombre y `lastUsed` se quedan. Si `setItem` lanza, la memoria no llega a cambiar. `planTemplateUpdate` es la decisión pura que usa la pantalla: sin plantilla o con botones inválidos rechaza; si no hay cambios responde `unchanged` (sin confirmación); si hay cambios y aún no se ha confirmado responde `cancel` y no se debe escribir; con confirmación responde `update`.

## Botones en la pantalla

La etiqueta visible es el importe con dos decimales (`1,00`, `0,50`, `0,25`). Al pulsar, `app.js` pasa los céntimos ya validados a `addValue`. No suma decimales en coma flotante.

«Configurar botones» abre una pantalla y «Volver a la calculadora» la cierra. Ahí se escribe el valor (teclado decimal), se añade, se edita o se quita. Si el valor no sirve, el texto del error queda junto al campo, enlazado con `aria-describedby`, y el campo queda `aria-invalid`. No se usa una ventana de aviso para esos errores. Con un solo botón, «Quitar» lleva el atributo `disabled` y `aria-disabled="true"`. Desde esa pantalla, «Plantillas» abre el guardado de nombres y «Actualizar plantilla».

La zona de suma es una rejilla de 3 columnas. Entre 320 y 430 px de ancho cada botón mide más de 48 px de ancho y de alto, y cabe el texto `100,00`. Doce botones ocupan 4 filas y siguen en la franja inferior, con el total arriba.

Después de cada suma, de borrar el último valor o de aceptar el reinicio se vuelven a pintar el total (`#total`) y la lista (`#value-list`). El importe usa `formatCents`. Delante va el número de pregunta, que es la posición en la lista (índice + 1) en ese momento: `P1: 1,00`, `P2: 0,50`. No se guarda en el estado de Calc. El lector de pantalla oye «Pregunta 1: 1,00». Borrar el último quita esa pregunta; al reiniciar, la siguiente vuelve a ser `P1`. Al abrir la página el total es `0,00` y, si no hay valores, se lee el texto de lista vacía. Los botones miden al menos 48 px, los campos de configurar y de nombre usan un tamaño de letra de 18 px para que el móvil no haga zoom, y el foco se ve al navegar con el teclado. El total tiene `aria-live` para anunciar el cambio. El nombre de una plantilla se escribe como texto, nunca como HTML.

«Borrar último» llama a `removeLast` y no pide confirmación. Si la lista está vacía, el botón queda desactivado; al sumar se activa y, al vaciar la lista, se desactiva otra vez. «Reset» queda en la franja de abajo, alineado al final y separado de la suma, con borde distinto, para no pulsarlo al buscar un importe. Antes de llamar a `reset` pregunta con `window.confirm`. Si se cancela, no cambia nada. Si se acepta, el total queda en `0,00` y vuelve el texto de lista vacía. Borrar una plantilla pregunta igual; cancelar no la quita. «Actualizar plantilla» pregunta solo cuando los botones cambian; cancelar no escribe. El nombre en uso se pinta con `textContent`.

## Cómo ejecutar las pruebas

Desde la carpeta del proyecto, sin instalar nada:

```bash
node tests/calc.test.js
node tests/buttons.test.js
node tests/storage.test.js
```

Si una prueba falla, el proceso termina con un código distinto de cero. La carpeta `tests/` no forma parte de la página. `tests/storage.test.js` cubre guardar, cargar, renombrar y borrar; nombres repetidos y el renombrado a sí misma; los límites de 30 caracteres y de 20 plantillas; un JSON dañado o con otra versión, que no se borra al leer; un almacén que falla al leer, al escribir o que no está; plantillas con botones inválidos que se descartan; la última usada al abrir de nuevo el mismo almacén; que la suma no entra en lo guardado; y actualizar la plantilla en uso (T-010): con botones nuevos, sin plantilla, sin cambios (no llama a `setItem`), con `setItem` que lanza, con botones inválidos, tras reabrir el mismo almacén, sin cambiar el nombre ni las demás plantillas, y la decisión de cancelar sin escribir.

## Ficheros

- `index.html` — página: calculadora, configurar botones y plantillas
- `style.css` — presentación para móvil, incluida la rejilla de 3 columnas
- `app.js` — botones de suma, configurar, plantillas, borrar último, reinicio, total y lista
- `calc.js` — suma en céntimos y validación de botones, sin interfaz
- `storage.js` — plantillas, sin interfaz; el almacén se inyecta
- `tests/calc.test.js` — pruebas de la suma, con Node
- `tests/buttons.test.js` — pruebas de los botones del profesor, con Node
- `tests/storage.test.js` — pruebas de las plantillas, con Node
