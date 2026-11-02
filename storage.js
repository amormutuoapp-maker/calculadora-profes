/**
 * Calculadora para profesores — plantillas de botones (T-009, v0.3.0;
 * actualizar la plantilla en uso, T-010).
 *
 * Capa pura: no toca la página, no conoce el total ni la lista de la
 * suma y no usa la red. La pantalla le pasa el almacén ya obtenido
 * (inyección) para poder probarlo en Node con un objeto en memoria.
 *
 * En el navegador queda el objeto global ButtonStore. Node lo carga
 * con require, igual que Calc. Necesita Calc para volver a validar
 * los botones con las reglas de la v0.2.0 (addButton y formatCents).
 *
 * Clave única: «calculadora-profes:v1».
 * Documento JSON:
 *   { version: 1,
 *     templates: [ { name: "Aula", buttons: [100, 50, 25] } ],
 *     lastUsed: "Aula" | null }
 * No hay otras claves ni otros campos. El total y la lista no entran.
 *
 * Leer no escribe. Si el texto no es JSON, la versión o la estructura
 * no valen, getItem lanza o el almacén no está, se empieza vacío y no
 * se borra lo que hubiera. Las plantillas que no pasen la validación
 * (nombre o botones) se descartan y se conservan las demás; el aviso
 * lo pinta la pantalla. La primera acción del profesor que sí guarda
 * (guardar, cargar, renombrar, borrar o actualizar) escribe un
 * documento válido y, a partir de ahí, sustituye el valor anterior.
 *
 * «Usada» es la última plantilla cargada, recién guardada o recién
 * actualizada. Editar los botones de la calculadora no cambia la
 * plantilla guardada: hace falta updateTemplateButtons, que sustituye
 * los botones de la plantilla en uso (lastUsed). El nombre no cambia
 * y lastUsed sigue siendo esa plantilla. Las demás plantillas no se
 * tocan. La suma no entra en la operación.
 *
 * Comparación (decisión): dos listas son la misma solo si tienen los
 * mismos céntimos en el mismo orden. [100, 50] y [50, 100] son
 * distintas, porque el orden es el de los botones en la pantalla. No
 * se ordenan ni se comparan como conjunto. Si son iguales, no se
 * escribe ni se pide confirmación (la confirmación la decide la
 * pantalla con planTemplateUpdate).
 *
 * updateTemplateButtons valida con las reglas de la v0.2.0, escribe
 * el documento y solo si setItem termina bien cambia la memoria. Si
 * setItem lanza o el almacén no está, la memoria queda como estaba.
 *
 * Nombres: se recortan los extremos, de 1 a 30 caracteres (length de
 * JavaScript, unidades UTF-16, igual que maxlength). La comparación
 * sin mayúsculas usa toLocaleLowerCase('es'): el idioma va fijo para
 * que «Á» y «I» bajen igual en el móvil y en Node, sin depender del
 * idioma del sistema (en turco, I no bajaría a i). Al renombrar, el
 * propio nombre —aunque solo cambien las mayúsculas— no choca consigo
 * mismo.
 */
(function (root, factory) {
  var Calc = null;
  if (typeof module !== 'undefined' && module.exports) {
    Calc = require('./calc.js');
  } else if (typeof root !== 'undefined' && root) {
    Calc = root.Calc;
  }
  var api = factory(Calc);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined' && root) {
    root.ButtonStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function (Calc) {
  'use strict';

  if (!Calc || typeof Calc.addButton !== 'function' || typeof Calc.formatCents !== 'function') {
    throw new Error('ButtonStore necesita Calc.');
  }

  var STORAGE_KEY = 'calculadora-profes:v1';
  var STORAGE_VERSION = 1;
  var MAX_TEMPLATES = 20;
  var MIN_TEMPLATE_NAME_LENGTH = 1;
  var MAX_TEMPLATE_NAME_LENGTH = 30;

  var ERROR_NAME_EMPTY = 'El nombre tiene que tener entre 1 y 30 caracteres.';
  var ERROR_NAME_LONG = 'El nombre no puede pasar de 30 caracteres.';
  var ERROR_NAME_DUPLICATE = 'Ya hay una plantilla con ese nombre.';
  var ERROR_MAX_TEMPLATES = 'No se pueden guardar más de 20 plantillas.';
  var ERROR_NOT_FOUND = 'Esa plantilla no existe.';
  var ERROR_NO_TEMPLATE_IN_USE = 'No hay ninguna plantilla en uso.';
  var ERROR_BUTTONS_INVALID = 'Esos botones no se pueden guardar en una plantilla.';
  var ERROR_STORAGE_UNAVAILABLE = 'No se puede guardar en este dispositivo. La calculadora funciona, pero las plantillas no se recordarán.';
  var ERROR_STORAGE_WRITE = 'No se ha podido guardar este cambio. La calculadora sigue funcionando.';
  var WARNING_CORRUPT = 'No se han podido leer los datos guardados. No se ha borrado nada. Se usan los botones 1, 0,5 y 0,25.';
  var WARNING_PARTIAL = 'Había plantillas no válidas y no se han cargado. No se ha borrado nada.';

  /**
   * Comparación de nombres sin distinguir mayúsculas.
   * 'es' va fijo: el resultado no cambia si el dispositivo está en
   * otro idioma. Ver el comentario de cabecera.
   */
  function nameKey(name) {
    return String(name).toLocaleLowerCase('es');
  }

  function canUseStorage(storage) {
    return !!storage &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function';
  }

  /**
   * Lista de céntimos ya guardada, o null si no cumple las reglas de
   * la v0.2.0. Cada valor se vuelve a pasar por formatCents y
   * addButton: rango 0,01–100, sin duplicados y entre 1 y 12 botones.
   * No modifica el array recibido.
   */
  function validateButtonList(raw) {
    var buttons = [];
    var index;
    var text;
    var added;
    if (!Array.isArray(raw)) {
      return null;
    }
    if (raw.length < Calc.MIN_BUTTONS || raw.length > Calc.MAX_BUTTONS) {
      return null;
    }
    for (index = 0; index < raw.length; index += 1) {
      if (typeof raw[index] !== 'number' || !Number.isSafeInteger(raw[index])) {
        return null;
      }
      try {
        text = Calc.formatCents(raw[index]);
      } catch (formatError) {
        return null;
      }
      added = Calc.addButton(buttons, text);
      if (!added.ok) {
        return null;
      }
      buttons = added.buttons;
    }
    return buttons;
  }

  /**
   * Misma lista de céntimos, en el mismo orden. Un orden distinto es
   * un cambio: no se reordena ni se trata como un conjunto.
   * No modifica los arrays.
   */
  function sameButtonList(left, right) {
    var index;
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }
    if (left.length !== right.length) {
      return false;
    }
    for (index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Decisión de «Actualizar plantilla», sin almacén y sin memoria.
   * La pantalla la usa antes de confirmar y antes de escribir.
   *
   * Orden, de lo más conservador a lo que sí cambia datos:
   * 1. Sin nombre de plantilla en uso → reject. No hay nada que tocar.
   * 2. Botones que no pasan la v0.2.0 → reject.
   * 3. Mismos céntimos y mismo orden → unchanged. No se confirma
   *    y no se escribe, aunque confirmed sea false.
   * 4. confirmed distinto de true → cancel. Quien llama no debe
   *    escribir: es el caso de window.confirm cancelado.
   * 5. confirmed true → update. Entonces sí se puede llamar a
   *    updateTemplateButtons.
   *
   * No escribe. No lee el almacén. No modifica los arrays recibidos.
   */
  function planTemplateUpdate(spec) {
    var validButtons;
    if (!spec || typeof spec.lastUsed !== 'string' || spec.lastUsed.length === 0) {
      return { action: 'reject', error: ERROR_NO_TEMPLATE_IN_USE };
    }
    validButtons = validateButtonList(spec.currentButtons);
    if (validButtons === null) {
      return { action: 'reject', error: ERROR_BUTTONS_INVALID };
    }
    if (sameButtonList(spec.savedButtons, validButtons)) {
      return {
        action: 'unchanged',
        name: spec.lastUsed,
        buttons: validButtons
      };
    }
    if (spec.confirmed !== true) {
      return {
        action: 'cancel',
        name: spec.lastUsed,
        buttons: validButtons
      };
    }
    return {
      action: 'update',
      name: spec.lastUsed,
      buttons: validButtons
    };
  }

  /**
   * Nombre recortado, o null si no sirve. No distingue el motivo:
   * para el mensaje concreto está validateName.
   */
  function normalizeName(name) {
    var trimmed;
    if (typeof name !== 'string') {
      return null;
    }
    trimmed = name.trim();
    if (trimmed.length < MIN_TEMPLATE_NAME_LENGTH || trimmed.length > MAX_TEMPLATE_NAME_LENGTH) {
      return null;
    }
    return trimmed;
  }

  /**
   * exceptIndex es la plantilla que se está renombrando: su propio
   * nombre, con otras mayúsculas, no cuenta como duplicado.
   * -1 cuando el nombre es de una plantilla nueva.
   */
  function validateName(name, templates, exceptIndex) {
    var trimmed;
    var key;
    var index;
    if (typeof name !== 'string') {
      return { ok: false, error: ERROR_NAME_EMPTY };
    }
    trimmed = name.trim();
    if (trimmed.length < MIN_TEMPLATE_NAME_LENGTH) {
      return { ok: false, error: ERROR_NAME_EMPTY };
    }
    if (trimmed.length > MAX_TEMPLATE_NAME_LENGTH) {
      return { ok: false, error: ERROR_NAME_LONG };
    }
    key = nameKey(trimmed);
    for (index = 0; index < templates.length; index += 1) {
      if (index === exceptIndex) {
        continue;
      }
      if (nameKey(templates[index].name) === key) {
        return { ok: false, error: ERROR_NAME_DUPLICATE };
      }
    }
    return { ok: true, name: trimmed };
  }

  function findExact(templates, name) {
    var index;
    for (index = 0; index < templates.length; index += 1) {
      if (templates[index].name === name) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Documento leído. ok false: está dañado entero y no se aprovecha
   * ninguna plantilla. discarded true: la estructura vale, pero se
   * ha tirado alguna plantilla o la última usada ya no existe.
   * En ningún caso se escribe.
   */
  function validateDocument(data) {
    var templates = [];
    var seen = Object.create(null);
    var discarded = false;
    var index;
    var item;
    var name;
    var buttons;
    var key;
    var lastUsed = null;
    var lastIndex;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false };
    }
    if (data.version !== STORAGE_VERSION) {
      return { ok: false };
    }
    if (!Array.isArray(data.templates)) {
      return { ok: false };
    }
    if (!(data.lastUsed === null || typeof data.lastUsed === 'string')) {
      return { ok: false };
    }
    for (index = 0; index < data.templates.length; index += 1) {
      item = data.templates[index];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        discarded = true;
        continue;
      }
      name = normalizeName(item.name);
      buttons = validateButtonList(item.buttons);
      if (name === null || buttons === null) {
        discarded = true;
        continue;
      }
      key = nameKey(name);
      if (seen[key]) {
        discarded = true;
        continue;
      }
      if (templates.length >= MAX_TEMPLATES) {
        discarded = true;
        continue;
      }
      seen[key] = true;
      templates.push({
        name: name,
        buttons: buttons
      });
    }
    if (typeof data.lastUsed === 'string') {
      lastIndex = findExact(templates, data.lastUsed.trim());
      if (lastIndex === -1) {
        discarded = true;
        lastUsed = null;
      } else {
        lastUsed = templates[lastIndex].name;
      }
    }
    return {
      ok: true,
      templates: templates,
      lastUsed: lastUsed,
      discarded: discarded
    };
  }

  function readFrom(storage) {
    var raw;
    var parsed;
    var validated;
    if (!canUseStorage(storage)) {
      return {
        available: false,
        templates: [],
        lastUsed: null,
        warning: ERROR_STORAGE_UNAVAILABLE
      };
    }
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (readError) {
      return {
        available: false,
        templates: [],
        lastUsed: null,
        warning: ERROR_STORAGE_UNAVAILABLE
      };
    }
    if (raw === null || typeof raw === 'undefined') {
      return {
        available: true,
        templates: [],
        lastUsed: null,
        warning: ''
      };
    }
    if (typeof raw !== 'string') {
      return {
        available: true,
        templates: [],
        lastUsed: null,
        warning: WARNING_CORRUPT
      };
    }
    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      return {
        available: true,
        templates: [],
        lastUsed: null,
        warning: WARNING_CORRUPT
      };
    }
    validated = validateDocument(parsed);
    if (!validated.ok) {
      return {
        available: true,
        templates: [],
        lastUsed: null,
        warning: WARNING_CORRUPT
      };
    }
    return {
      available: true,
      templates: validated.templates,
      lastUsed: validated.lastUsed,
      warning: validated.discarded ? WARNING_PARTIAL : ''
    };
  }

  function copyButtons(buttons) {
    return buttons.slice();
  }

  /**
   * Repositorio sobre un almacén inyectado. Leer no llama a setItem.
   * Las copias que salen hacia fuera no son el array interno: cambiar
   * los botones de la calculadora no modifica la plantilla guardada.
   */
  function createRepository(storage) {
    var loaded = readFrom(storage);
    var templates = loaded.templates;
    var lastUsed = loaded.lastUsed;
    var warning = loaded.warning;
    var available = loaded.available;

    /**
     * Escribe un documento ya montado. No cambia templates, lastUsed
     * ni el aviso: quien llama decide si actualiza la memoria.
     */
    function writeSnapshot(nextTemplates, nextLastUsed) {
      var list = [];
      var index;
      if (!available) {
        return { ok: false, error: ERROR_STORAGE_UNAVAILABLE };
      }
      for (index = 0; index < nextTemplates.length; index += 1) {
        list.push({
          name: nextTemplates[index].name,
          buttons: copyButtons(nextTemplates[index].buttons)
        });
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({
          version: STORAGE_VERSION,
          templates: list,
          lastUsed: nextLastUsed
        }));
      } catch (writeError) {
        return { ok: false, error: ERROR_STORAGE_WRITE };
      }
      return { ok: true };
    }

    function persist() {
      var written = writeSnapshot(templates, lastUsed);
      if (!written.ok) {
        return written;
      }
      warning = '';
      return { ok: true };
    }

    function failure(error) {
      return { ok: false, error: error, warning: warning };
    }

    function getWarning() {
      return warning;
    }

    /**
     * Nombre exacto de la plantilla en uso, o null si lastUsed es
     * null o ya no está en la lista.
     */
    function getLastUsedName() {
      if (lastUsed === null) {
        return null;
      }
      if (findExact(templates, lastUsed) === -1) {
        return null;
      }
      return lastUsed;
    }

    /**
     * Botones de la última plantilla usada, como copia, o null si no
     * hay ninguna (la pantalla pone entonces 1, 0,5 y 0,25).
     */
    function getStartupButtons() {
      var index;
      if (lastUsed === null) {
        return null;
      }
      index = findExact(templates, lastUsed);
      if (index === -1) {
        return null;
      }
      return copyButtons(templates[index].buttons);
    }

    function listTemplates() {
      var list = [];
      var index;
      for (index = 0; index < templates.length; index += 1) {
        list.push({
          name: templates[index].name,
          buttons: copyButtons(templates[index].buttons),
          isLastUsed: templates[index].name === lastUsed
        });
      }
      return list;
    }

    function saveTemplate(name, buttonList) {
      var nameResult = validateName(name, templates, -1);
      var validButtons;
      var previousLast;
      var written;
      if (!nameResult.ok) {
        return failure(nameResult.error);
      }
      validButtons = validateButtonList(buttonList);
      if (validButtons === null) {
        return failure(ERROR_BUTTONS_INVALID);
      }
      if (templates.length >= MAX_TEMPLATES) {
        return failure(ERROR_MAX_TEMPLATES);
      }
      if (!available) {
        warning = ERROR_STORAGE_UNAVAILABLE;
        return failure(ERROR_STORAGE_UNAVAILABLE);
      }
      previousLast = lastUsed;
      templates.push({
        name: nameResult.name,
        buttons: validButtons
      });
      lastUsed = nameResult.name;
      written = persist();
      if (!written.ok) {
        templates.pop();
        lastUsed = previousLast;
        warning = written.error;
        return failure(written.error);
      }
      return { ok: true, name: nameResult.name, warning: warning };
    }

    /**
     * Marca la plantilla como usada y devuelve una copia de sus
     * botones. No recibe el estado de la suma: no puede borrarlo.
     * Si setItem lanza, los botones igual se devuelven para esta
     * visita, pero lastUsed no cambia y el aviso explica que no se
     * ha guardado.
     */
    function useTemplate(name) {
      var index = findExact(templates, name);
      var buttonsCopy;
      var previousLast;
      var written;
      if (index === -1) {
        return failure(ERROR_NOT_FOUND);
      }
      buttonsCopy = copyButtons(templates[index].buttons);
      if (!available) {
        warning = ERROR_STORAGE_UNAVAILABLE;
        return {
          ok: true,
          persisted: false,
          name: templates[index].name,
          buttons: buttonsCopy,
          warning: warning,
          error: ERROR_STORAGE_UNAVAILABLE
        };
      }
      previousLast = lastUsed;
      lastUsed = templates[index].name;
      written = persist();
      if (!written.ok) {
        lastUsed = previousLast;
        warning = written.error;
        return {
          ok: true,
          persisted: false,
          name: templates[index].name,
          buttons: buttonsCopy,
          warning: warning,
          error: written.error
        };
      }
      return {
        ok: true,
        persisted: true,
        name: lastUsed,
        buttons: buttonsCopy,
        warning: warning
      };
    }

    function renameTemplate(currentName, nextName) {
      var index = findExact(templates, currentName);
      var nameResult;
      var previousName;
      var previousLast;
      var written;
      if (index === -1) {
        return failure(ERROR_NOT_FOUND);
      }
      nameResult = validateName(nextName, templates, index);
      if (!nameResult.ok) {
        return failure(nameResult.error);
      }
      previousName = templates[index].name;
      previousLast = lastUsed;
      if (nameResult.name === previousName) {
        return { ok: true, name: previousName, warning: warning };
      }
      templates[index].name = nameResult.name;
      if (lastUsed === previousName) {
        lastUsed = nameResult.name;
      }
      written = persist();
      if (!written.ok) {
        templates[index].name = previousName;
        lastUsed = previousLast;
        warning = written.error;
        return failure(written.error);
      }
      return { ok: true, name: nameResult.name, warning: warning };
    }

    function removeTemplate(name) {
      var index = findExact(templates, name);
      var removed;
      var previousTemplates;
      var previousLast;
      var written;
      if (index === -1) {
        return failure(ERROR_NOT_FOUND);
      }
      if (!available) {
        warning = ERROR_STORAGE_UNAVAILABLE;
        return failure(ERROR_STORAGE_UNAVAILABLE);
      }
      removed = templates[index];
      previousTemplates = templates.slice();
      previousLast = lastUsed;
      templates.splice(index, 1);
      if (lastUsed === removed.name) {
        lastUsed = null;
      }
      written = persist();
      if (!written.ok) {
        templates = previousTemplates;
        lastUsed = previousLast;
        warning = written.error;
        return failure(written.error);
      }
      return { ok: true, warning: warning };
    }

    /**
     * Sustituye los botones de la plantilla en uso por buttonList.
     * El nombre y lastUsed no cambian. Las demás plantillas tampoco.
     * No recibe el estado de la suma: no puede guardarlo ni borrarlo.
     *
     * Primero valida. Si los céntimos coinciden en el mismo orden, no
     * llama a setItem. Si hay que guardar, escribe el documento nuevo
     * y solo entonces cambia la memoria. Un fallo de escritura deja
     * la memoria y, si setItem lanzó antes de sustituir el valor, el
     * almacén como estaban.
     */
    function updateTemplateButtons(buttonList) {
      var index;
      var validButtons;
      var nextTemplates;
      var cursor;
      var written;
      if (lastUsed === null) {
        return failure(ERROR_NO_TEMPLATE_IN_USE);
      }
      index = findExact(templates, lastUsed);
      if (index === -1) {
        return failure(ERROR_NO_TEMPLATE_IN_USE);
      }
      validButtons = validateButtonList(buttonList);
      if (validButtons === null) {
        return failure(ERROR_BUTTONS_INVALID);
      }
      if (sameButtonList(templates[index].buttons, validButtons)) {
        return {
          ok: true,
          unchanged: true,
          name: templates[index].name,
          warning: warning
        };
      }
      nextTemplates = [];
      for (cursor = 0; cursor < templates.length; cursor += 1) {
        nextTemplates.push({
          name: templates[cursor].name,
          buttons: cursor === index ? copyButtons(validButtons) : copyButtons(templates[cursor].buttons)
        });
      }
      written = writeSnapshot(nextTemplates, lastUsed);
      if (!written.ok) {
        warning = written.error;
        return failure(written.error);
      }
      templates = nextTemplates;
      warning = '';
      return {
        ok: true,
        unchanged: false,
        name: templates[index].name,
        warning: warning
      };
    }

    return {
      getWarning: getWarning,
      getLastUsedName: getLastUsedName,
      getStartupButtons: getStartupButtons,
      listTemplates: listTemplates,
      saveTemplate: saveTemplate,
      useTemplate: useTemplate,
      renameTemplate: renameTemplate,
      removeTemplate: removeTemplate,
      updateTemplateButtons: updateTemplateButtons
    };
  }

  /**
   * Arranque en el navegador. Acceder al almacén puede lanzar (modo
   * privado): se captura y se devuelve null para que la calculadora
   * siga sin guardar. No escribe.
   */
  function openBrowserStorage() {
    var storage;
    try {
      if (typeof window === 'undefined' || window === null) {
        return null;
      }
      storage = window.localStorage;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
        return null;
      }
      storage.getItem(STORAGE_KEY);
      return storage;
    } catch (accessError) {
      return null;
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    STORAGE_VERSION: STORAGE_VERSION,
    MAX_TEMPLATES: MAX_TEMPLATES,
    MIN_TEMPLATE_NAME_LENGTH: MIN_TEMPLATE_NAME_LENGTH,
    MAX_TEMPLATE_NAME_LENGTH: MAX_TEMPLATE_NAME_LENGTH,
    ERROR_NAME_EMPTY: ERROR_NAME_EMPTY,
    ERROR_NAME_LONG: ERROR_NAME_LONG,
    ERROR_NAME_DUPLICATE: ERROR_NAME_DUPLICATE,
    ERROR_MAX_TEMPLATES: ERROR_MAX_TEMPLATES,
    ERROR_NOT_FOUND: ERROR_NOT_FOUND,
    ERROR_NO_TEMPLATE_IN_USE: ERROR_NO_TEMPLATE_IN_USE,
    ERROR_BUTTONS_INVALID: ERROR_BUTTONS_INVALID,
    ERROR_STORAGE_UNAVAILABLE: ERROR_STORAGE_UNAVAILABLE,
    ERROR_STORAGE_WRITE: ERROR_STORAGE_WRITE,
    WARNING_CORRUPT: WARNING_CORRUPT,
    WARNING_PARTIAL: WARNING_PARTIAL,
    nameKey: nameKey,
    validateButtonList: validateButtonList,
    sameButtonList: sameButtonList,
    planTemplateUpdate: planTemplateUpdate,
    createRepository: createRepository,
    openBrowserStorage: openBrowserStorage
  };
});
