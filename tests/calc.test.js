'use strict';

/**
 * Pruebas de la lógica de suma (T-002).
 * Ejecutar desde la raíz del proyecto: node tests/calc.test.js
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

function mustParse(input) {
  const result = Calc.parseToCents(input);
  assert.strictEqual(result.ok, true, 'se esperaba aceptar ' + JSON.stringify(input));
  assert.strictEqual(typeof result.cents, 'number');
  assert.ok(Number.isSafeInteger(result.cents));
  assert.ok(result.cents > 0);
  return result.cents;
}

function mustReject(input, message) {
  const result = Calc.parseToCents(input);
  assert.strictEqual(result.ok, false, 'se esperaba rechazar ' + JSON.stringify(input));
  assert.strictEqual(result.error, message);
  assert.strictEqual(result.cents, undefined);
  return result.error;
}

function sumList(list) {
  let total = 0;
  for (let i = 0; i < list.length; i += 1) {
    total += list[i];
  }
  return total;
}

function assertInvariant(state) {
  const list = Calc.getList(state);
  assert.strictEqual(Calc.getTotal(state), sumList(list));
  assert.ok(Number.isSafeInteger(Calc.getTotal(state)));
  for (let i = 0; i < list.length; i += 1) {
    assert.ok(Number.isSafeInteger(list[i]));
    assert.ok(list[i] > 0);
  }
}

function addParsed(state, input) {
  return Calc.addValue(state, mustParse(input));
}

test('0,1 + 0,2 = 0,30', function () {
  let state = Calc.createState();
  state = addParsed(state, '0,1');
  state = addParsed(state, '0,2');
  assertInvariant(state);
  assert.deepStrictEqual(Calc.getList(state), [10, 20]);
  assert.strictEqual(Calc.getTotal(state), 30);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '0,30');
  assert.strictEqual(mustParse(0.1), 10);
  assert.strictEqual(mustParse(0.2), 20);
});

test('1 + 0,5 + 0,25 = 1,75', function () {
  let state = Calc.createState();
  state = addParsed(state, 1);
  state = addParsed(state, '0,5');
  state = addParsed(state, '0,25');
  assertInvariant(state);
  assert.deepStrictEqual(Calc.getList(state), [100, 50, 25]);
  assert.strictEqual(Calc.getTotal(state), 175);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '1,75');
});

test('cien sumas de 0,01 = 1,00', function () {
  const cent = mustParse('0,01');
  assert.strictEqual(cent, 1);
  let state = Calc.createState();
  for (let i = 0; i < 100; i += 1) {
    state = Calc.addValue(state, cent);
    assertInvariant(state);
  }
  assert.strictEqual(Calc.getList(state).length, 100);
  assert.strictEqual(Calc.getTotal(state), 100);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '1,00');
});

test('mil sumas de 0,25 = 250,00 (25000 céntimos)', function () {
  const quarter = mustParse('0,25');
  assert.strictEqual(quarter, 25);
  let state = Calc.createState();
  for (let i = 0; i < 1000; i += 1) {
    state = Calc.addValue(state, quarter);
    assertInvariant(state);
  }
  assert.strictEqual(Calc.getList(state).length, 1000);
  assert.strictEqual(Calc.getTotal(state), 25000);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '250,00');
});

test('"0,5" y "0.5" se aceptan y valen lo mismo', function () {
  const comma = mustParse('0,5');
  const dot = mustParse('0.5');
  const spacedComma = mustParse('  0,5  ');
  const spacedDot = mustParse(' 0.5 ');
  const numeric = mustParse(0.5);
  const padded = mustParse('0,50');
  assert.strictEqual(comma, 50);
  assert.strictEqual(dot, comma);
  assert.strictEqual(spacedComma, comma);
  assert.strictEqual(spacedDot, comma);
  assert.strictEqual(numeric, comma);
  assert.strictEqual(padded, comma);
  assert.strictEqual(Calc.formatCents(comma), '0,50');
});

test('rechaza letras, negativos, más de 2 decimales, vacío, cero y "1,2,3"', function () {
  mustReject('abc', 'El valor contiene caracteres no numéricos.');
  mustReject('12a', 'El valor contiene caracteres no numéricos.');
  mustReject('1a,5', 'El valor contiene caracteres no numéricos.');
  mustReject('-1', 'No se admiten valores negativos.');
  mustReject('-0,5', 'No se admiten valores negativos.');
  mustReject(-1, 'No se admiten valores negativos.');
  mustReject(-0.5, 'No se admiten valores negativos.');
  mustReject('1,234', 'Solo se admiten hasta 2 decimales.');
  mustReject('0.001', 'Solo se admiten hasta 2 decimales.');
  mustReject(0.001, 'Solo se admiten hasta 2 decimales.');
  mustReject('', 'El valor está vacío.');
  mustReject('   ', 'El valor está vacío.');
  mustReject('0', 'El valor debe ser mayor que cero.');
  mustReject('0,00', 'El valor debe ser mayor que cero.');
  mustReject('0.0', 'El valor debe ser mayor que cero.');
  mustReject(0, 'El valor debe ser mayor que cero.');
  mustReject('1,2,3', 'Solo se admite un separador decimal.');
  mustReject('1.2.3', 'Solo se admite un separador decimal.');
  mustReject('1,2.3', 'Solo se admite un separador decimal.');
  mustReject(Number.NaN, 'El valor no es un número válido.');
  mustReject(Number.POSITIVE_INFINITY, 'El valor no es finito.');
  mustReject(Number.NEGATIVE_INFINITY, 'El valor no es finito.');
  mustReject(1e21, 'El valor no se puede representar de forma segura.');
  mustReject('99999999999999999999', 'El valor es demasiado grande para sumarse con seguridad.');
});

test('borrar el último con la lista vacía no falla', function () {
  const empty = Calc.createState();
  let returned;
  assert.doesNotThrow(function () {
    returned = Calc.removeLast(empty);
  });
  assert.strictEqual(returned, empty);
  assert.strictEqual(Calc.getTotal(returned), 0);
  assert.deepStrictEqual(Calc.getList(returned), []);
  assertInvariant(returned);
});

test('borrar varias veces seguidas', function () {
  let state = Calc.createState();
  state = addParsed(state, '1');
  state = addParsed(state, '0,50');
  state = addParsed(state, '0,25');
  assert.deepStrictEqual(Calc.getList(state), [100, 50, 25]);

  state = Calc.removeLast(state);
  assertInvariant(state);
  assert.deepStrictEqual(Calc.getList(state), [100, 50]);
  assert.strictEqual(Calc.getTotal(state), 150);

  state = Calc.removeLast(state);
  assertInvariant(state);
  assert.deepStrictEqual(Calc.getList(state), [100]);

  state = Calc.removeLast(state);
  assertInvariant(state);
  assert.strictEqual(Calc.getTotal(state), 0);
  assert.deepStrictEqual(Calc.getList(state), []);

  const onceMore = Calc.removeLast(state);
  const twiceMore = Calc.removeLast(onceMore);
  assert.strictEqual(onceMore, state);
  assert.strictEqual(twiceMore, state);
  assert.strictEqual(Calc.getTotal(twiceMore), 0);
  assert.deepStrictEqual(Calc.getList(twiceMore), []);
});

test('reset deja total 0 y lista vacía', function () {
  let state = Calc.createState();
  state = addParsed(state, '2');
  state = addParsed(state, '0,5');
  assert.ok(Calc.getTotal(state) > 0);
  const cleared = Calc.reset(state);
  assertInvariant(cleared);
  assert.strictEqual(Calc.getTotal(cleared), 0);
  assert.deepStrictEqual(Calc.getList(cleared), []);
  assert.ok(Calc.getTotal(state) > 0);
  assert.deepStrictEqual(Calc.getList(state), [200, 50]);
  const clearedAgain = Calc.reset(cleared);
  assert.strictEqual(Calc.getTotal(clearedAgain), 0);
  assert.deepStrictEqual(Calc.getList(clearedAgain), []);
});

test('en cada paso el total coincide con la suma de la lista', function () {
  let state = Calc.createState();
  assertInvariant(state);

  const steps = [
    function add(current) { return addParsed(current, '0,1'); },
    function add(current) { return addParsed(current, '0,2'); },
    function add(current) { return addParsed(current, 1); },
    function add(current) { return addParsed(current, '0,25'); },
    function remove(current) { return Calc.removeLast(current); },
    function add(current) { return addParsed(current, '0.01'); },
    function remove(current) { return Calc.removeLast(current); },
    function remove(current) { return Calc.removeLast(current); },
    function reset(current) { return Calc.reset(current); },
    function add(current) { return addParsed(current, '10'); },
    function remove(current) { return Calc.removeLast(current); }
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const previous = state;
    const previousList = Calc.getList(previous);
    state = steps[i](previous);
    assertInvariant(state);
    assert.deepStrictEqual(Calc.getList(previous), previousList);
    assert.strictEqual(Calc.getTotal(previous), sumList(previousList));
  }

  assert.strictEqual(Calc.getTotal(state), 0);
  assert.deepStrictEqual(Calc.getList(state), []);

  state = addParsed(Calc.createState(), '1,5');
  const external = Calc.getList(state);
  external.push(999);
  assert.deepStrictEqual(Calc.getList(state), [150]);
  assert.strictEqual(Calc.getTotal(state), 150);
});

test('formato de varios valores', function () {
  const samples = [
    [0, '0,00'],
    [1, '0,01'],
    [5, '0,05'],
    [30, '0,30'],
    [50, '0,50'],
    [100, '1,00'],
    [150, '1,50'],
    [175, '1,75'],
    [25000, '250,00'],
    [123456, '1234,56']
  ];
  for (let i = 0; i < samples.length; i += 1) {
    assert.strictEqual(Calc.formatCents(samples[i][0]), samples[i][1]);
  }
  assert.throws(function () {
    Calc.formatCents(-1);
  });
  assert.throws(function () {
    Calc.formatCents(1.5);
  });
  assert.throws(function () {
    Calc.addValue(Calc.createState(), 0);
  });
});

console.log('');
console.log('Total: ' + (failed === 0 ? 'todas pasaron' : failed + ' fallo(s)'));
if (failed > 0) {
  process.exitCode = 1;
}
