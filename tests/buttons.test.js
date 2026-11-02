'use strict';

/**
 * Pruebas de los botones del profesor (T-008).
 * Ejecutar desde la raíz del proyecto: node tests/buttons.test.js
 * Solo usa node:assert. Si algo falla, el proceso termina con código 1.
 * Este fichero no forma parte de la página.
 */

const assert = require('node:assert');
const Calc = require('../calc.js');

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('ok  ' + name);
  } catch (error) {
    failed += 1;
    console.log('FALLO  ' + name);
    console.log(error && error.stack ? error.stack : String(error));
  }
}

function mustValidate(text, existingCents, expectedCents) {
  const result = Calc.validateButtonValue(text, existingCents);
  assert.strictEqual(result.ok, true, 'se esperaba aceptar ' + JSON.stringify(text) + ' y llegó ' + JSON.stringify(result));
  assert.strictEqual(result.cents, expectedCents);
  assert.strictEqual(result.error, undefined);
  return result;
}

function mustRejectValue(text, existingCents, message) {
  const result = Calc.validateButtonValue(text, existingCents);
  assert.strictEqual(result.ok, false, 'se esperaba rechazar ' + JSON.stringify(text));
  assert.strictEqual(result.error, message, 'mensaje de ' + JSON.stringify(text));
  assert.strictEqual(result.cents, undefined);
  assert.strictEqual(result.buttons, undefined);
  return result;
}

test('límites confirmados por el dueño', function () {
  assert.strictEqual(Calc.MIN_CENTS, 1);
  assert.strictEqual(Calc.MAX_CENTS, 10000);
  assert.strictEqual(Calc.MIN_BUTTONS, 1);
  assert.strictEqual(Calc.MAX_BUTTONS, 12);
  assert.strictEqual(Calc.ERROR_MIN_CENTS, 'El valor mínimo de un botón es 0,01.');
  assert.strictEqual(Calc.ERROR_MAX_CENTS, 'El valor máximo de un botón es 100,00.');
  assert.strictEqual(Calc.ERROR_DUPLICATE, 'Ese valor ya está en otro botón.');
  assert.strictEqual(Calc.ERROR_MAX_BUTTONS, 'No se pueden tener más de 12 botones.');
  assert.strictEqual(Calc.ERROR_MIN_BUTTONS, 'Tiene que quedar al menos 1 botón.');
  assert.strictEqual(Calc.formatCents(Calc.MIN_CENTS), '0,01');
  assert.strictEqual(Calc.formatCents(Calc.MAX_CENTS), '100,00');
});

test('botones iniciales: 1, 0,5 y 0,25', function () {
  const first = Calc.createDefaultButtons();
  const second = Calc.createDefaultButtons();
  assert.deepStrictEqual(first, [100, 50, 25]);
  assert.deepStrictEqual(second, [100, 50, 25]);
  assert.notStrictEqual(first, second);
  assert.strictEqual(Calc.formatCents(first[0]), '1,00');
  assert.strictEqual(Calc.formatCents(first[1]), '0,50');
  assert.strictEqual(Calc.formatCents(first[2]), '0,25');
  assert.throws(function () {
    first.push(200);
  });
});

test('valores válidos de botón', function () {
  const cases = [
    ['1', 100],
    ['0,5', 50],
    ['0.5', 50],
    ['.5', 50],
    [',5', 50],
    ['1,', 100],
    ['1.', 100],
    [' 2,25 ', 225],
    ['0,01', 1],
    ['.01', 1],
    ['100', 10000],
    ['100,00', 10000],
    ['100.00', 10000],
    ['100,', 10000],
    ['  100  ', 10000]
  ];
  for (let i = 0; i < cases.length; i += 1) {
    mustValidate(cases[i][0], [], cases[i][1]);
    assert.strictEqual(Calc.parseToCents(cases[i][0]).cents, cases[i][1]);
  }
});

test('valores inválidos de botón', function () {
  const cases = [
    ['1.234', 'Solo se admiten hasta 2 decimales.'],
    ['0,001', 'Solo se admiten hasta 2 decimales.'],
    ['1,234', 'Solo se admiten hasta 2 decimales.'],
    ['0', 'El valor debe ser mayor que cero.'],
    ['0,00', 'El valor debe ser mayor que cero.'],
    ['0.00', 'El valor debe ser mayor que cero.'],
    ['-1', 'No se admiten valores negativos.'],
    ['-0,5', 'No se admiten valores negativos.'],
    ['abc', 'El valor contiene caracteres no numéricos.'],
    ['1e2', 'No se admite la notación científica.'],
    ['1E2', 'No se admite la notación científica.'],
    ['1e+2', 'No se admite la notación científica.'],
    ['', 'El valor está vacío.'],
    ['   ', 'El valor está vacío.'],
    ['100,01', 'El valor máximo de un botón es 100,00.'],
    ['100.01', 'El valor máximo de un botón es 100,00.'],
    ['100,1', 'El valor máximo de un botón es 100,00.'],
    ['101', 'El valor máximo de un botón es 100,00.'],
    ['1,2,3', 'Solo se admite un separador decimal.'],
    ['.', 'El formato decimal no es válido.'],
    [',', 'El formato decimal no es válido.']
  ];
  for (let i = 0; i < cases.length; i += 1) {
    mustRejectValue(cases[i][0], [], cases[i][1]);
  }
});

test('el tope de 100 es del botón, no de parseToCents', function () {
  const parsed = Calc.parseToCents('100,01');
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.cents, 10001);
  mustRejectValue('100,01', [], 'El valor máximo de un botón es 100,00.');
  assert.strictEqual(Calc.parseToCents('250').cents, 25000);
  mustRejectValue('250', [], 'El valor máximo de un botón es 100,00.');
});

test('duplicados en céntimos: "0,5" y ".5"', function () {
  mustRejectValue('0,5', [50], 'Ese valor ya está en otro botón.');
  mustRejectValue('.5', [50], 'Ese valor ya está en otro botón.');
  mustRejectValue('0.5', [50], 'Ese valor ya está en otro botón.');
  mustRejectValue('0,50', [50], 'Ese valor ya está en otro botón.');
  mustRejectValue(',5', [50], 'Ese valor ya está en otro botón.');
  mustRejectValue('  .5  ', [50], 'Ese valor ya está en otro botón.');
  mustValidate('0,5', [100, 25], 50);
  mustValidate('.5', [], 50);
  mustValidate('1', [50, 25], 100);
});

test('no se pasa de 12 botones', function () {
  let buttons = [100];
  const samples = ['0,5', '0,25', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  assert.strictEqual(samples.length, 11);
  for (let i = 0; i < samples.length; i += 1) {
    const before = buttons.slice();
    const added = Calc.addButton(buttons, samples[i]);
    assert.strictEqual(added.ok, true, samples[i]);
    assert.strictEqual(added.buttons.length, before.length + 1);
    assert.deepStrictEqual(buttons, before);
    buttons = added.buttons;
  }
  assert.strictEqual(buttons.length, 12);
  const before = buttons.slice();
  const rejected = Calc.addButton(buttons, '11');
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.error, 'No se pueden tener más de 12 botones.');
  assert.strictEqual(rejected.buttons, undefined);
  assert.strictEqual(rejected.cents, undefined);
  assert.deepStrictEqual(buttons, before);
  assert.strictEqual(buttons.length, 12);
  const invalidAtMax = Calc.addButton(buttons, 'abc');
  assert.strictEqual(invalidAtMax.ok, false);
  assert.strictEqual(invalidAtMax.error, 'El valor contiene caracteres no numéricos.');
  assert.strictEqual(buttons.length, 12);
});

test('la función pura rechaza quitar el último botón', function () {
  const one = [100];
  const rejected = Calc.removeButton(one, 0);
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.error, 'Tiene que quedar al menos 1 botón.');
  assert.strictEqual(rejected.buttons, undefined);
  assert.deepStrictEqual(one, [100]);

  const custom = Calc.addButton([], '2');
  assert.deepStrictEqual(custom.buttons, [200]);
  const rejectedCustom = Calc.removeButton(custom.buttons, 0);
  assert.strictEqual(rejectedCustom.ok, false);
  assert.strictEqual(rejectedCustom.error, 'Tiene que quedar al menos 1 botón.');
  assert.deepStrictEqual(custom.buttons, [200]);

  const two = [100, 50];
  const removed = Calc.removeButton(two, 0);
  assert.strictEqual(removed.ok, true);
  assert.deepStrictEqual(removed.buttons, [50]);
  assert.deepStrictEqual(two, [100, 50]);
  const last = Calc.removeButton(removed.buttons, 0);
  assert.strictEqual(last.ok, false);
  assert.strictEqual(last.error, 'Tiene que quedar al menos 1 botón.');
  assert.deepStrictEqual(removed.buttons, [50]);
});

test('los botones iniciales se editan y se quitan como cualquier otro', function () {
  const original = Calc.createDefaultButtons();
  const edited = Calc.updateButton(original, 0, '2');
  assert.strictEqual(edited.ok, true);
  assert.strictEqual(edited.cents, 200);
  assert.deepStrictEqual(edited.buttons, [200, 50, 25]);
  assert.deepStrictEqual(original, [100, 50, 25]);

  const same = Calc.updateButton(original, 1, '.5');
  assert.strictEqual(same.ok, true);
  assert.deepStrictEqual(same.buttons, [100, 50, 25]);

  const duplicate = Calc.updateButton(original, 0, '0,5');
  assert.strictEqual(duplicate.ok, false);
  assert.strictEqual(duplicate.error, 'Ese valor ya está en otro botón.');
  assert.deepStrictEqual(original, [100, 50, 25]);

  const invalid = Calc.updateButton(original, 2, '1.234');
  assert.strictEqual(invalid.ok, false);
  assert.strictEqual(invalid.error, 'Solo se admiten hasta 2 decimales.');
  assert.deepStrictEqual(original, [100, 50, 25]);

  let buttons = original;
  buttons = Calc.removeButton(buttons, 2).buttons;
  assert.deepStrictEqual(buttons, [100, 50]);
  buttons = Calc.removeButton(buttons, 0).buttons;
  assert.deepStrictEqual(buttons, [50]);
  const stuck = Calc.removeButton(buttons, 0);
  assert.strictEqual(stuck.ok, false);
  assert.strictEqual(stuck.error, 'Tiene que quedar al menos 1 botón.');
  assert.deepStrictEqual(buttons, [50]);
  assert.deepStrictEqual(Calc.createDefaultButtons(), [100, 50, 25]);
});

test('un texto inválido no añade ni modifica', function () {
  const original = [100, 50, 25];
  const added = Calc.addButton(original, '');
  assert.strictEqual(added.ok, false);
  assert.strictEqual(added.error, 'El valor está vacío.');
  assert.deepStrictEqual(original, [100, 50, 25]);
  const changed = Calc.updateButton(original, 1, '-1');
  assert.strictEqual(changed.ok, false);
  assert.strictEqual(changed.error, 'No se admiten valores negativos.');
  assert.deepStrictEqual(original, [100, 50, 25]);
});

test('0,1 y 0,2 validados suman 0,30', function () {
  const first = mustValidate('0,1', [], 10);
  const second = mustValidate('0,2', [first.cents], 20);
  let state = Calc.createState();
  state = Calc.addValue(state, first.cents);
  state = Calc.addValue(state, second.cents);
  assert.deepStrictEqual(Calc.getList(state), [10, 20]);
  assert.strictEqual(Calc.getTotal(state), 30);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '0,30');
});

test('cambiar los botones no altera una suma ya hecha', function () {
  let state = Calc.createState();
  state = Calc.addValue(state, 100);
  state = Calc.addValue(state, 50);
  const listBefore = Calc.getList(state);
  const totalBefore = Calc.getTotal(state);
  let buttons = Calc.createDefaultButtons();
  buttons = Calc.updateButton(buttons, 0, '3').buttons;
  const removed = Calc.removeButton(buttons, 1);
  assert.strictEqual(removed.ok, true);
  assert.deepStrictEqual(Calc.getList(state), listBefore);
  assert.deepStrictEqual(listBefore, [100, 50]);
  assert.strictEqual(Calc.getTotal(state), totalBefore);
  assert.strictEqual(Calc.formatCents(totalBefore), '1,50');
});

console.log('');
console.log('Total: ' + (failed === 0 ? 'todas pasaron' : failed + ' fallo(s)'));
if (failed > 0) {
  process.exitCode = 1;
}
