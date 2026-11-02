# Calculadora para profesores

Aplicación web para el móvil en la que un profesor podrá sumar valores pulsando botones que defina él (por ejemplo 1, 0,5 y 0,25). Cada pulsación se sumará al total; también se podrá deshacer la última operación y reiniciar con confirmación. El total y la lista de valores quedarán a la vista.

Esta versión (v0.1.0) trae la estructura de la pantalla (T-001), la lógica de suma en céntimos enteros (T-002), tres botones fijos — 1, 0,5 y 0,25 — conectados a esa lógica (T-003) y las acciones de borrar el último valor y reiniciar (T-004). Cada pulsación de suma añade su importe. «Borrar último» quita solo el último valor, sin preguntar. «Reset» pide confirmación y, si se acepta, deja el total en `0,00` y la lista vacía. El total y la lista se actualizan al momento, con coma y dos decimales. No se guarda el estado al cerrar o recargar.

No usa servidor de aplicación, no envía datos y no guarda información personal. Se abre en el navegador, también sin conexión, y no depende de librerías externas.

## Cómo abrirla en local

**Abrir el fichero.** Entra en la carpeta del proyecto y abre `index.html` con el navegador.

**Servirla en local.** Desde la carpeta del proyecto:

```bash
python3 -m http.server
```

El servidor indica el puerto (8000 si está libre). Abre `http://127.0.0.1:8000/` en el navegador.

## Cómo probarla

1. Abre la página con uno de los dos métodos.
2. Comprueba que el total muestra `0,00` y que la lista indica que todavía no hay valores. Hay tres botones de suma: `1`, `0,5` y `0,25`. Debajo, «Borrar último» (desactivado si no hay valores) y, más abajo y a un lado, «Reset».
3. Pulsa `1`, después `0,5` y después `0,25`. El total debe mostrar `1,75` y la lista, en ese orden, `1,00`, `0,50` y `0,25`.
4. Pulsa «Borrar último». El total pasa a `1,50` y la lista queda en `1,00` y `0,50`. No pregunta.
5. Pulsa «Reset» y cancela. El total y la lista no cambian. Pulsa «Reset» y acepta: el total vuelve a `0,00` y se lee otra vez que todavía no hay valores. «Borrar último» queda desactivado.
6. Estrecha la ventana o usa la vista de móvil en vertical. El texto debe verse grande, los botones cómodos de pulsar (al menos 48 px) y el foco visible al recorrerlos con el teclado.

## Lógica de suma

`calc.js` está aparte de la pantalla. No lee la página, no guarda datos y no usa la red. En el navegador queda el objeto global `Calc`. Node lo carga con `require` para las pruebas, sin instalar nada.

Los importes se guardan en céntimos, como enteros. Así 0,1 y 0,2 suman 0,30.

### Formato

`formatCents` escribe siempre dos decimales y usa la coma como separador decimal. No pone separador de miles.

- 150 céntimos → `1,50`
- 30 céntimos → `0,30`
- 25000 céntimos → `250,00`
- 0 céntimos → `0,00`

### Conversión y errores

`parseToCents` acepta un texto o un número. Recorta los espacios de los extremos y admite la coma o el punto. Solo vale un importe mayor que cero, con dos decimales como máximo.

La parte entera y los decimales se leen del texto por separado y se convierten a un entero. No se multiplica un decimal binario por 100.

- Si el valor sirve: `{ ok: true, cents: <entero> }`
- Si no: `{ ok: false, error: "<mensaje en español>" }`

El mensaje indica el motivo: vacío, caracteres no numéricos, negativo, más de un separador, más de dos decimales, cero, valor no finito o demasiado grande para sumarlo con seguridad.

### Estado

`createState` empieza con total 0 y lista vacía. `addValue` añade céntimos y devuelve otro estado; no cambia el anterior. `removeLast` quita el último valor; si la lista está vacía no falla y devuelve el mismo estado. `reset` deja el total a 0 y la lista vacía. `getTotal` y `getList` leen el estado. El total es la suma entera de la lista.

## Botones de esta versión

La pantalla crea tres botones fijos: `1`, `0,5` y `0,25`. La etiqueta visible es el importe. Al arrancar, `app.js` la convierte a céntimos con `parseToCents` y, en cada pulsación, pasa ese entero a `addValue`. No suma decimales en coma flotante.

Después de cada suma, de borrar el último valor o de aceptar el reinicio se vuelven a pintar el total (`#total`) y la lista (`#value-list`) con `formatCents`. Al abrir la página el total es `0,00` y, si no hay valores, se lee el texto de lista vacía. Los botones miden al menos 48 px, el texto es grande y el foco se ve al navegar con el teclado. El total tiene `aria-live` para anunciar el cambio.

«Borrar último» llama a `removeLast` y no pide confirmación. Si la lista está vacía, el botón queda desactivado; al sumar se activa y, al vaciar la lista, se desactiva otra vez. «Reset» está en otro bloque, más abajo y alineado al final, con borde distinto. Antes de llamar a `reset` pregunta con `window.confirm`. Si se cancela, no cambia nada. Si se acepta, el total queda en `0,00` y vuelve el texto de lista vacía. No se guarda nada entre visitas.

## Cómo ejecutar las pruebas

Desde la carpeta del proyecto:

```bash
node tests/calc.test.js
```

No hace falta instalar nada. Si una prueba falla, el proceso termina con un código distinto de cero. La carpeta `tests/` no forma parte de la página.

## Ficheros

- `index.html` — página
- `style.css` — presentación para móvil
- `app.js` — botones de suma, borrar último, reinicio, total y lista, conectados a Calc
- `calc.js` — suma en céntimos, sin interfaz
- `tests/calc.test.js` — pruebas de la lógica, con Node
