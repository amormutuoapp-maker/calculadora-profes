# Calculadora para profesores

Aplicación web para el móvil en la que un profesor suma valores pulsando botones que define él. Cada pulsación se suma al total. Puede borrar el último valor y reiniciar con confirmación. El total y la lista de valores quedan a la vista.

Esta versión (v0.2.0) mantiene la suma en céntimos (T-002), borrar el último valor y reiniciar (T-004), la pantalla de móvil en vertical (T-005) y el número de pregunta (T-007). Añade los botones definidos por el profesor (T-008). Al abrir hay tres botones: 1, 0,5 y 0,25. En «Configurar botones» se añaden, editan y quitan. La calculadora usa esos botones. No tienen trato especial: los tres iniciales se editan y se borran como cualquier otro.

Cada pulsación de suma añade su importe. «Borrar último» quita solo el último valor, sin preguntar. «Reset» pide confirmación y, si se acepta, deja el total en `0,00` y la lista vacía. El total y la lista se actualizan al momento, con coma y dos decimales. Cada línea se numera al pintarla según su posición, por ejemplo `P1: 1,00`. La página ocupa la altura de la pantalla: el total queda arriba, los botones abajo y solo la lista se desplaza. Tras añadir o borrar, la lista muestra el último valor.

Nada se guarda. Los botones y la suma viven solo en memoria: al recargar vuelven 1, 0,5 y 0,25, el total a `0,00` y la lista vacía. No usa servidor de aplicación, no envía datos y no guarda información personal. Se abre en el navegador, también sin conexión, y no depende de librerías externas.

## Límites de los botones

Confirmados por el dueño:

- De 1 a 12 botones.
- Cada valor va de 0,01 a 100, ambos inclusive.
- No se admiten duplicados. Se comparan en céntimos: `0,5` y `.5` son el mismo botón.
- No se puede quitar el último. Con un solo botón, «Quitar» queda desactivado y se vuelve a activar al añadir otro.

Esos topes están en `calc.js` como `MIN_CENTS`, `MAX_CENTS`, `MIN_BUTTONS` y `MAX_BUTTONS`.

El máximo de 100 es del botón, no del total. La suma puede pasar de 100 (por ejemplo, mil veces 0,25 son 250,00).

## Cómo abrirla en local

**Abrir el fichero.** Entra en la carpeta del proyecto y abre `index.html` con el navegador.

**Servirla en local.** Desde la carpeta del proyecto:

```bash
python3 -m http.server
```

El servidor indica el puerto (8000 si está libre). Abre `http://127.0.0.1:8000/` en el navegador.

## Cómo probarla

1. Abre la página con uno de los dos métodos.
2. Comprueba que el total muestra `0,00` y que la lista indica que todavía no hay valores. Hay tres botones de suma: `1,00`, `0,50` y `0,25` (1, 0,5 y 0,25 con dos decimales). Junto a ellos, «Configurar botones» y «Borrar último» (desactivado si no hay valores). «Reset» está en la misma franja inferior, apartado, con borde distinto.
3. Pulsa `1,00`, después `0,50` y después `0,25`. El total debe mostrar `1,75` y la lista, en ese orden, `P1: 1,00`, `P2: 0,50` y `P3: 0,25`.
4. Pulsa «Borrar último». El total pasa a `1,50` y la lista queda en `P1: 1,00` y `P2: 0,50`. No pregunta.
5. Pulsa «Reset» y cancela. El total y la lista no cambian. Pulsa «Reset» y acepta: el total vuelve a `0,00` y se lee otra vez que todavía no hay valores. «Borrar último» queda desactivado.
6. Pulsa «Configurar botones». Añade `2`, edita `0,50` y cámbialo por `0,1`, y quita `0,25`. «Volver a la calculadora»: los botones de suma son los nuevos. Si habías sumado antes de configurarlos, el total y la lista siguen igual.
7. Prueba un valor que no sirva (`abc`, `1.234`, `0`, `-1`, `100,01` o un duplicado). El aviso sale junto al campo, en rojo, y no se crea ni se cambia el botón. No aparece una ventana de aviso.
8. Llega a 12 botones: el siguiente valor válido se rechaza con un texto que dice que no se pueden tener más de 12. Quita botones hasta dejar uno: «Quitar» de ese botón está desactivado, pulsarlo no hace nada y, al añadir otro, «Quitar» vuelve a poder usarse.
9. Recarga la página. Vuelven los botones `1,00`, `0,50` y `0,25`, el total `0,00` y la lista vacía.
10. Ábrela en el móvil en vertical (o estrecha la ventana, entre unos 320 y 430 px de ancho). El total, los botones de suma y «Borrar último» siguen a la vista aunque la lista sea larga: solo se desplaza la lista, y el último valor queda visible. «Reset» también se alcanza sin mover la página, separado de la suma. Los botones miden al menos 48 px y el foco se ve al recorrerlos con el teclado. Con 12 botones, la zona de suma es una rejilla de 3 columnas (4 filas): cada uno sigue pudiendo pulsarse.

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

La lista de botones y la lista de la suma son independientes. Cambiar los botones a mitad de una suma no modifica el total ni los valores ya apuntados.

## Botones en la pantalla

La etiqueta visible es el importe con dos decimales (`1,00`, `0,50`, `0,25`). Al pulsar, `app.js` pasa los céntimos ya validados a `addValue`. No suma decimales en coma flotante.

«Configurar botones» abre una pantalla y «Volver a la calculadora» la cierra. Ahí se escribe el valor (teclado decimal), se añade, se edita o se quita. Si el valor no sirve, el texto del error queda junto al campo, enlazado con `aria-describedby`, y el campo queda `aria-invalid`. No se usa una ventana de aviso para esos errores. Con un solo botón, «Quitar» lleva el atributo `disabled` y `aria-disabled="true"`.

La zona de suma es una rejilla de 3 columnas. Entre 320 y 430 px de ancho cada botón mide más de 48 px de ancho y de alto, y cabe el texto `100,00`. Doce botones ocupan 4 filas y siguen en la franja inferior, con el total arriba.

Después de cada suma, de borrar el último valor o de aceptar el reinicio se vuelven a pintar el total (`#total`) y la lista (`#value-list`). El importe usa `formatCents`. Delante va el número de pregunta, que es la posición en la lista (índice + 1) en ese momento: `P1: 1,00`, `P2: 0,50`. No se guarda en el estado de Calc. El lector de pantalla oye «Pregunta 1: 1,00». Borrar el último quita esa pregunta; al reiniciar, la siguiente vuelve a ser `P1`. Al abrir la página el total es `0,00` y, si no hay valores, se lee el texto de lista vacía. Los botones miden al menos 48 px, el campo de configurar usa un tamaño de letra de 18 px para que el móvil no haga zoom, y el foco se ve al navegar con el teclado. El total tiene `aria-live` para anunciar el cambio.

«Borrar último» llama a `removeLast` y no pide confirmación. Si la lista está vacía, el botón queda desactivado; al sumar se activa y, al vaciar la lista, se desactiva otra vez. «Reset» queda en la franja de abajo, alineado al final y separado de la suma, con borde distinto, para no pulsarlo al buscar un importe. Antes de llamar a `reset` pregunta con `window.confirm`. Si se cancela, no cambia nada. Si se acepta, el total queda en `0,00` y vuelve el texto de lista vacía. No se guarda nada entre visitas.

## Cómo ejecutar las pruebas

Desde la carpeta del proyecto, sin instalar nada:

```bash
node tests/calc.test.js
node tests/buttons.test.js
```

Si una prueba falla, el proceso termina con un código distinto de cero. La carpeta `tests/` no forma parte de la página.

## Ficheros

- `index.html` — página: calculadora y pantalla de configurar botones
- `style.css` — presentación para móvil, incluida la rejilla de 3 columnas
- `app.js` — botones de suma, configurar, borrar último, reinicio, total y lista
- `calc.js` — suma en céntimos y validación de botones, sin interfaz
- `tests/calc.test.js` — pruebas de la suma, con Node
- `tests/buttons.test.js` — pruebas de los botones del profesor, con Node
