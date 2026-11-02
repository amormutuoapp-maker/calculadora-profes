'use strict';

/**
 * Calculadora para profesores — pantalla (T-003, T-004, T-005, T-007,
 * T-008, T-009, T-010 y T-013, v0.3.0).
 *
 * Conecta la página con Calc y con ButtonStore. Los botones de suma
 * salen de la última plantilla usada. Si no hay ninguna, si se borró
 * o si los datos no se pueden leer, son 1, 0,5 y 0,25.
 *
 * Cada pulsación llama a Calc.addValue. «Borrar último» llama a
 * Calc.removeLast, sin confirmación. «Reset» pide confirmación con
 * window.confirm y, solo si se acepta, llama a Calc.reset.
 *
 * «Configurar botones» añade, edita y quita valores con la validación
 * de Calc. Un texto inválido no crea ni cambia un botón. Con un solo
 * botón, Quitar queda desactivado. Cambiar los botones no toca el
 * total ni la lista. Tampoco modifica la plantilla guardada hasta que
 * se pulsa «Actualizar plantilla»: esa acción sustituye los botones
 * de la plantilla en uso y deja el nombre y lastUsed iguales. Al
 * recargar se ven los botones guardados de la última plantilla
 * cargada, guardada o actualizada.
 *
 * «Plantillas» guarda una plantilla nueva, carga, renombra, actualiza
 * y borra. Borrar y actualizar (cuando los botones cambian) piden
 * window.confirm. Guardar, cargar y renombrar no. Si los botones
 * actuales ya son los de la plantilla, actualizar no pregunta y no
 * escribe. Los errores de nombre salen junto al campo. Si el almacén
 * no está o los datos están dañados, la suma sigue y el aviso queda
 * en pantalla. Actualizar no cambia el total ni la lista.
 *
 * La etiqueta visible de cada botón de suma es Calc.formatCents.
 * El número de pregunta (P1, P2, ...) es el índice más uno al pintar.
 * El total y la lista viven solo en memoria: no se guardan, y cargar
 * o actualizar una plantilla no los cambia. Los nombres se pintan
 * con textContent.
 *
 * T-013: en la principal, un selector nativo muestra la plantilla en
 * uso o «Sin plantilla». Elegir otra llama a la misma función que
 * «Cargar» y no toca el total ni la lista. «Nueva plantilla» abre el
 * formulario que ya existe, con el foco en el nombre. Si el guardado
 * sale bien, se vuelve a la calculadora. Si el nombre no sirve, el
 * error es el de siempre y se permanece en el formulario. Renombrar,
 * borrar y actualizar siguen solo en Plantillas. Las opciones del
 * selector se crean con createElement y textContent.
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

function buttonsSummary(centsList) {
  var parts = [];
  var index;
  for (index = 0; index < centsList.length; index += 1) {
    parts.push(Calc.formatCents(centsList[index]));
  }
  return parts.join(' · ');
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

function deleteConfirmMessage(name) {
  return '¿Borrar la plantilla «' + name + '»? No cambia el total ni la lista.';
}

function updateConfirmMessage(name) {
  return '¿Actualizar «' + name + '» con los botones actuales?';
}

function unchangedTemplateMessage(name) {
  return 'La plantilla «' + name + '» ya tiene estos botones.';
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
  var templatesScreen = document.getElementById('templates-screen');
  var openConfigButton = document.getElementById('open-config');
  var openTemplatesButton = document.getElementById('open-templates');
  var backButton = document.getElementById('config-back');
  var templatesBackButton = document.getElementById('templates-back');
  var form = document.getElementById('button-form');
  var valueInput = document.getElementById('button-value');
  var valueError = document.getElementById('button-value-error');
  var valueLabel = document.getElementById('button-value-label');
  var saveButton = document.getElementById('button-save');
  var cancelButton = document.getElementById('button-cancel');
  var editNote = document.getElementById('edit-note');
  var configNote = document.getElementById('config-note');
  var configList = document.getElementById('config-list');
  var storageWarning = document.getElementById('storage-warning');
  var templatesStorageWarning = document.getElementById('templates-storage-warning');
  var templateForm = document.getElementById('template-form');
  var templateNameInput = document.getElementById('template-name');
  var templateNameError = document.getElementById('template-name-error');
  var templateStatus = document.getElementById('template-status');
  var templateInUse = document.getElementById('template-in-use');
  var templateUpdateButton = document.getElementById('template-update');
  var templateList = document.getElementById('template-list');
  var templateEmpty = document.getElementById('template-empty');
  var templatePicker = document.getElementById('template-picker');
  var templatePickerHint = document.getElementById('template-picker-hint');
  var templateNewButton = document.getElementById('template-new');
  var repo = ButtonStore.createRepository(ButtonStore.openBrowserStorage());
  var startupButtons = repo.getStartupButtons();
  var state = Calc.createState();
  var buttons = startupButtons === null ? Calc.createDefaultButtons() : startupButtons;
  var editingIndex = null;
  var renamingName = null;
  var renameDraft = '';
  var renameError = '';
  var templatesOpenedFromCalculator = false;
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

  function showStorageWarning(message) {
    var text = message || '';
    storageWarning.textContent = text;
    templatesStorageWarning.textContent = text;
    storageWarning.hidden = text.length === 0;
    templatesStorageWarning.hidden = text.length === 0;
  }

  function showTemplateNameError(message) {
    templateNameError.textContent = message || '';
    templateNameInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function setTemplateStatus(message) {
    templateStatus.textContent = message || '';
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

  function applyButtons(next) {
    buttons = next;
    exitEditMode();
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

  function paintRenameError() {
    var field = document.getElementById('template-rename-input');
    var errorElement = document.getElementById('template-rename-error');
    if (!field || !errorElement) {
      renderTemplateList();
      return;
    }
    errorElement.textContent = renameError;
    field.setAttribute('aria-invalid', renameError ? 'true' : 'false');
    field.focus();
  }

  function startRename(name) {
    renamingName = name;
    renameDraft = name;
    renameError = '';
    setTemplateStatus('');
    renderTemplateList();
    var field = document.getElementById('template-rename-input');
    if (field) {
      field.focus();
      field.select();
    }
  }

  function cancelRename() {
    renamingName = null;
    renameDraft = '';
    renameError = '';
    renderTemplateList();
  }

  function onRenameSubmit() {
    var result = repo.renameTemplate(renamingName, renameDraft);
    showStorageWarning(result.warning);
    if (!result.ok) {
      renameError = result.error;
      paintRenameError();
      return;
    }
    renamingName = null;
    renameDraft = '';
    renameError = '';
    setTemplateStatus('Nombre actualizado.');
    renderTemplateList();
  }

  function onUseTemplate(name) {
    var result = repo.useTemplate(name);
    showStorageWarning(result.warning);
    if (!result.ok || !result.buttons) {
      setTemplateStatus('');
      renderTemplatePicker();
      return;
    }
    applyButtons(result.buttons);
    renamingName = null;
    renameDraft = '';
    renameError = '';
    if (result.persisted) {
      setTemplateStatus('Plantilla cargada. El total y la lista siguen igual.');
    } else {
      setTemplateStatus('Botones cargados en esta visita. No se ha podido recordar la plantilla.');
    }
    renderTemplateList();
  }

  function onRemoveTemplate(name) {
    var accepted = window.confirm(deleteConfirmMessage(name));
    var result;
    if (!accepted) {
      return;
    }
    result = repo.removeTemplate(name);
    showStorageWarning(result.warning);
    if (!result.ok) {
      setTemplateStatus('');
      return;
    }
    if (renamingName === name) {
      renamingName = null;
      renameDraft = '';
      renameError = '';
    }
    setTemplateStatus('Plantilla borrada. Los botones de la calculadora siguen igual.');
    renderTemplateList();
  }

  function createRenameBlock() {
    var block = document.createElement('div');
    var label = document.createElement('label');
    var input = document.createElement('input');
    var errorElement = document.createElement('p');
    var saveNameButton = document.createElement('button');
    var cancelNameButton = document.createElement('button');

    block.className = 'template-rename';

    label.setAttribute('for', 'template-rename-input');
    label.textContent = 'Nuevo nombre';

    input.id = 'template-rename-input';
    input.className = 'text-input';
    input.type = 'text';
    input.setAttribute('inputmode', 'text');
    input.maxLength = 40;
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.spellcheck = false;
    input.value = renameDraft;
    input.setAttribute('aria-describedby', 'template-rename-error');
    input.setAttribute('aria-invalid', renameError ? 'true' : 'false');

    errorElement.id = 'template-rename-error';
    errorElement.className = 'field-error';
    errorElement.setAttribute('role', 'alert');
    errorElement.textContent = renameError;

    saveNameButton.type = 'button';
    saveNameButton.className = 'template-action primary-action';
    saveNameButton.textContent = 'Guardar nombre';

    cancelNameButton.type = 'button';
    cancelNameButton.className = 'template-action secondary-action';
    cancelNameButton.textContent = 'Cancelar';

    input.addEventListener('input', function () {
      renameDraft = input.value;
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        onRenameSubmit();
      }
    });
    saveNameButton.addEventListener('click', onRenameSubmit);
    cancelNameButton.addEventListener('click', cancelRename);

    block.appendChild(label);
    block.appendChild(input);
    block.appendChild(errorElement);
    block.appendChild(saveNameButton);
    block.appendChild(cancelNameButton);
    return block;
  }

  function createTemplateActions(item) {
    var actions = document.createElement('div');
    var loadButton = document.createElement('button');
    var renameButton = document.createElement('button');
    var deleteButton = document.createElement('button');

    actions.className = 'template-actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Acciones de ' + item.name);

    loadButton.type = 'button';
    loadButton.className = 'template-action';
    loadButton.textContent = 'Cargar';
    loadButton.setAttribute('aria-label', 'Cargar la plantilla ' + item.name);
    loadButton.addEventListener('click', function () {
      onUseTemplate(item.name);
    });

    renameButton.type = 'button';
    renameButton.className = 'template-action';
    renameButton.textContent = 'Renombrar';
    renameButton.setAttribute('aria-label', 'Renombrar la plantilla ' + item.name);
    renameButton.addEventListener('click', function () {
      startRename(item.name);
    });

    deleteButton.type = 'button';
    deleteButton.className = 'template-action';
    deleteButton.textContent = 'Borrar';
    deleteButton.setAttribute('aria-label', 'Borrar la plantilla ' + item.name);
    deleteButton.addEventListener('click', function () {
      onRemoveTemplate(item.name);
    });

    actions.appendChild(loadButton);
    actions.appendChild(renameButton);
    actions.appendChild(deleteButton);
    return actions;
  }

  function createTemplateCard(item) {
    var card = document.createElement('li');
    var nameElement = document.createElement('p');
    var summary = document.createElement('p');
    var badge;

    card.className = 'template-card';

    nameElement.className = 'template-name';
    nameElement.textContent = item.name;

    summary.className = 'template-buttons-label';
    summary.textContent = 'Botones: ' + buttonsSummary(item.buttons);

    card.appendChild(nameElement);
    if (item.isLastUsed) {
      badge = document.createElement('p');
      badge.className = 'template-badge';
      badge.textContent = 'Última usada';
      card.appendChild(badge);
    }
    card.appendChild(summary);
    if (renamingName === item.name) {
      card.appendChild(createRenameBlock());
    } else {
      card.appendChild(createTemplateActions(item));
    }
    return card;
  }

  function renderTemplateInUse() {
    var name = repo.getLastUsedName();
    if (name === null) {
      templateInUse.textContent = 'Ninguna plantilla en uso';
      templateUpdateButton.disabled = true;
      templateUpdateButton.setAttribute('aria-disabled', 'true');
    } else {
      templateInUse.textContent = 'Plantilla en uso: ' + name;
      templateUpdateButton.disabled = false;
      templateUpdateButton.setAttribute('aria-disabled', 'false');
    }
    renderTemplatePicker();
  }

  /**
   * Selector de la principal. Misma lista que Plantillas. La opción
   * «Sin plantilla» no carga nada: no hay forma de dejar la plantilla
   * sin usar desde aquí. Sin plantillas, el selector se desactiva.
   */
  function renderTemplatePicker() {
    var items = repo.listTemplates();
    var current = repo.getLastUsedName();
    var empty = items.length === 0;
    var index;
    var option;

    clearChildren(templatePicker);

    option = document.createElement('option');
    option.value = '';
    option.textContent = 'Sin plantilla';
    /* No se puede «dejar sin plantilla»: esa acción no existe.
       Si ya hay una en uso, la opción queda desactivada. */
    option.disabled = current !== null;
    if (current === null) {
      option.selected = true;
    }
    templatePicker.appendChild(option);

    for (index = 0; index < items.length; index += 1) {
      option = document.createElement('option');
      option.value = items[index].name;
      option.textContent = items[index].name;
      if (items[index].name === current) {
        option.selected = true;
      }
      templatePicker.appendChild(option);
    }

    if (current === null) {
      templatePicker.value = '';
    } else {
      templatePicker.value = current;
    }

    templatePicker.disabled = empty;
    if (empty) {
      templatePicker.setAttribute('aria-disabled', 'true');
      templatePicker.setAttribute('aria-describedby', 'template-picker-hint');
    } else {
      templatePicker.removeAttribute('aria-disabled');
      templatePicker.removeAttribute('aria-describedby');
    }
    templatePickerHint.hidden = !empty;
  }

  function renderTemplateList() {
    var items = repo.listTemplates();
    var index;
    clearChildren(templateList);
    templateEmpty.hidden = items.length > 0;
    for (index = 0; index < items.length; index += 1) {
      templateList.appendChild(createTemplateCard(items[index]));
    }
    renderTemplateInUse();
  }

  /**
   * Sustituye los botones de la plantilla en uso. No toca el total
   * ni la lista. Si se cancela el confirm, no llama al almacén.
   */
  function onUpdateTemplate() {
    var name = repo.getLastUsedName();
    var savedButtons = null;
    var items;
    var index;
    var plan;
    var accepted;
    var result;
    if (templateUpdateButton.disabled || name === null) {
      return;
    }
    items = repo.listTemplates();
    for (index = 0; index < items.length; index += 1) {
      if (items[index].name === name) {
        savedButtons = items[index].buttons;
        break;
      }
    }
    plan = ButtonStore.planTemplateUpdate({
      lastUsed: name,
      savedButtons: savedButtons,
      currentButtons: buttons,
      confirmed: false
    });
    if (plan.action === 'unchanged') {
      setTemplateStatus(unchangedTemplateMessage(plan.name));
      return;
    }
    if (plan.action === 'reject') {
      setTemplateStatus(plan.error || '');
      return;
    }
    if (plan.action !== 'cancel') {
      return;
    }
    accepted = window.confirm(updateConfirmMessage(plan.name));
    if (!accepted) {
      return;
    }
    plan = ButtonStore.planTemplateUpdate({
      lastUsed: name,
      savedButtons: savedButtons,
      currentButtons: buttons,
      confirmed: true
    });
    if (plan.action === 'unchanged') {
      setTemplateStatus(unchangedTemplateMessage(plan.name));
      return;
    }
    if (plan.action !== 'update') {
      setTemplateStatus(plan.error || '');
      return;
    }
    result = repo.updateTemplateButtons(buttons);
    showStorageWarning(result.warning);
    if (!result.ok) {
      setTemplateStatus(result.error || '');
      renderTemplateInUse();
      return;
    }
    if (result.unchanged) {
      setTemplateStatus(unchangedTemplateMessage(result.name));
      return;
    }
    setTemplateStatus('Plantilla actualizada. El total y la lista siguen igual.');
    renderTemplateList();
  }

  function openConfig() {
    calculatorScreen.hidden = true;
    templatesScreen.hidden = true;
    configScreen.hidden = false;
    renderConfigNote();
    renderConfigList();
    valueInput.focus();
  }

  function closeConfig() {
    configScreen.hidden = true;
    templatesScreen.hidden = true;
    calculatorScreen.hidden = false;
    renderSumButtons();
    scrollListToEnd(listElement);
    openConfigButton.focus();
  }

  function showTemplatesScreen() {
    calculatorScreen.hidden = true;
    configScreen.hidden = true;
    templatesScreen.hidden = false;
    showStorageWarning(repo.getWarning());
    renderTemplateList();
    templateNameInput.focus();
  }

  function openTemplates() {
    templatesOpenedFromCalculator = false;
    templatesBackButton.textContent = 'Volver a configurar';
    showTemplatesScreen();
  }

  /**
   * Desde la principal: el mismo formulario de plantilla nueva, con
   * el foco en el nombre. Al guardar bien se vuelve a la calculadora.
   */
  function openNewTemplate() {
    templatesOpenedFromCalculator = true;
    templatesBackButton.textContent = 'Volver a la calculadora';
    templateNameInput.value = '';
    showTemplateNameError('');
    setTemplateStatus('');
    showTemplatesScreen();
  }

  function returnToCalculator() {
    templatesOpenedFromCalculator = false;
    templatesBackButton.textContent = 'Volver a configurar';
    templatesScreen.hidden = true;
    configScreen.hidden = true;
    calculatorScreen.hidden = false;
    renderSumButtons();
    scrollListToEnd(listElement);
    templateNewButton.focus();
  }

  function closeTemplates() {
    if (templatesOpenedFromCalculator) {
      returnToCalculator();
      return;
    }
    templatesScreen.hidden = true;
    calculatorScreen.hidden = true;
    configScreen.hidden = false;
    renderConfigNote();
    renderConfigList();
    openTemplatesButton.focus();
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

  function onTemplateSubmit(event) {
    var result;
    event.preventDefault();
    result = repo.saveTemplate(templateNameInput.value, buttons);
    showStorageWarning(result.warning);
    if (!result.ok) {
      showTemplateNameError(result.error);
      setTemplateStatus('');
      templateNameInput.focus();
      return;
    }
    showTemplateNameError('');
    templateNameInput.value = '';
    renamingName = null;
    renameDraft = '';
    renameError = '';
    setTemplateStatus('Plantilla guardada. Si cambias los botones, no se modifican hasta que pulses «Actualizar plantilla».');
    renderTemplateList();
    if (templatesOpenedFromCalculator) {
      returnToCalculator();
      return;
    }
    templateNameInput.focus();
  }

  function onTemplatePickerChange() {
    var name = templatePicker.value;
    if (!name) {
      renderTemplatePicker();
      return;
    }
    onUseTemplate(name);
  }

  removeButton = createRemoveButton(removeLastValue);
  undoElement.appendChild(removeButton);
  resetElement.appendChild(createResetButton(resetAll));
  renderSumButtons();
  paint();
  showStorageWarning(repo.getWarning());
  renderTemplateInUse();

  openConfigButton.addEventListener('click', openConfig);
  openTemplatesButton.addEventListener('click', openTemplates);
  backButton.addEventListener('click', closeConfig);
  templatesBackButton.addEventListener('click', closeTemplates);
  cancelButton.addEventListener('click', function () {
    exitEditMode();
    valueInput.focus();
  });
  form.addEventListener('submit', onSubmit);
  templateForm.addEventListener('submit', onTemplateSubmit);
  templateUpdateButton.addEventListener('click', onUpdateTemplate);
  templateNewButton.addEventListener('click', openNewTemplate);
  templatePicker.addEventListener('change', onTemplatePickerChange);
}

initApp();
