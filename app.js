'use strict';

/**
 * Calculadora para profesores — botones de suma, borrar y reiniciar
 * (T-003 y T-004, v0.1.0). En T-005, tras pintar, la lista se
 * desplaza hasta el final dentro de su propia zona.
 *
 * Conecta la pantalla con el objeto global Calc. Hay tres botones
 * fijos de suma. La etiqueta visible es el importe: se convierte una
 * vez a céntimos con Calc.parseToCents y cada pulsación llama a
 * Calc.addValue con ese entero. «Borrar último» llama a
 * Calc.removeLast, sin confirmación. «Reset» pide confirmación con
 * window.confirm y, solo si se acepta, llama a Calc.reset.
 *
 * Este fichero no suma importes ni hace aritmética con decimales
 * en coma flotante. El total y la lista se vuelven a pintar tras
 * cada acción con Calc.formatCents (coma y dos decimales).
 *
 * No hay peticiones de red, ni persistencia, ni lectura de datos
 * personales.
 */

var SUM_BUTTONS = [
  { label: '1', ariaLabel: 'Sumar 1' },
  { label: '0,5', ariaLabel: 'Sumar 0,5' },
  { label: '0,25', ariaLabel: 'Sumar 0,25' }
];

var RESET_CONFIRM_MESSAGE = '¿Reiniciar la calculadora? Se borrarán el total y todos los valores.';

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
  scrollListToEnd(listElement);
}

/**
 * Deja a la vista el último valor. Solo mueve #list-scroll:
 * no usa scrollIntoView, que también puede desplazar la página.
 */
function scrollListToEnd(listElement) {
  var scroller = document.getElementById('list-scroll');
  if (!scroller || !listElement) {
    return;
  }
  scroller.scrollTop = scroller.scrollHeight;
}

function syncRemoveButton(button, state) {
  button.disabled = Calc.getList(state).length === 0;
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

function createRemoveButton(onRemove) {
  var button = document.createElement('button');

  button.type = 'button';
  button.className = 'remove-button';
  button.textContent = 'Borrar último';
  button.setAttribute('aria-label', 'Borrar el último valor');
  button.disabled = true;
  button.addEventListener('click', function () {
    onRemove();
  });
  return button;
}

function createResetButton(onReset) {
  var button = document.createElement('button');

  button.type = 'button';
  button.className = 'reset-button';
  button.textContent = 'Reset';
  button.setAttribute('aria-label', 'Reiniciar la calculadora');
  button.addEventListener('click', function () {
    onReset();
  });
  return button;
}

function initApp() {
  var totalElement = document.getElementById('total');
  var listElement = document.getElementById('value-list');
  var placeholderElement = document.getElementById('list-placeholder');
  var buttonsElement = document.getElementById('sum-buttons');
  var undoElement = document.getElementById('undo-buttons');
  var resetElement = document.getElementById('reset-buttons');
  var state = Calc.createState();
  var index;
  var removeButton;

  function paint() {
    render(totalElement, listElement, placeholderElement, state);
    syncRemoveButton(removeButton, state);
  }

  function addCents(cents) {
    state = Calc.addValue(state, cents);
    paint();
  }

  function removeLastValue() {
    state = Calc.removeLast(state);
    paint();
  }

  function resetAll() {
    var accepted = window.confirm(RESET_CONFIRM_MESSAGE);
    if (!accepted) {
      return;
    }
    state = Calc.reset(state);
    paint();
  }

  for (index = 0; index < SUM_BUTTONS.length; index += 1) {
    buttonsElement.appendChild(createSumButton(SUM_BUTTONS[index], addCents));
  }

  removeButton = createRemoveButton(removeLastValue);
  undoElement.appendChild(removeButton);
  resetElement.appendChild(createResetButton(resetAll));

  paint();
}

initApp();
