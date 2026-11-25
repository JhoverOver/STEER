const test = require('node:test');
const assert = require('node:assert');
const { validarTexto } = require('../utils/validarTexto');
const { validarListaFrames } = require('../utils/validarFrames');

const base = {
    contenido: 'Hola', fuente: 'sans', tamano: 48, color: '#FFAA00', negrita: true, cursiva: false,
    alineacion: 'centro', x: 240.04, y: 60, rotacion: 0, grupo: 't1',
};

test('un texto válido se limpia (color en minúsculas, posición con un decimal)', () => {
    const { valor } = validarTexto(base);
    assert.strictEqual(valor.color, '#ffaa00');
    assert.strictEqual(valor.x, 240);
    assert.strictEqual(validarTexto(undefined).valor, undefined);
    assert.strictEqual(validarTexto(null).valor, null);
});

test('rechaza textos vacíos, fuentes desconocidas y tamaños fuera de rango', () => {
    assert.match(validarTexto({ ...base, contenido: '   ' }).error, /caracteres/);
    assert.match(validarTexto({ ...base, fuente: 'papyrus' }).error, /fuentes/);
    assert.match(validarTexto({ ...base, tamano: 2 }).error, /entre/);
    assert.match(validarTexto({ ...base, color: 'rojo' }).error, /color/);
});

test('la lista de frames acepta el texto de una capa y avisa si no sirve', () => {
    const frame = (texto) => [{ duracion: 100, capas: [{ nombre: 'Título', visible: true, bloqueada: false, archivo: 'c0', texto }] }];
    assert.strictEqual(validarListaFrames(frame(base)).lista[0].capas[0].texto.contenido, 'Hola');
    assert.match(validarListaFrames(frame({ ...base, tamano: 9999 })).error, /texto de la capa 1 del frame 1/);
});
