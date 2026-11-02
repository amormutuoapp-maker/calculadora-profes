'use strict';

/**
 * Calculadora para profesores — botones de suma (T-003, v0.1.0).
 *
 * Conecta la pantalla con el objeto global Calc. Hay tres botones
 * fijos. La etiqueta visible es el importe: se convierte una vez
 * a céntimos con Calc.parseToCents y cada pulsación llama a
 * Calc.addValue con ese entero. Este fichero no suma importes ni
 * hace aritmética con decimales en coma flotante.
 *
 * El total y la lista se vuelven a pintar tras cada pulsación
 * con Calc.formatCents (coma y dos decimales).
 *
 * No hay peticiones de red ni lectura de datos personales.
 * Borrar el último valor y reiniciar no forman parte de esta tarea.
 */

var SUM_BUTTONS = [
  { label: '1', ariaLabel: 'Sumar 1' },
  { label: '0,5', ariaLabel: 'Sumar 0,5' },
  { label: '0,25', ariaLabel: 'Sumar 0,25' }
];

/**
 * Convierte la etiqueta del botón a céntimos con Calc.
 * Si el texto no es un importe válido, la página no arranca:
 * los tres valores son fijos y tienen que ser correctos.
 */
function centsFromLabel(label) {
  var parsed = Calc.parseToCents(label);
  if (!parsed.ok || !Number.isSafeInteger(parsed.cents) || parsed.cents <= 0) {
    throw new Error('No se pudo preparar el botón "' + label + '".');
  }
  return parsed.cents;
}

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function render(totalElement, listElement, placeholderElement, state) {
  var values = Calc.getList(state);
  var index;
  var item;

  totalElement.textContent = Calc.formatCents(Calc.getTotal(state));

  clearChildren(listElement);
  for (index = 0; index < values.length; index += 1) {
    item = document.createElement('li');
    item.textContent = Calc.formatCents(values[index]);
    listElement.appendChild(item);
  }

  placeholderElement.hidden = values.length > 0;
}

function createSumButton(definition, onAdd) {
  var cents = centsFromLabel(definition.label);
  var button = document.createElement('button');

  button.type = 'button';
  button.className = 'sum-button';
  button.textContent = definition.label;
  button.setAttribute('aria-label', definition.ariaLabel);
  button.addEventListener('click', function () {
    onAdd(cents);
  });
  return button;
}

function initApp() {
  var totalElement = document.getElementById('total');
  var listElement = document.getElementById('value-list');
  var placeholderElement = document.getElementById('list-placeholder');
  var buttonsElement = document.getElementById('sum-buttons');
  var state = Calc.createState();
  var index;

  function addCents(cents) {
    state = Calc.addValue(state, cents);
    render(totalElement, listElement, placeholderElement, state);
  }

  for (index = 0; index < SUM_BUTTONS.length; index += 1) {
    buttonsElement.appendChild(createSumButton(SUM_BUTTONS[index], addCents));
  }

  render(totalElement, listElement, placeholderElement, state);
}

initApp();
