# Calculadora para profesores

Aplicación web para el móvil en la que un profesor podrá sumar valores pulsando botones que defina él (por ejemplo 1, 0,5 y 0,25). Cada pulsación se sumará al total; también se podrá deshacer la última operación y reiniciar con confirmación. El total y la lista de valores quedarán a la vista.

Esta versión (v0.1.0) solo trae la estructura de la pantalla: la zona del total, la lista y el hueco de los botones. Todavía no suma.

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
2. Comprueba que se ven el título, la zona **Total** (con un marcador vacío), la zona **Lista de valores** (sin importes) y un contenedor reservado a los botones.
3. En esta versión no hay botones de suma: el total no cambia al tocar la pantalla.
4. Estrecha la ventana o usa la vista de móvil en vertical. El texto debe verse grande y con contraste alto.

## Ficheros

- `index.html` — página
- `style.css` — presentación para móvil
- `app.js` — esqueleto del programa, sin lógica de suma
