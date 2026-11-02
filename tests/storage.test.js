'use strict';

/**
 * Pruebas de las plantillas de botones (T-009) y de actualizar la
 * plantilla en uso (T-010).
 * Ejecutar desde la raíz del proyecto: node tests/storage.test.js
 * Solo usa node:assert y un almacén en memoria. Si algo falla, el
 * proceso termina con un código distinto de cero.
 * Este fichero no forma parte de la página.
 */

const assert = require('node:assert');
const Calc = require('../calc.js');
const Store = require('../storage.js');

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

function memoryStorage(initial) {
  const items = Object.create(null);
  let writes = 0;
  if (initial) {
    Object.keys(initial).forEach(function (key) {
      items[key] = initial[key];
    });
  }
  return {
    get writes() {
      return writes;
    },
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null;
    },
    setItem: function (key, value) {
      writes += 1;
      items[key] = String(value);
    }
  };
}

function storageGetThrows() {
  let writes = 0;
  return {
    get writes() {
      return writes;
    },
    getItem: function () {
      throw new Error('fallo de lectura');
    },
    setItem: function () {
      writes += 1;
      throw new Error('no debería escribir');
    }
  };
}

function storageSetThrows(initial) {
  const items = Object.create(null);
  let writes = 0;
  if (initial) {
    Object.keys(initial).forEach(function (key) {
      items[key] = initial[key];
    });
  }
  return {
    get writes() {
      return writes;
    },
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null;
    },
    setItem: function () {
      writes += 1;
      throw new Error('cuota llena');
    }
  };
}

function document(templates, lastUsed) {
  return JSON.stringify({
    version: Store.STORAGE_VERSION,
    templates: templates,
    lastUsed: lastUsed
  });
}

function seed(templates, lastUsed) {
  const storage = memoryStorage();
  storage.setItem(Store.STORAGE_KEY, document(templates, lastUsed));
  const writesBefore = storage.writes;
  return { storage: storage, writesBefore: writesBefore };
}

function readSaved(storage) {
  const raw = storage.getItem(Store.STORAGE_KEY);
  assert.strictEqual(typeof raw, 'string');
  return JSON.parse(raw);
}

test('constantes de la clave, la versión y los límites', function () {
  assert.strictEqual(Store.STORAGE_KEY, 'calculadora-profes:v1');
  assert.strictEqual(Store.STORAGE_VERSION, 1);
  assert.strictEqual(Store.MAX_TEMPLATES, 20);
  assert.strictEqual(Store.MIN_TEMPLATE_NAME_LENGTH, 1);
  assert.strictEqual(Store.MAX_TEMPLATE_NAME_LENGTH, 30);
  assert.strictEqual(Store.nameKey('ÁULA'), Store.nameKey('áula'));
  assert.strictEqual(Store.nameKey('I'), 'i');
  assert.notStrictEqual(Store.nameKey('ÁULA'), Store.nameKey('aula'));
});

test('guardar, cargar, renombrar y borrar', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.getWarning(), '');
  assert.strictEqual(repo.getStartupButtons(), null);
  assert.deepStrictEqual(repo.listTemplates(), []);

  const saved = repo.saveTemplate('  Aula  ', [100, 50, 25]);
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(saved.name, 'Aula');
  assert.strictEqual(saved.warning, '');
  assert.strictEqual(repo.listTemplates().length, 1);
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, true);
  assert.deepStrictEqual(repo.getStartupButtons(), [100, 50, 25]);

  const other = repo.saveTemplate('Grupo', [200]);
  assert.strictEqual(other.ok, true);
  assert.strictEqual(repo.listTemplates()[1].isLastUsed, true);
  assert.deepStrictEqual(repo.getStartupButtons(), [200]);

  const loaded = repo.useTemplate('Aula');
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.persisted, true);
  assert.deepStrictEqual(loaded.buttons, [100, 50, 25]);
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, true);
  assert.strictEqual(repo.listTemplates()[1].isLastUsed, false);

  const renamed = repo.renameTemplate('Aula', '  Clase  ');
  assert.strictEqual(renamed.ok, true);
  assert.strictEqual(renamed.name, 'Clase');
  assert.strictEqual(repo.listTemplates()[0].name, 'Clase');
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, true);
  assert.strictEqual(repo.useTemplate('Aula').ok, false);
  assert.strictEqual(repo.useTemplate('Aula').error, Store.ERROR_NOT_FOUND);

  const removed = repo.removeTemplate('Grupo');
  assert.strictEqual(removed.ok, true);
  assert.strictEqual(repo.listTemplates().length, 1);
  assert.strictEqual(repo.listTemplates()[0].name, 'Clase');
  assert.strictEqual(repo.removeTemplate('Grupo').ok, false);
  assert.strictEqual(repo.removeTemplate('Grupo').error, Store.ERROR_NOT_FOUND);

  const data = readSaved(storage);
  assert.strictEqual(data.version, 1);
  assert.strictEqual(data.lastUsed, 'Clase');
  assert.deepStrictEqual(data.templates, [
    { name: 'Clase', buttons: [100, 50, 25] }
  ]);
});

test('nombres duplicados, también con otras mayúsculas, y renombrar a sí misma', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.saveTemplate('Aula', [100]).ok, true);
  const lower = repo.saveTemplate('aula', [200]);
  assert.strictEqual(lower.ok, false);
  assert.strictEqual(lower.error, Store.ERROR_NAME_DUPLICATE);
  const upper = repo.saveTemplate('AULA', [300]);
  assert.strictEqual(upper.ok, false);
  assert.strictEqual(upper.error, Store.ERROR_NAME_DUPLICATE);
  /* El acento no se elimina: «Áula» y «Aula» son nombres distintos.
     «ÁULA» sí choca con «Áula», porque solo cambian las mayúsculas. */
  const accent = repo.saveTemplate('Áula', [400]);
  assert.strictEqual(accent.ok, true);
  assert.strictEqual(accent.name, 'Áula');
  const accentCase = repo.saveTemplate('ÁULA', [500]);
  assert.strictEqual(accentCase.ok, false);
  assert.strictEqual(accentCase.error, Store.ERROR_NAME_DUPLICATE);
  assert.strictEqual(repo.listTemplates().length, 2);
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [100]);
  assert.strictEqual(repo.removeTemplate('Áula').ok, true);

  assert.strictEqual(repo.saveTemplate('Grupo', [200]).ok, true);
  const clash = repo.renameTemplate('Grupo', '  AULA ');
  assert.strictEqual(clash.ok, false);
  assert.strictEqual(clash.error, Store.ERROR_NAME_DUPLICATE);
  assert.strictEqual(repo.listTemplates()[1].name, 'Grupo');

  assert.strictEqual(repo.useTemplate('Aula').ok, true);
  const same = repo.renameTemplate('Aula', 'Aula');
  assert.strictEqual(same.ok, true);
  assert.strictEqual(same.name, 'Aula');
  const otherCase = repo.renameTemplate('Aula', 'AULA');
  assert.strictEqual(otherCase.ok, true);
  assert.strictEqual(otherCase.name, 'AULA');
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, true);
  assert.strictEqual(readSaved(storage).lastUsed, 'AULA');
  assert.deepStrictEqual(readSaved(storage).templates.map(function (item) {
    return item.name;
  }), ['AULA', 'Grupo']);
});

test('límites del nombre: vacío, espacios, 30, 31 y recorte', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  const thirty = 'a'.repeat(30);
  const thirtyOne = 'b'.repeat(31);

  const empty = repo.saveTemplate('', [100]);
  assert.strictEqual(empty.ok, false);
  assert.strictEqual(empty.error, Store.ERROR_NAME_EMPTY);
  const spaces = repo.saveTemplate('   ', [100]);
  assert.strictEqual(spaces.ok, false);
  assert.strictEqual(spaces.error, Store.ERROR_NAME_EMPTY);
  const blankLines = repo.saveTemplate('\n\t  ', [100]);
  assert.strictEqual(blankLines.ok, false);
  assert.strictEqual(blankLines.error, Store.ERROR_NAME_EMPTY);

  const ok = repo.saveTemplate('  ' + thirty + '  ', [100, 50]);
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.name, thirty);
  assert.strictEqual(ok.name.length, 30);

  const tooLong = repo.saveTemplate(thirtyOne, [200]);
  assert.strictEqual(tooLong.ok, false);
  assert.strictEqual(tooLong.error, Store.ERROR_NAME_LONG);
  const paddedLong = repo.saveTemplate('  ' + thirtyOne + ' ', [200]);
  assert.strictEqual(paddedLong.ok, false);
  assert.strictEqual(paddedLong.error, Store.ERROR_NAME_LONG);

  assert.strictEqual(repo.renameTemplate(thirty, '').ok, false);
  assert.strictEqual(repo.renameTemplate(thirty, '   ').error, Store.ERROR_NAME_EMPTY);
  assert.strictEqual(repo.renameTemplate(thirty, thirtyOne).error, Store.ERROR_NAME_LONG);
  assert.strictEqual(repo.listTemplates().length, 1);
  assert.strictEqual(readSaved(storage).templates[0].name, thirty);
});

test('la plantilla 21 se rechaza y las 20 siguen guardadas', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  let index;
  for (index = 1; index <= Store.MAX_TEMPLATES; index += 1) {
    const saved = repo.saveTemplate('P' + index, [index]);
    assert.strictEqual(saved.ok, true, 'plantilla ' + index);
  }
  assert.strictEqual(repo.listTemplates().length, 20);
  const extra = repo.saveTemplate('P21', [2100]);
  assert.strictEqual(extra.ok, false);
  assert.strictEqual(extra.error, Store.ERROR_MAX_TEMPLATES);
  assert.strictEqual(repo.listTemplates().length, 20);
  assert.strictEqual(readSaved(storage).templates.length, 20);
  assert.strictEqual(readSaved(storage).lastUsed, 'P20');
  assert.strictEqual(repo.removeTemplate('P1').ok, true);
  assert.strictEqual(repo.saveTemplate('P21', [2100]).ok, true);
  assert.strictEqual(repo.listTemplates().length, 20);
});

test('JSON corrupto no se sobrescribe al leer', function () {
  const storage = memoryStorage();
  storage.setItem(Store.STORAGE_KEY, '{esto no es json');
  const before = storage.getItem(Store.STORAGE_KEY);
  const writes = storage.writes;
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.getWarning(), Store.WARNING_CORRUPT);
  assert.strictEqual(repo.getStartupButtons(), null);
  assert.deepStrictEqual(repo.listTemplates(), []);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), before);
  assert.strictEqual(storage.writes, writes);

  assert.strictEqual(repo.saveTemplate('Aula', [100, 50, 25]).ok, true);
  const data = readSaved(storage);
  assert.strictEqual(data.version, 1);
  assert.strictEqual(data.lastUsed, 'Aula');
  assert.deepStrictEqual(data.templates[0].buttons, [100, 50, 25]);
});

test('JSON válido con estructura o versión incorrecta no se sobrescribe al leer', function () {
  const samples = [
    'null',
    '[]',
    '1',
    '"texto"',
    'true',
    JSON.stringify({ version: 1, templates: [] }),
    JSON.stringify({ templates: [], lastUsed: null }),
    JSON.stringify({ version: 2, templates: [], lastUsed: null }),
    JSON.stringify({ version: '1', templates: [], lastUsed: null }),
    JSON.stringify({ version: 1, templates: {}, lastUsed: null }),
    JSON.stringify({ version: 1, templates: [], lastUsed: 1 }),
    JSON.stringify({ version: 0, templates: [{ name: 'A', buttons: [100] }], lastUsed: 'A' })
  ];
  samples.forEach(function (raw, index) {
    const storage = memoryStorage();
    storage.setItem(Store.STORAGE_KEY, raw);
    const writes = storage.writes;
    const repo = Store.createRepository(storage);
    assert.strictEqual(repo.getWarning(), Store.WARNING_CORRUPT, 'muestra ' + index);
    assert.strictEqual(repo.getStartupButtons(), null, 'botones ' + index);
    assert.deepStrictEqual(repo.listTemplates(), [], 'lista ' + index);
    assert.strictEqual(storage.getItem(Store.STORAGE_KEY), raw, 'intacto ' + index);
    assert.strictEqual(storage.writes, writes, 'sin escritura ' + index);
  });
});

test('getItem que lanza, setItem que lanza y almacén ausente', function () {
  const broken = storageGetThrows();
  const unread = Store.createRepository(broken);
  assert.strictEqual(unread.getWarning(), Store.ERROR_STORAGE_UNAVAILABLE);
  assert.strictEqual(unread.getStartupButtons(), null);
  assert.deepStrictEqual(unread.listTemplates(), []);
  const saveOnBroken = unread.saveTemplate('Aula', [100]);
  assert.strictEqual(saveOnBroken.ok, false);
  assert.strictEqual(saveOnBroken.error, Store.ERROR_STORAGE_UNAVAILABLE);
  assert.strictEqual(broken.writes, 0);

  const seeded = document([{ name: 'Aula', buttons: [100, 50] }], 'Aula');
  const quota = storageSetThrows();
  quota.getItem = function () {
    return seeded;
  };
  const readable = Store.createRepository(quota);
  assert.strictEqual(readable.getWarning(), '');
  assert.deepStrictEqual(readable.getStartupButtons(), [100, 50]);
  const writesBefore = quota.writes;
  const blocked = readable.saveTemplate('Otra', [200]);
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.error, Store.ERROR_STORAGE_WRITE);
  assert.strictEqual(readable.listTemplates().length, 1);
  assert.strictEqual(readable.listTemplates()[0].name, 'Aula');
  assert.ok(quota.writes > writesBefore);
  const renameBlocked = readable.renameTemplate('Aula', 'Clase');
  assert.strictEqual(renameBlocked.ok, false);
  assert.strictEqual(renameBlocked.error, Store.ERROR_STORAGE_WRITE);
  assert.strictEqual(readable.listTemplates()[0].name, 'Aula');
  const removeBlocked = readable.removeTemplate('Aula');
  assert.strictEqual(removeBlocked.ok, false);
  assert.strictEqual(removeBlocked.error, Store.ERROR_STORAGE_WRITE);
  assert.strictEqual(readable.listTemplates().length, 1);
  const loaded = readable.useTemplate('Aula');
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.persisted, false);
  assert.deepStrictEqual(loaded.buttons, [100, 50]);
  assert.strictEqual(loaded.warning, Store.ERROR_STORAGE_WRITE);

  [null, undefined].forEach(function (missing) {
    const repo = Store.createRepository(missing);
    assert.strictEqual(repo.getWarning(), Store.ERROR_STORAGE_UNAVAILABLE);
    assert.strictEqual(repo.getStartupButtons(), null);
    assert.strictEqual(repo.saveTemplate('Aula', [100]).ok, false);
    assert.strictEqual(repo.saveTemplate('Aula', [100]).error, Store.ERROR_STORAGE_UNAVAILABLE);
    assert.strictEqual(repo.listTemplates().length, 0);
  });

  assert.strictEqual(Store.openBrowserStorage(), null);
});

test('una plantilla con botones inválidos se descarta y las válidas se conservan', function () {
  const thirteen = [];
  let cents;
  for (cents = 1; cents <= 13; cents += 1) {
    thirteen.push(cents);
  }
  const raw = document([
    { name: 'Texto', buttons: ['abc'] },
    { name: 'Cero', buttons: [0] },
    { name: 'Grande', buttons: [10001] },
    { name: 'Dup', buttons: [100, 100] },
    { name: 'Trece', buttons: thirteen },
    { name: 'Vacia', buttons: [] },
    { name: 'Negativo', buttons: [-1] },
    { name: 'Decimal', buttons: [1.5] },
    { name: '   ', buttons: [100] },
    { name: 'x'.repeat(31), buttons: [100] },
    { name: 'Buena', buttons: [100, 50, 25] },
    { name: 'buena', buttons: [300] },
    { name: '  Otra  ', buttons: [200] },
    { name: 'Suelta', buttons: [100, 50, 25, 200] }
  ], 'Texto');
  const storage = memoryStorage();
  storage.setItem(Store.STORAGE_KEY, raw);
  const writes = storage.writes;
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.getWarning(), Store.WARNING_PARTIAL);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), raw);
  assert.strictEqual(storage.writes, writes);
  assert.strictEqual(repo.getStartupButtons(), null);
  const names = repo.listTemplates().map(function (item) {
    return item.name;
  });
  assert.deepStrictEqual(names, ['Buena', 'Otra', 'Suelta']);
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [100, 50, 25]);
  assert.deepStrictEqual(repo.listTemplates()[1].buttons, [200]);
  assert.deepStrictEqual(repo.listTemplates()[2].buttons, [100, 50, 25, 200]);
  assert.strictEqual(Store.validateButtonList([100, 50, 25]) !== null, true);
  assert.strictEqual(Store.validateButtonList([]), null);
  assert.strictEqual(Store.validateButtonList([0]), null);
  assert.strictEqual(Store.validateButtonList([10001]), null);
  assert.strictEqual(Store.validateButtonList(['abc']), null);
  assert.strictEqual(Store.validateButtonList([100, 100]), null);
  assert.strictEqual(Store.validateButtonList(thirteen), null);
});

test('la última usada sigue tras recargar y, si se borra, vuelven los botones por defecto', function () {
  const storage = memoryStorage();
  let repo = Store.createRepository(storage);
  assert.strictEqual(repo.saveTemplate('A', [100, 50, 25]).ok, true);
  assert.strictEqual(repo.saveTemplate('B', [200, 300]).ok, true);
  assert.deepStrictEqual(repo.useTemplate('A').buttons, [100, 50, 25]);

  repo = Store.createRepository(storage);
  assert.strictEqual(repo.getWarning(), '');
  assert.deepStrictEqual(repo.getStartupButtons(), [100, 50, 25]);
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, true);
  assert.strictEqual(repo.listTemplates()[1].isLastUsed, false);

  assert.strictEqual(repo.removeTemplate('A').ok, true);
  repo = Store.createRepository(storage);
  assert.strictEqual(repo.getStartupButtons(), null);
  assert.strictEqual(repo.listTemplates().length, 1);
  assert.strictEqual(repo.listTemplates()[0].name, 'B');
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, false);
  assert.strictEqual(readSaved(storage).lastUsed, null);
});

test('la suma no aparece en lo guardado y cargar una plantilla no la toca', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  let state = Calc.createState();
  state = Calc.addValue(state, Calc.parseToCents('0,1').cents);
  state = Calc.addValue(state, Calc.parseToCents('0,2').cents);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '0,30');
  assert.deepStrictEqual(Calc.getList(state), [10, 20]);

  assert.strictEqual(repo.saveTemplate('Aula', [100, 50, 25]).ok, true);
  const loaded = repo.useTemplate('Aula');
  assert.deepStrictEqual(loaded.buttons, [100, 50, 25]);
  assert.strictEqual(Calc.getTotal(state), 30);
  assert.deepStrictEqual(Calc.getList(state), [10, 20]);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '0,30');

  const raw = storage.getItem(Store.STORAGE_KEY);
  const data = JSON.parse(raw);
  assert.deepStrictEqual(Object.keys(data).sort(), ['lastUsed', 'templates', 'version']);
  assert.deepStrictEqual(Object.keys(data.templates[0]).sort(), ['buttons', 'name']);
  assert.strictEqual(raw.includes('"total"'), false);
  assert.strictEqual(raw.includes('"values"'), false);
  assert.strictEqual(raw.includes('"list"'), false);
  assert.strictEqual(raw.includes('"state"'), false);
  assert.deepStrictEqual(data.templates[0].buttons, [100, 50, 25]);
  assert.strictEqual(storage.getItem('total'), null);
  assert.strictEqual(Object.keys(JSON.parse(JSON.stringify(data))).length, 3);
});

test('guardar no modifica el array recibido ni una edición posterior cambia lo guardado', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  const input = [100, 50, 25];
  assert.strictEqual(repo.saveTemplate('Aula', input).ok, true);
  input.push(200);
  input[0] = 1;
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [100, 50, 25]);
  const startup = repo.getStartupButtons();
  startup.push(5);
  assert.deepStrictEqual(repo.getStartupButtons(), [100, 50, 25]);
  const listed = repo.listTemplates();
  listed[0].buttons.push(5);
  listed[0].name = 'Otro';
  assert.strictEqual(repo.listTemplates()[0].name, 'Aula');
  assert.deepStrictEqual(readSaved(storage).templates[0].buttons, [100, 50, 25]);
});

test('botones que no cumplen las reglas no se guardan', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  const rejected = [
    [],
    [0],
    [10001],
    [100, 100],
    ['1'],
    [100, 50, 25, 100],
    null,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  ];
  rejected.forEach(function (buttons) {
    const result = repo.saveTemplate('Mala', buttons);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, Store.ERROR_BUTTONS_INVALID);
  });
  assert.deepStrictEqual(repo.listTemplates(), []);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), null);
  assert.strictEqual(repo.saveTemplate('Buena', [1, 10000]).ok, true);
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [1, 10000]);
});

test('al leer, un nombre repetido se queda con la primera y no se escribe', function () {
  const raw = document([
    { name: 'Aula', buttons: [100] },
    { name: 'AULA', buttons: [200] },
    { name: 'Grupo', buttons: [300] }
  ], 'Aula');
  const storage = memoryStorage();
  storage.setItem(Store.STORAGE_KEY, raw);
  const writes = storage.writes;
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.getWarning(), Store.WARNING_PARTIAL);
  assert.deepStrictEqual(repo.listTemplates().map(function (item) {
    return item.name;
  }), ['Aula', 'Grupo']);
  assert.deepStrictEqual(repo.getStartupButtons(), [100]);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), raw);
  assert.strictEqual(storage.writes, writes);
});

test('más de 20 plantillas válidas en el documento: se quedan las 20 primeras', function () {
  const templates = [];
  let index;
  for (index = 1; index <= 21; index += 1) {
    templates.push({ name: 'P' + index, buttons: [index] });
  }
  const raw = document(templates, 'P21');
  const storage = memoryStorage();
  storage.setItem(Store.STORAGE_KEY, raw);
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.getWarning(), Store.WARNING_PARTIAL);
  assert.strictEqual(repo.listTemplates().length, 20);
  assert.strictEqual(repo.listTemplates()[0].name, 'P1');
  assert.strictEqual(repo.listTemplates()[19].name, 'P20');
  assert.strictEqual(repo.getStartupButtons(), null);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), raw);
});

test('borrar la última usada deja lastUsed a null y renombrar la actualiza', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  repo.saveTemplate('A', [100]);
  repo.saveTemplate('B', [200]);
  assert.strictEqual(readSaved(storage).lastUsed, 'B');
  assert.strictEqual(repo.renameTemplate('B', 'Beta').ok, true);
  assert.strictEqual(readSaved(storage).lastUsed, 'Beta');
  assert.strictEqual(repo.removeTemplate('Beta').ok, true);
  assert.strictEqual(readSaved(storage).lastUsed, null);
  assert.deepStrictEqual(readSaved(storage).templates, [{ name: 'A', buttons: [100] }]);
});

/**
 * Igual que la pantalla: solo escribe si el plan dice «update».
 * confirmed false y botones distintos es cancelar: no se llama a
 * updateTemplateButtons.
 */
function applyIfConfirmed(repo, currentButtons, confirmed) {
  const name = repo.getLastUsedName();
  let saved = null;
  let index;
  const items = repo.listTemplates();
  for (index = 0; index < items.length; index += 1) {
    if (items[index].name === name) {
      saved = items[index].buttons;
    }
  }
  const plan = Store.planTemplateUpdate({
    lastUsed: name,
    savedButtons: saved,
    currentButtons: currentButtons,
    confirmed: confirmed
  });
  if (plan.action !== 'update') {
    return plan;
  }
  return repo.updateTemplateButtons(currentButtons);
}

test('actualizar sustituye los botones de la plantilla en uso y deja el nombre', function () {
  const storage = memoryStorage();
  let repo = Store.createRepository(storage);
  assert.strictEqual(repo.saveTemplate('A', [100, 50, 25]).ok, true);
  assert.strictEqual(repo.saveTemplate('B', [300]).ok, true);
  assert.strictEqual(repo.useTemplate('A').ok, true);
  assert.strictEqual(repo.getLastUsedName(), 'A');

  const current = [200, 400];
  const updated = repo.updateTemplateButtons(current);
  assert.strictEqual(updated.ok, true);
  assert.strictEqual(updated.unchanged, false);
  assert.strictEqual(updated.name, 'A');
  assert.strictEqual(updated.warning, '');
  current.push(1);
  current[0] = 5;
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [200, 400]);
  assert.strictEqual(repo.listTemplates()[0].name, 'A');
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, true);
  assert.deepStrictEqual(repo.listTemplates()[1].buttons, [300]);
  assert.strictEqual(repo.listTemplates()[1].name, 'B');
  assert.strictEqual(repo.getLastUsedName(), 'A');

  const data = readSaved(storage);
  assert.strictEqual(data.lastUsed, 'A');
  assert.deepStrictEqual(data.templates, [
    { name: 'A', buttons: [200, 400] },
    { name: 'B', buttons: [300] }
  ]);
  assert.deepStrictEqual(Object.keys(data).sort(), ['lastUsed', 'templates', 'version']);

  repo = Store.createRepository(storage);
  assert.strictEqual(repo.getWarning(), '');
  assert.strictEqual(repo.getLastUsedName(), 'A');
  assert.deepStrictEqual(repo.getStartupButtons(), [200, 400]);
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [200, 400]);
  assert.strictEqual(repo.listTemplates()[0].name, 'A');
  assert.deepStrictEqual(repo.listTemplates()[1].buttons, [300]);
  assert.strictEqual(readSaved(storage).lastUsed, 'A');
});

test('sin plantilla en uso no se escribe nada', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  const writes = storage.writes;
  const missing = repo.updateTemplateButtons([100, 50]);
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.error, Store.ERROR_NO_TEMPLATE_IN_USE);
  assert.strictEqual(storage.writes, writes);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), null);
  assert.strictEqual(repo.getLastUsedName(), null);
  assert.deepStrictEqual(repo.listTemplates(), []);

  assert.strictEqual(repo.saveTemplate('A', [100]).ok, true);
  assert.strictEqual(repo.removeTemplate('A').ok, true);
  const afterDelete = storage.writes;
  const raw = storage.getItem(Store.STORAGE_KEY);
  const again = repo.updateTemplateButtons([200]);
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.error, Store.ERROR_NO_TEMPLATE_IN_USE);
  assert.strictEqual(storage.writes, afterDelete);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), raw);
  assert.deepStrictEqual(repo.listTemplates(), []);

  const ghost = document([{ name: 'B', buttons: [300] }], 'Fantasma');
  const seeded = memoryStorage();
  seeded.setItem(Store.STORAGE_KEY, ghost);
  const seededWrites = seeded.writes;
  const reloaded = Store.createRepository(seeded);
  assert.strictEqual(reloaded.getLastUsedName(), null);
  assert.strictEqual(reloaded.getWarning(), Store.WARNING_PARTIAL);
  const rejected = reloaded.updateTemplateButtons([100]);
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.error, Store.ERROR_NO_TEMPLATE_IN_USE);
  assert.strictEqual(seeded.writes, seededWrites);
  assert.strictEqual(seeded.getItem(Store.STORAGE_KEY), ghost);
  assert.deepStrictEqual(reloaded.listTemplates()[0].buttons, [300]);
});

test('si los botones no cambian, setItem no se llama', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.saveTemplate('A', [100, 50, 25]).ok, true);
  assert.strictEqual(repo.saveTemplate('B', [300]).ok, true);
  assert.strictEqual(repo.useTemplate('A').ok, true);
  const before = storage.getItem(Store.STORAGE_KEY);
  let setCalls = 0;
  const originalSet = storage.setItem;
  storage.setItem = function (key, value) {
    setCalls += 1;
    return originalSet(key, value);
  };
  const same = repo.updateTemplateButtons([100, 50, 25]);
  assert.strictEqual(same.ok, true);
  assert.strictEqual(same.unchanged, true);
  assert.strictEqual(same.name, 'A');
  assert.strictEqual(setCalls, 0);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), before);
  const copy = repo.updateTemplateButtons([100, 50, 25].slice());
  assert.strictEqual(copy.unchanged, true);
  assert.strictEqual(setCalls, 0);
  /* Mismo conjunto, otro orden: sí es un cambio y sí se escribe. */
  const reordered = repo.updateTemplateButtons([25, 100, 50]);
  assert.strictEqual(reordered.ok, true);
  assert.strictEqual(reordered.unchanged, false);
  assert.strictEqual(reordered.name, 'A');
  assert.strictEqual(setCalls, 1);
  assert.deepStrictEqual(readSaved(storage).templates[0].buttons, [25, 100, 50]);
  assert.strictEqual(readSaved(storage).templates[0].name, 'A');
  assert.deepStrictEqual(readSaved(storage).templates[1].buttons, [300]);
  assert.strictEqual(readSaved(storage).lastUsed, 'A');
  assert.strictEqual(Store.sameButtonList([100, 50], [100, 50]), true);
  assert.strictEqual(Store.sameButtonList([100, 50], [50, 100]), false);
});

test('si setItem lanza, la memoria y el almacén siguen igual', function () {
  const raw = document([
    { name: 'A', buttons: [100, 50] },
    { name: 'B', buttons: [300] }
  ], 'A');
  const quota = storageSetThrows();
  quota.getItem = function (key) {
    if (key === Store.STORAGE_KEY) {
      return raw;
    }
    return null;
  };
  const repo = Store.createRepository(quota);
  assert.deepStrictEqual(repo.getStartupButtons(), [100, 50]);
  const writesBefore = quota.writes;
  const blocked = repo.updateTemplateButtons([200, 400]);
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.error, Store.ERROR_STORAGE_WRITE);
  assert.strictEqual(blocked.warning, Store.ERROR_STORAGE_WRITE);
  assert.ok(quota.writes > writesBefore);
  assert.strictEqual(quota.getItem(Store.STORAGE_KEY), raw);
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [100, 50]);
  assert.strictEqual(repo.listTemplates()[0].name, 'A');
  assert.strictEqual(repo.listTemplates()[0].isLastUsed, true);
  assert.deepStrictEqual(repo.listTemplates()[1].buttons, [300]);
  assert.strictEqual(repo.getLastUsedName(), 'A');
  assert.deepStrictEqual(repo.getStartupButtons(), [100, 50]);
});

test('botones inválidos no actualizan la plantilla', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.saveTemplate('A', [100, 50]).ok, true);
  const before = storage.getItem(Store.STORAGE_KEY);
  const writes = storage.writes;
  const thirteen = [];
  let cents;
  for (cents = 1; cents <= 13; cents += 1) {
    thirteen.push(cents);
  }
  const rejected = [
    [],
    [0],
    [10001],
    [100, 100],
    [100, 50, 100],
    ['1'],
    null,
    thirteen,
    [1.5]
  ];
  rejected.forEach(function (buttons) {
    const result = repo.updateTemplateButtons(buttons);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, Store.ERROR_BUTTONS_INVALID);
  });
  assert.strictEqual(storage.writes, writes);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), before);
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [100, 50]);
  assert.strictEqual(repo.getLastUsedName(), 'A');
});

test('cancelar es una decisión pura y no escribe', function () {
  const cancel = Store.planTemplateUpdate({
    lastUsed: 'A',
    savedButtons: [100, 50],
    currentButtons: [200],
    confirmed: false
  });
  assert.strictEqual(cancel.action, 'cancel');
  assert.strictEqual(cancel.name, 'A');
  assert.deepStrictEqual(cancel.buttons, [200]);

  const needsConfirm = Store.planTemplateUpdate({
    lastUsed: 'A',
    savedButtons: [100, 50],
    currentButtons: [50, 100],
    confirmed: false
  });
  assert.strictEqual(needsConfirm.action, 'cancel');

  const same = Store.planTemplateUpdate({
    lastUsed: 'A',
    savedButtons: [100, 50],
    currentButtons: [100, 50],
    confirmed: false
  });
  assert.strictEqual(same.action, 'unchanged');
  assert.strictEqual(same.name, 'A');

  const proceed = Store.planTemplateUpdate({
    lastUsed: 'A',
    savedButtons: [100, 50],
    currentButtons: [200],
    confirmed: true
  });
  assert.strictEqual(proceed.action, 'update');
  assert.deepStrictEqual(proceed.buttons, [200]);

  const noTemplate = Store.planTemplateUpdate({
    lastUsed: null,
    savedButtons: null,
    currentButtons: [200],
    confirmed: true
  });
  assert.strictEqual(noTemplate.action, 'reject');
  assert.strictEqual(noTemplate.error, Store.ERROR_NO_TEMPLATE_IN_USE);

  const invalid = Store.planTemplateUpdate({
    lastUsed: 'A',
    savedButtons: [100],
    currentButtons: [0],
    confirmed: true
  });
  assert.strictEqual(invalid.action, 'reject');
  assert.strictEqual(invalid.error, Store.ERROR_BUTTONS_INVALID);

  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  assert.strictEqual(repo.saveTemplate('A', [100, 50]).ok, true);
  assert.strictEqual(repo.saveTemplate('B', [300]).ok, true);
  assert.strictEqual(repo.useTemplate('A').ok, true);
  const before = storage.getItem(Store.STORAGE_KEY);
  let setCalls = 0;
  const originalSet = storage.setItem;
  storage.setItem = function (key, value) {
    setCalls += 1;
    return originalSet(key, value);
  };
  const skipped = applyIfConfirmed(repo, [200, 400], false);
  assert.strictEqual(skipped.action, 'cancel');
  assert.strictEqual(setCalls, 0);
  assert.strictEqual(storage.getItem(Store.STORAGE_KEY), before);
  assert.deepStrictEqual(repo.listTemplates()[0].buttons, [100, 50]);
  assert.strictEqual(repo.listTemplates()[0].name, 'A');

  const done = applyIfConfirmed(repo, [200, 400], true);
  assert.strictEqual(done.ok, true);
  assert.strictEqual(done.unchanged, false);
  assert.strictEqual(setCalls, 1);
  assert.deepStrictEqual(readSaved(storage).templates[0].buttons, [200, 400]);
  assert.strictEqual(readSaved(storage).templates[0].name, 'A');
  assert.deepStrictEqual(readSaved(storage).templates[1], { name: 'B', buttons: [300] });
  assert.strictEqual(readSaved(storage).lastUsed, 'A');
});

test('actualizar no mete la suma en lo guardado', function () {
  const storage = memoryStorage();
  const repo = Store.createRepository(storage);
  let state = Calc.createState();
  state = Calc.addValue(state, Calc.parseToCents('1').cents);
  state = Calc.addValue(state, Calc.parseToCents('0,5').cents);
  state = Calc.addValue(state, Calc.parseToCents('0,25').cents);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '1,75');
  assert.deepStrictEqual(Calc.getList(state), [100, 50, 25]);

  assert.strictEqual(repo.saveTemplate('A', [100]).ok, true);
  assert.strictEqual(repo.saveTemplate('B', [200]).ok, true);
  assert.strictEqual(repo.useTemplate('A').ok, true);
  const updated = repo.updateTemplateButtons([400, 500]);
  assert.strictEqual(updated.ok, true);
  assert.strictEqual(Calc.getTotal(state), 175);
  assert.deepStrictEqual(Calc.getList(state), [100, 50, 25]);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '1,75');

  const raw = storage.getItem(Store.STORAGE_KEY);
  const data = JSON.parse(raw);
  assert.deepStrictEqual(Object.keys(data).sort(), ['lastUsed', 'templates', 'version']);
  assert.deepStrictEqual(data.templates[0], { name: 'A', buttons: [400, 500] });
  assert.deepStrictEqual(data.templates[1], { name: 'B', buttons: [200] });
  assert.strictEqual(data.lastUsed, 'A');
  assert.strictEqual(raw.includes('"total"'), false);
  assert.strictEqual(raw.includes('"values"'), false);
  assert.strictEqual(raw.includes('"list"'), false);
  assert.strictEqual(raw.includes('"state"'), false);
  assert.strictEqual(storage.getItem('total'), null);
});

test('0,1 + 0,2 siguen siendo 0,30 al validar botones de plantilla', function () {
  const buttons = Store.validateButtonList([10, 20]);
  assert.deepStrictEqual(buttons, [10, 20]);
  let state = Calc.createState();
  state = Calc.addValue(state, buttons[0]);
  state = Calc.addValue(state, buttons[1]);
  assert.strictEqual(Calc.formatCents(Calc.getTotal(state)), '0,30');
  assert.strictEqual(Calc.formatCents(Calc.getTotal(Calc.addValue(
    Calc.addValue(Calc.addValue(Calc.createState(), 100), 50),
    25
  ))), '1,75');
});

console.log('');
console.log('Total: ' + (failed === 0 ? 'todas pasaron' : failed + ' fallo(s)'));
if (failed > 0) {
  process.exitCode = 1;
}
