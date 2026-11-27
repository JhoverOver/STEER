const test = require('node:test');
const assert = require('node:assert');
const { validarAnimacion, moverAnimacion } = require('../utils/validarAnimacion');
const { validarListaFrames } = require('../utils/validarFrames');

const animacion = {
    id: 'a1',
    caja: { x: 10, y: 20, ancho: 40, alto: 30 },
    keyframes: [
        { tiempo: 500, dx: 100.04, dy: 0, escalaX: 2, escalaY: 2, angulo: 90 },
        { tiempo: 0, dx: 0, dy: 0, escalaX: 1, escalaY: 1, angulo: 0 },
    ],
};

test('una animación válida se limpia y ordena sus keyframes', () => {
    const { valor } = validarAnimacion(animacion);
    assert.deepStrictEqual(valor.keyframes.map((k) => k.tiempo), [0, 500]);
    assert.strictEqual(valor.keyframes[1].dx, 100);
    assert.strictEqual(validarAnimacion(undefined).valor, undefined);
    assert.strictEqual(validarAnimacion(null).valor, null);
});

test('rechaza animaciones sin keyframes, con tiempos repetidos o escalas imposibles', () => {
    assert.match(validarAnimacion({ ...animacion, keyframes: [] }).error, /keyframes/);
    const repetidos = [animacion.keyframes[1], { ...animacion.keyframes[1], dx: 5 }];
    assert.match(validarAnimacion({ ...animacion, keyframes: repetidos }).error, /mismo momento/);
    assert.match(validarAnimacion({ ...animacion, keyframes: [{ ...animacion.keyframes[0], escalaX: 0 }] }).error, /keyframe/);
    assert.match(validarAnimacion({ ...animacion, caja: null }).error, /caja/);
});

test('la lista de frames acepta la animación de una capa y su dibujo sin animar', () => {
    const frame = (capa) => [{ duracion: 100, capas: [{ nombre: 'Cuadro', visible: true, bloqueada: false, archivo: 'c0', ...capa }] }];
    const { lista } = validarListaFrames(frame({ animacion, original: 'o0' }));
    assert.strictEqual(lista[0].capas[0].original, 'o0');
    assert.strictEqual(lista[0].capas[0].animacion.id, 'a1');
    assert.strictEqual(validarListaFrames(frame({ animacion, originalDe: 7 })).lista[0].capas[0].originalDe, 7);
    assert.match(validarListaFrames(frame({ animacion, original: 'o0', originalDe: 7 })).error, /no los dos/);
    assert.match(validarListaFrames(frame({ animacion: { ...animacion, id: '' } })).error, /animación de la capa 1 del frame 1/);
});

test('mover una animación corre su caja y su forma', () => {
    const forma = { tipo: 'rectangulo', x: 5, y: 5, ancho: 10, alto: 10, rotacion: 0, color: '#ffffff' };
    const movida = moverAnimacion({ ...animacion, forma }, 3, -2);
    assert.deepStrictEqual(movida.caja, { x: 13, y: 18, ancho: 40, alto: 30 });
    assert.strictEqual(movida.forma.x, 8);
    assert.strictEqual(movida.keyframes, animacion.keyframes);
});
