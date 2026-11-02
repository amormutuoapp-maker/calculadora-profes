'use strict';

/**
 * Calculadora para profesores — pantalla (T-003, T-004, T-005, T-007
 * y T-008, v0.2.0).
 *
 * Conecta la página con el objeto global Calc. Los botones de suma
 * salen de la lista en memoria (al arrancar: 1, 0,5 y 0,25). Cada
 * pulsación llama a Calc.addValue con los céntimos de ese botón.
 * «Borrar último» llama a Calc.removeLast, sin confirmación. «Reset»
 * pide confirmación con window.confirm y, solo si se acepta, llama
 * a Calc.reset.
 *
 * «Configurar botones» abre otra pantalla para añadir, editar y quitar
 * valores. La validación es la de Calc (validateButtonValue, addButton,
 * updateButton, removeButton). Un texto inválido no crea ni cambia un
 * botón. Con un solo botón, Quitar queda desactivado. Cambiar los
 * botones no toca el total ni la lista de la suma.
 *
 * La etiqueta visible de cada botón de suma es Calc.formatCents
 * (coma y dos decimales): 1 → «1,00», 0,5 → «0,50», 0,25 → «0,25».
 * El número de pregunta (P1, P2, ...) es el índice más uno al pintar;
 * no se guarda en Calc.
 *
 * El estado vive solo en memoria: al recargar vuelven los tres botones
 * iniciales y la suma vacía. No hay peticiones de red ni datos personales.
 */

var RESET_CONFIRM_MESSAGE = '¿Reiniciar la calculadora? Se borrarán el total y todos los valores.';

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Texto visible y nombre para el lector de pantalla.
 * El número es la posición (índice + 1) al pintar, no un dato aparte.
 */
function listItemLabels(index, cents) {
  var amount = Calc.formatCents(cents);
  var number = index + 1;
  return {
    text: 'P' + number + ': ' + amount,
    ariaLabel: 'Pregunta ' + number + ': ' + amount
  };
}

function render(totalElement, listElement, placeholderElement, state) {
  var values = Calc.getList(state);
  var index;
  var item;
  var labels;

  totalElement.textContent = Calc.formatCents(Calc.getTotal(state));

  clearChildren(listElement);
  for (index = 0; index < values.length; index += 1) {
    labels = listItemLabels(index, values[index]);
    item = document.createElement('li');
    item.textContent = labels.text;
    item.setAttribute('aria-label', labels.ariaLabel);
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

function createSumButton(cents, onAdd) {
  var label = Calc.formatCents(cents);
  var button = document.createElement('button');

  button.type = 'button';
  button.className = 'sum-button';
  button.textContent = label;
  button.setAttribute('aria-label', 'Sumar ' + label);
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
  var calculatorScreen = document.getElementById('calculator-screen');
  var configScreen = document.getElementById('config-screen');
  var openConfigButton = document.getElementById('open-config');
  var backButton = document.getElementById('config-back');
  var form = document.getElementById('button-form');
  var valueInput = document.getElementById('button-value');
  var valueError = document.getElementById('button-value-error');
  var valueLabel = document.getElementById('button-value-label');
  var saveButton = document.getElementById('button-save');
  var cancelButton = document.getElementById('button-cancel');
  var editNote = document.getElementById('edit-note');
  var configNote = document.getElementById('config-note');
  var configList = document.getElementById('config-list');
  var state = Calc.createState();
  var buttons = Calc.createDefaultButtons();
  var editingIndex = null;
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

  function renderSumButtons() {
    var index;
    clearChildren(buttonsElement);
    for (index = 0; index < buttons.length; index += 1) {
      buttonsElement.appendChild(createSumButton(buttons[index], addCents));
    }
  }

  function showFieldError(message) {
    valueError.textContent = message;
    valueInput.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError() {
    valueError.textContent = '';
    valueInput.setAttribute('aria-invalid', 'false');
  }

  function renderConfigNote() {
    if (buttons.length >= Calc.MAX_BUTTONS) {
      configNote.textContent = 'Hay ' + buttons.length + ' botones, el máximo. No se puede añadir otro: quita uno si quieres un valor nuevo.';
      return;
    }
    if (buttons.length <= Calc.MIN_BUTTONS) {
      configNote.textContent = 'Queda un botón. No se puede quitar porque tiene que haber al menos uno. Quitar está desactivado.';
      return;
    }
    configNote.textContent = 'Hay ' + buttons.length + ' botones. El mínimo es ' + Calc.MIN_BUTTONS + ' y el máximo es ' + Calc.MAX_BUTTONS + '.';
  }

  function exitEditMode() {
    editingIndex = null;
    valueInput.value = '';
    valueLabel.textContent = 'Nuevo valor';
    saveButton.textContent = 'Añadir';
    cancelButton.hidden = true;
    editNote.hidden = true;
    editNote.textContent = '';
    clearFieldError();
  }

  function startEdit(index) {
    var label = Calc.formatCents(buttons[index]);
    editingIndex = index;
    valueInput.value = label;
    valueLabel.textContent = 'Valor del botón';
    saveButton.textContent = 'Guardar';
    cancelButton.hidden = false;
    editNote.hidden = false;
    editNote.textContent = 'Estás editando el botón ' + label + '. Si el valor no sirve, no se cambia.';
    clearFieldError();
    valueInput.focus();
  }

  function rememberButtons(next, removedIndex) {
    buttons = next;
    if (editingIndex !== null) {
      if (removedIndex === editingIndex) {
        exitEditMode();
      } else if (removedIndex < editingIndex) {
        editingIndex -= 1;
      }
    }
    renderSumButtons();
    renderConfigNote();
    renderConfigList();
  }

  function createConfigRow(index) {
    var row = document.createElement('li');
    var value = document.createElement('p');
    var editBtn = document.createElement('button');
    var removeBtn = document.createElement('button');
    var label = Calc.formatCents(buttons[index]);
    var onlyOne = buttons.length <= Calc.MIN_BUTTONS;

    row.className = 'config-row';

    value.className = 'config-value';
    value.textContent = label;

    editBtn.type = 'button';
    editBtn.className = 'config-edit';
    editBtn.textContent = 'Editar';
    editBtn.setAttribute('aria-label', 'Editar el botón ' + label);
    editBtn.addEventListener('click', function () {
      startEdit(index);
    });

    removeBtn.type = 'button';
    removeBtn.className = 'config-remove';
    removeBtn.textContent = 'Quitar';
    removeBtn.setAttribute('aria-label', 'Quitar el botón ' + label);
    removeBtn.disabled = onlyOne;
    removeBtn.setAttribute('aria-disabled', onlyOne ? 'true' : 'false');
    removeBtn.addEventListener('click', function () {
      var result;
      if (removeBtn.disabled) {
        return;
      }
      result = Calc.removeButton(buttons, index);
      if (!result.ok) {
        renderConfigNote();
        return;
      }
      rememberButtons(result.buttons, index);
    });

    row.appendChild(value);
    row.appendChild(editBtn);
    row.appendChild(removeBtn);
    return row;
  }

  function renderConfigList() {
    var index;
    clearChildren(configList);
    for (index = 0; index < buttons.length; index += 1) {
      configList.appendChild(createConfigRow(index));
    }
  }

  function openConfig() {
    calculatorScreen.hidden = true;
    configScreen.hidden = false;
    renderConfigNote();
    renderConfigList();
    valueInput.focus();
  }

  function closeConfig() {
    configScreen.hidden = true;
    calculatorScreen.hidden = false;
    renderSumButtons();
    scrollListToEnd(listElement);
    openConfigButton.focus();
  }

  function onSubmit(event) {
    var result;
    event.preventDefault();
    if (editingIndex === null) {
      result = Calc.addButton(buttons, valueInput.value);
    } else {
      result = Calc.updateButton(buttons, editingIndex, valueInput.value);
    }
    if (!result.ok) {
      showFieldError(result.error);
      return;
    }
    buttons = result.buttons;
    exitEditMode();
    renderSumButtons();
    renderConfigNote();
    renderConfigList();
    valueInput.focus();
  }

  removeButton = createRemoveButton(removeLastValue);
  undoElement.appendChild(removeButton);
  resetElement.appendChild(createResetButton(resetAll));
  renderSumButtons();
  paint();

  openConfigButton.addEventListener('click', openConfig);
  backButton.addEventListener('click', closeConfig);
  cancelButton.addEventListener('click', function () {
    exitEditMode();
    valueInput.focus();
  });
  form.addEventListener('submit', onSubmit);
}

initApp();
