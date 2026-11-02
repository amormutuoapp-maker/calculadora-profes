/**
 * Calculadora para profesores — plantillas de botones (T-009, v0.3.0).
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
 * (guardar, cargar, renombrar o borrar) escribe un documento válido y,
 * a partir de ahí, sustituye el valor anterior.
 *
 * «Usada» es la última plantilla cargada o recién guardada. No existe
 * la acción de sobrescribir una plantilla: si se cargan sus botones y
 * luego se editan, lo guardado no cambia.
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

    function payload() {
      var list = [];
      var index;
      for (index = 0; index < templates.length; index += 1) {
        list.push({
          name: templates[index].name,
          buttons: copyButtons(templates[index].buttons)
        });
      }
      return {
        version: STORAGE_VERSION,
        templates: list,
        lastUsed: lastUsed
      };
    }

    function persist() {
      if (!available) {
        return { ok: false, error: ERROR_STORAGE_UNAVAILABLE };
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(payload()));
      } catch (writeError) {
        return { ok: false, error: ERROR_STORAGE_WRITE };
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

    return {
      getWarning: getWarning,
      getStartupButtons: getStartupButtons,
      listTemplates: listTemplates,
      saveTemplate: saveTemplate,
      useTemplate: useTemplate,
      renameTemplate: renameTemplate,
      removeTemplate: removeTemplate
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
    ERROR_BUTTONS_INVALID: ERROR_BUTTONS_INVALID,
    ERROR_STORAGE_UNAVAILABLE: ERROR_STORAGE_UNAVAILABLE,
    ERROR_STORAGE_WRITE: ERROR_STORAGE_WRITE,
    WARNING_CORRUPT: WARNING_CORRUPT,
    WARNING_PARTIAL: WARNING_PARTIAL,
    nameKey: nameKey,
    validateButtonList: validateButtonList,
    createRepository: createRepository,
    openBrowserStorage: openBrowserStorage
  };
});
