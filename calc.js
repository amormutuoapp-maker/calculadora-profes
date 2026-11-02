/**
 * Calculadora para profesores — lógica pura (T-002 y T-008, v0.2.0).
 *
 * Trabaja solo con enteros (céntimos). No lee la página, no guarda
 * datos y no usa la red. La pantalla lo usa para sumar, quitar el
 * último valor, reiniciar y validar los botones del profesor.
 *
 * Carga:
 * - Navegador: objeto global Calc.
 * - Node: module.exports (las pruebas hacen require sin instalar nada).
 *
 * Formato de importes (formatCents): siempre dos decimales y coma
 * decimal, sin separador de miles.
 *   150 → "1,50"    30 → "0,30"    25000 → "250,00"    0 → "0,00"
 *
 * Conversión (parseToCents): texto o número → céntimos.
 * Acepta coma o punto, recorta espacios y admite ".5" (0,50) y "1,"
 * (1,00). La coma y el punto se tratan igual, así que ",5" y "1."
 * también valen. Solo admite un valor > 0 con 2 decimales como máximo.
 * La parte entera y los decimales se leen del texto por separado; no se
 * multiplica un decimal binario por 100. El tope de 100 es de los
 * botones (validateButtonValue), no de la suma: el total puede pasar
 * de 100.
 *
 * Señal de error: { ok: false, error: "mensaje en español" }.
 * Si el valor sirve: { ok: true, cents: <entero seguro> }.
 *
 * Estado de la suma: { values } congelado. El total no se guarda
 * aparte: getTotal suma la lista, así que siempre coincide con ella.
 * addValue y reset devuelven un estado nuevo. removeLast, con la lista
 * vacía, devuelve el mismo estado.
 *
 * Botones (T-008): listas de céntimos, aparte de la suma. Cambiarlos
 * no toca los valores ya sumados. addButton, updateButton y
 * removeButton devuelven una lista nueva y no modifican la que reciben.
 * No se puede dejar la lista por debajo del mínimo.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined' && root) {
    root.Calc = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function () {
  'use strict';

  var MAX_SAFE = Number.MAX_SAFE_INTEGER;

  /* Confirmado por el dueño. Céntimos mínimos de un botón: 0,01. */
  var MIN_CENTS = 1;
  /* Confirmado por el dueño. Céntimos máximos de un botón: 100,00. */
  var MAX_CENTS = 10000;
  /* Confirmado por el dueño. Número mínimo de botones. */
  var MIN_BUTTONS = 1;
  /* Confirmado por el dueño. Número máximo de botones. */
  var MAX_BUTTONS = 12;

  /* Los textos salen de las constantes para que un cambio de límite
     no deje el mensaje desfasado. */
  var ERROR_MIN_CENTS = 'El valor mínimo de un botón es ' + formatCents(MIN_CENTS) + '.';
  var ERROR_MAX_CENTS = 'El valor máximo de un botón es ' + formatCents(MAX_CENTS) + '.';
  var ERROR_DUPLICATE = 'Ese valor ya está en otro botón.';
  var ERROR_MAX_BUTTONS = 'No se pueden tener más de ' + MAX_BUTTONS + ' botones.';
  var ERROR_MIN_BUTTONS = 'Tiene que quedar al menos ' + MIN_BUTTONS + ' botón.';
  var ERROR_BAD_BUTTONS = 'La lista de botones no es válida.';
  var ERROR_MISSING_BUTTON = 'Ese botón no existe.';

  function fail(message) {
    return { ok: false, error: message };
  }

  function succeed(cents) {
    return { ok: true, cents: cents };
  }

  function digitsToSafeInt(digits) {
    var value = 0;
    var i;
    var digit;
    for (i = 0; i < digits.length; i += 1) {
      digit = digits.charCodeAt(i) - 48;
      if (digit < 0 || digit > 9) {
        return null;
      }
      if (value > Math.floor((MAX_SAFE - digit) / 10)) {
        return null;
      }
      value = value * 10 + digit;
    }
    return value;
  }

  /**
   * Pasa un texto ya reconocido como decimal (coma o punto) a céntimos.
   * whole * 100 desplaza un entero, no un float de moneda.
   */
  function centsFromParts(intDigits, decDigits) {
    var normalized = intDigits.replace(/^0+/, '');
    var whole;
    var fraction;
    var cents;
    if (normalized.length === 0) {
      normalized = '0';
    }
    whole = digitsToSafeInt(normalized);
    if (whole === null) {
      return fail('El valor es demasiado grande para sumarse con seguridad.');
    }
    if (decDigits.length === 0) {
      fraction = 0;
    } else if (decDigits.length === 1) {
      fraction = (decDigits.charCodeAt(0) - 48) * 10;
    } else {
      fraction = (decDigits.charCodeAt(0) - 48) * 10 + (decDigits.charCodeAt(1) - 48);
    }
    cents = whole * 100 + fraction;
    if (cents === 0) {
      return fail('El valor debe ser mayor que cero.');
    }
    if (!Number.isSafeInteger(cents)) {
      return fail('El valor es demasiado grande para sumarse con seguridad.');
    }
    return succeed(cents);
  }

  function parseDecimalText(raw) {
    var text = String(raw).trim();
    var separators = 0;
    var separatorAt = -1;
    var hasOtherChar = false;
    var i;
    var ch;
    var intPart;
    var decPart;
    var hasMinus = false;
    var hasExponent = false;
    if (text.length === 0) {
      return fail('El valor está vacío.');
    }
    for (i = 0; i < text.length; i += 1) {
      ch = text.charAt(i);
      if (ch === '-') {
        hasMinus = true;
      } else if (ch === 'e' || ch === 'E') {
        hasExponent = true;
      } else if (ch === ',' || ch === '.') {
        separators += 1;
        separatorAt = i;
      } else if (ch < '0' || ch > '9') {
        hasOtherChar = true;
      }
    }
    if (hasMinus) {
      return fail('No se admiten valores negativos.');
    }
    if (hasExponent) {
      return fail('No se admite la notación científica.');
    }
    if (separators > 1) {
      return fail('Solo se admite un separador decimal.');
    }
    if (hasOtherChar) {
      return fail('El valor contiene caracteres no numéricos.');
    }
    if (separatorAt === -1) {
      intPart = text;
      decPart = '';
    } else {
      intPart = text.slice(0, separatorAt);
      decPart = text.slice(separatorAt + 1);
      /* "." o "," solos no son un importe. ".5" y "1," sí. */
      if (intPart.length === 0 && decPart.length === 0) {
        return fail('El formato decimal no es válido.');
      }
      if (intPart.length === 0) {
        intPart = '0';
      }
      if (decPart.length > 2) {
        return fail('Solo se admiten hasta 2 decimales.');
      }
    }
    return centsFromParts(intPart, decPart);
  }

  /**
   * Convierte texto o número a céntimos enteros.
   * Devuelve { ok: true, cents } o { ok: false, error }.
   */
  function parseToCents(input) {
    var asText;
    if (typeof input === 'number') {
      if (Number.isNaN(input)) {
        return fail('El valor no es un número válido.');
      }
      if (!Number.isFinite(input)) {
        return fail('El valor no es finito.');
      }
      asText = String(input);
      if (/[eE]/.test(asText)) {
        return fail('El valor no se puede representar de forma segura.');
      }
      return parseDecimalText(asText);
    }
    if (typeof input === 'string') {
      return parseDecimalText(input);
    }
    return fail('El valor debe ser un texto o un número.');
  }

  /**
   * Céntimos → texto con coma y siempre dos decimales.
   * Ejemplos: "1,50", "0,30", "250,00", "0,00".
   * El entero seguro se pasa a texto y se separan los dos últimos dígitos,
   * sin dividir un float.
   */
  function formatCents(cents) {
    var text;
    var wholeText;
    var fractionText;
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw new Error('Los céntimos deben ser un entero seguro mayor o igual que cero.');
    }
    text = String(cents);
    if (text.length === 1) {
      wholeText = '0';
      fractionText = '0' + text;
    } else if (text.length === 2) {
      wholeText = '0';
      fractionText = text;
    } else {
      wholeText = text.slice(0, text.length - 2);
      fractionText = text.slice(text.length - 2);
    }
    return wholeText + ',' + fractionText;
  }

  function sumValues(values) {
    var total = 0;
    var i;
    for (i = 0; i < values.length; i += 1) {
      total += values[i];
    }
    return total;
  }

  function stateWith(values) {
    return Object.freeze({
      values: Object.freeze(values)
    });
  }

  function createState() {
    return stateWith([]);
  }

  /**
   * Añade céntimos (entero > 0) y devuelve un estado nuevo.
   * Lanza Error si los céntimos no son válidos o la suma deja de ser segura.
   */
  function addValue(state, cents) {
    var total;
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new Error('Solo se puede añadir un entero de céntimos mayor que cero.');
    }
    total = sumValues(state.values) + cents;
    if (!Number.isSafeInteger(total)) {
      throw new Error('La suma supera el máximo entero seguro.');
    }
    return stateWith(state.values.concat(cents));
  }

  /**
   * Quita el último valor. Con la lista vacía no falla y devuelve
   * el mismo estado.
   */
  function removeLast(state) {
    if (state.values.length === 0) {
      return state;
    }
    return stateWith(state.values.slice(0, state.values.length - 1));
  }

  /** Devuelve un estado vacío. No modifica el que recibe. */
  function reset(state) {
    return createState();
  }

  function getTotal(state) {
    return sumValues(state.values);
  }

  function getList(state) {
    return state.values.slice();
  }

  /**
   * Copia una lista de céntimos de botón. null si no es una lista de
   * enteros dentro del rango confirmado.
   */
  function copyButtons(buttons) {
    var copy = [];
    var i;
    var cents;
    if (!buttons || typeof buttons.length !== 'number') {
      return null;
    }
    for (i = 0; i < buttons.length; i += 1) {
      cents = buttons[i];
      if (!Number.isSafeInteger(cents) || cents < MIN_CENTS || cents > MAX_CENTS) {
        return null;
      }
      copy.push(cents);
    }
    return copy;
  }

  function freezeButtons(buttons) {
    return Object.freeze(buttons.slice());
  }

  /**
   * Botones con los que arranca la calculadora: 1, 0,5 y 0,25.
   * No tienen trato especial: se editan y se quitan como el resto.
   * Cada llamada devuelve una lista nueva.
   */
  function createDefaultButtons() {
    return freezeButtons([100, 50, 25]);
  }

  function centsAlreadyUsed(existingCents, cents) {
    var i;
    if (existingCents === undefined || existingCents === null) {
      return false;
    }
    if (typeof existingCents.length !== 'number') {
      return null;
    }
    for (i = 0; i < existingCents.length; i += 1) {
      if (existingCents[i] === cents) {
        return true;
      }
    }
    return false;
  }

  /**
   * Valida el texto de un botón.
   * existingCents: céntimos ya usados (sin el botón que se está editando).
   * Devuelve { ok: true, cents } o { ok: false, error }.
   * Los duplicados se comparan en céntimos: "0,5" y ".5" son el mismo.
   */
  function validateButtonValue(text, existingCents) {
    var parsed;
    var duplicate;
    parsed = parseToCents(text);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    if (parsed.cents < MIN_CENTS) {
      return fail(ERROR_MIN_CENTS);
    }
    if (parsed.cents > MAX_CENTS) {
      return fail(ERROR_MAX_CENTS);
    }
    duplicate = centsAlreadyUsed(existingCents, parsed.cents);
    if (duplicate === null) {
      return fail(ERROR_BAD_BUTTONS);
    }
    if (duplicate) {
      return fail(ERROR_DUPLICATE);
    }
    return succeed(parsed.cents);
  }

  /**
   * Añade un botón a partir del texto. No modifica la lista recibida.
   * Primero valida el valor y después el cupo, para que un texto inválido
   * explique el valor aunque ya haya el máximo de botones.
   */
  function addButton(buttons, text) {
    var copy;
    var validated;
    copy = copyButtons(buttons);
    if (copy === null) {
      return fail(ERROR_BAD_BUTTONS);
    }
    validated = validateButtonValue(text, copy);
    if (!validated.ok) {
      return fail(validated.error);
    }
    if (copy.length >= MAX_BUTTONS) {
      return fail(ERROR_MAX_BUTTONS);
    }
    copy.push(validated.cents);
    return {
      ok: true,
      buttons: freezeButtons(copy),
      cents: validated.cents
    };
  }

  /**
   * Sustituye el botón index por el texto indicado.
   * El propio botón no cuenta como duplicado de sí mismo.
   */
  function updateButton(buttons, index, text) {
    var copy;
    var others;
    var validated;
    copy = copyButtons(buttons);
    if (copy === null) {
      return fail(ERROR_BAD_BUTTONS);
    }
    if (!Number.isInteger(index) || index < 0 || index >= copy.length) {
      return fail(ERROR_MISSING_BUTTON);
    }
    others = copy.slice(0, index).concat(copy.slice(index + 1));
    validated = validateButtonValue(text, others);
    if (!validated.ok) {
      return fail(validated.error);
    }
    copy[index] = validated.cents;
    return {
      ok: true,
      buttons: freezeButtons(copy),
      cents: validated.cents
    };
  }

  /**
   * Quita el botón index. Rechaza quitar el último: tiene que quedar
   * al menos MIN_BUTTONS. No modifica la lista recibida.
   */
  function removeButton(buttons, index) {
    var copy;
    copy = copyButtons(buttons);
    if (copy === null) {
      return fail(ERROR_BAD_BUTTONS);
    }
    if (!Number.isInteger(index) || index < 0 || index >= copy.length) {
      return fail(ERROR_MISSING_BUTTON);
    }
    if (copy.length <= MIN_BUTTONS) {
      return fail(ERROR_MIN_BUTTONS);
    }
    copy.splice(index, 1);
    return {
      ok: true,
      buttons: freezeButtons(copy)
    };
  }

  return {
    parseToCents: parseToCents,
    formatCents: formatCents,
    createState: createState,
    addValue: addValue,
    removeLast: removeLast,
    reset: reset,
    getTotal: getTotal,
    getList: getList,
    MIN_CENTS: MIN_CENTS,
    MAX_CENTS: MAX_CENTS,
    MIN_BUTTONS: MIN_BUTTONS,
    MAX_BUTTONS: MAX_BUTTONS,
    ERROR_MIN_CENTS: ERROR_MIN_CENTS,
    ERROR_MAX_CENTS: ERROR_MAX_CENTS,
    ERROR_DUPLICATE: ERROR_DUPLICATE,
    ERROR_MAX_BUTTONS: ERROR_MAX_BUTTONS,
    ERROR_MIN_BUTTONS: ERROR_MIN_BUTTONS,
    createDefaultButtons: createDefaultButtons,
    validateButtonValue: validateButtonValue,
    addButton: addButton,
    updateButton: updateButton,
    removeButton: removeButton
  };
});
