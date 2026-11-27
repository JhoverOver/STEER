const test = require('node:test');
const assert = require('node:assert');
const { validarForma, moverForma, leerJSON } = require('../utils/validarForma');
const { validarListaFrames } = require('../utils/validarFrames');

const texto = {
    tipo: 'texto', contenido: 'Hola', fuente: 'sans', tamano: 48, color: '#FFAA00', negrita: true, cursiva: false,
    alineacion: 'centro', x: 240.04, y: 60, rotacion: 0, grupo: 't1',
};
const rectangulo = { tipo: 'rectangulo', x: 50, y: 40, ancho: 100, alto: 80, rotacion: 15.25, color: '#00FF00' };

test('un texto válido se limpia (color en minúsculas, posición con un decimal)', () => {
    const { valor } = validarForma(texto);
    assert.strictEqual(valor.tipo, 'texto');
    assert.strictEqual(valor.color, '#ffaa00');
    assert.strictEqual(valor.x, 240);
    assert.strictEqual(valor.grupo, 't1');
    assert.strictEqual(validarForma(undefined).valor, undefined);
    assert.strictEqual(validarForma(null).valor, null);
});

test('un rectángulo válido conserva su tamaño y redondea el giro', () => {
    const { valor } = validarForma(rectangulo);
    assert.deepStrictEqual(valor, { tipo: 'rectangulo', ancho: 100, alto: 80, x: 50, y: 40, rotacion: 15.3, color: '#00ff00' });
});

test('rechaza tipos desconocidos, textos vacíos, fuentes desconocidas y medidas fuera de rango', () => {
    assert.match(validarForma({ ...texto, tipo: 'circulo' }).error, /no es válida/);
    assert.match(validarForma({ ...texto, contenido: '   ' }).error, /caracteres/);
    assert.match(validarForma({ ...texto, fuente: 'papyrus' }).error, /fuentes/);
    assert.match(validarForma({ ...texto, tamano: 2 }).error, /entre/);
    assert.match(validarForma({ ...texto, color: 'rojo' }).error, /color/);
    assert.match(validarForma({ ...rectangulo, ancho: 0 }).error, /por lado/);
    assert.match(validarForma({ ...rectangulo, alto: 10.5 }).error, /por lado/);
});

test('la lista de frames acepta la forma de una capa y avisa si no sirve', () => {
    const frame = (forma) => [{ duracion: 100, capas: [{ nombre: 'Título', visible: true, bloqueada: false, archivo: 'c0', forma }] }];
    assert.strictEqual(validarListaFrames(frame(texto)).lista[0].capas[0].forma.contenido, 'Hola');
    assert.match(validarListaFrames(frame({ ...texto, tamano: 9999 })).error, /texto de la capa 1 del frame 1/);
    assert.match(validarListaFrames(frame({ ...rectangulo, ancho: -3 })).error, /rectángulo de la capa 1 del frame 1/);
});

test('mover y leer formas', () => {
    assert.deepStrictEqual(moverForma(rectangulo, 10, -5), { ...rectangulo, x: 60, y: 35 });
    assert.deepStrictEqual(leerJSON('{"tipo":"rectangulo"}'), { tipo: 'rectangulo' });
    assert.strictEqual(leerJSON('no es json'), null);
    assert.strictEqual(leerJSON(null), null);
});
