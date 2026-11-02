/**
 * Calculadora para profesores — lógica pura de suma (T-002, v0.1.0).
 *
 * Trabaja solo con enteros (céntimos). No lee la página, no guarda
 * datos y no usa la red. La pantalla lo usa para sumar, quitar el
 * último valor y reiniciar.
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
 * Acepta coma o punto, recorta espacios y solo admite un valor > 0
 * con 2 decimales como máximo. La parte entera y los decimales se
 * leen del texto por separado; no se multiplica un decimal binario
 * por 100.
 *
 * Señal de error: { ok: false, error: "mensaje en español" }.
 * Si el valor sirve: { ok: true, cents: <entero seguro> }.
 *
 * Estado: { values } congelado. El total no se guarda aparte: getTotal
 * suma la lista, así que siempre coincide con ella. addValue y reset
 * devuelven un estado nuevo. removeLast, con la lista vacía, devuelve
 * el mismo estado.
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
    if (text.length === 0) {
      return fail('El valor está vacío.');
    }
    for (i = 0; i < text.length; i += 1) {
      ch = text.charAt(i);
      if (ch === '-') {
        return fail('No se admiten valores negativos.');
      }
      if (ch === ',' || ch === '.') {
        separators += 1;
        separatorAt = i;
      } else if (ch < '0' || ch > '9') {
        hasOtherChar = true;
      }
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
      if (intPart.length === 0) {
        return fail('Falta la parte entera.');
      }
      if (decPart.length === 0) {
        return fail('El formato decimal no es válido.');
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

  return {
    parseToCents: parseToCents,
    formatCents: formatCents,
    createState: createState,
    addValue: addValue,
    removeLast: removeLast,
    reset: reset,
    getTotal: getTotal,
    getList: getList
  };
});
