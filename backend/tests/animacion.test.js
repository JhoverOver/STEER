const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const { validarAnimacion, moverAnimacion } = require('../utils/validarAnimacion');
const { validarListaFrames } = require('../utils/validarFrames');
const { componerCapas } = require('../services/procesadorFrames');

const animacion = {
    id: 'a1',
    punto: { x: 20, y: 50 },
    keyframes: [{ tiempo: 300, x: 70, y: 50, escala: 2, giro: 90 }, { tiempo: 0, x: 20, y: 50, escala: 1, giro: 0 }],
    actual: { x: 45, y: 50, escala: 1.5, giro: 45 },
};

test('unos keyframes válidos quedan ordenados por tiempo', () => {
    const { valor } = validarAnimacion(animacion);
    assert.deepStrictEqual(valor.keyframes.map((k) => k.tiempo), [0, 300]);
    assert.deepStrictEqual(valor.actual, animacion.actual);
    assert.strictEqual(validarAnimacion(undefined).valor, undefined);
    assert.strictEqual(validarAnimacion(null).valor, null);
});

test('rechaza keyframes vacíos, repetidos, sin punto o con escalas imposibles', () => {
    assert.match(validarAnimacion({ ...animacion, keyframes: [] }).error, /keyframes/);
    const k = animacion.keyframes[1];
    assert.match(validarAnimacion({ ...animacion, keyframes: [k, { ...k, x: 5 }] }).error, /mismo momento/);
    assert.match(validarAnimacion({ ...animacion, keyframes: [{ ...k, escala: 0 }] }).error, /keyframe/);
    assert.match(validarAnimacion({ ...animacion, punto: null }).error, /punto/);
    assert.match(validarAnimacion({ ...animacion, actual: { x: 1 } }).error, /actual/);
});

test('la lista de frames acepta los keyframes de una capa', () => {
    const frame = (capa) => [{ duracion: 100, capas: [{ nombre: 'Cuadro', visible: true, bloqueada: false, archivo: 'c0', ...capa }] }];
    assert.strictEqual(validarListaFrames(frame({ animacion })).lista[0].capas[0].animacion.id, 'a1');
    assert.match(validarListaFrames(frame({ animacion: { ...animacion, id: '' } })).error, /animación de la capa 1 del frame 1/);
});

test('al cambiar el tamaño del lienzo, el punto y sus keyframes se corren igual que el dibujo', () => {
    const movida = moverAnimacion(animacion, 3, -2);
    assert.deepStrictEqual(movida.punto, { x: 23, y: 48 });
    assert.deepStrictEqual(movida.keyframes[0], { tiempo: 300, x: 73, y: 48, escala: 2, giro: 90 });
    assert.deepStrictEqual(movida.actual, { x: 48, y: 48, escala: 1.5, giro: 45 });
});

test('la imagen del frame muestra la capa transformada según su punto', async () => {
    const L = 100;
    const cuadro = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#ff0000' } }).png().toBuffer();
    const capa = await sharp({ create: { width: L, height: L, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: cuadro, left: 10, top: 40 }]).png().toBuffer();
    // El punto (centro del cuadro) pasa de (20, 50) a (70, 50) con escala 2: un cuadro de 40 centrado en (70, 50)
    const salida = await componerCapas([{ visible: true, imagen_data: capa, animacion: { ...animacion, actual: { x: 70, y: 50, escala: 2, giro: 0 } } }], L, L);
    const { data, info } = await sharp(salida).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let x1 = 1e9; let x2 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 128) { x1 = Math.min(x1, x); x2 = Math.max(x2, x); }
    }
    assert.ok(Math.abs(x1 - 50) <= 1 && Math.abs(x2 - 89) <= 2, `${x1}..${x2}`);
});
