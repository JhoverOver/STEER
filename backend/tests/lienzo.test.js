const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const { reubicarImagen } = require('../services/procesadorFrames');

// PNG de ancho x alto, transparente, con un cuadrado rojo de "lado" px en (x, y)
async function conCuadrado(ancho, alto, x, y, lado) {
    const rojo = await sharp({ create: { width: lado, height: lado, channels: 4, background: '#ff0000' } }).png().toBuffer();
    return sharp({ create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: rojo, left: x, top: y }])
        .png()
        .toBuffer();
}

// Caja de los píxeles rojos y tamaño de la imagen
async function medir(buffer) {
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const i = (y * info.width + x) * 4;
            if (data[i] > 200 && data[i + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        }
    }
    return { ancho: info.width, alto: info.height, caja: x1 < 0 ? null : { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 } };
}

const anterior = { ancho: 100, alto: 100 };

test('agregar espacio arriba: el dibujo baja y la capa mide lo del lienzo nuevo', async () => {
    const capa = await conCuadrado(100, 100, 10, 20, 30);
    const nuevo = { ancho: 100, alto: 160 };
    const r = await medir(await reubicarImagen(capa, anterior, nuevo, 0, 60)); // ancla abajo
    assert.deepStrictEqual(r, { ancho: 100, alto: 160, caja: { x: 10, y: 80, ancho: 30, alto: 30 } });
});

test('achicar sin perder dibujo: lo que queda afuera pasa a la zona de trabajo', async () => {
    const capa = await conCuadrado(100, 100, 70, 70, 20);
    const nuevo = { ancho: 60, alto: 60 };
    const r = await medir(await reubicarImagen(capa, anterior, nuevo, 0, 0)); // ancla arriba a la izquierda
    // Zona de 180 x 180 con el lienzo en (60, 60): el cuadrado queda en (130, 130)
    assert.deepStrictEqual(r, { ancho: 180, alto: 180, caja: { x: 130, y: 130, ancho: 20, alto: 20 } });
});

test('una capa de zona de trabajo se mantiene en zona, corrida', async () => {
    const capa = await conCuadrado(300, 300, 5, 150, 10); // a la izquierda, fuera del lienzo
    const nuevo = { ancho: 200, alto: 100 };
    const r = await medir(await reubicarImagen(capa, anterior, nuevo, 50, 0)); // ancla al centro
    // Lienzo nuevo en (200, 100) de una zona de 600 x 300; el lienzo anterior quedó en (250, 100)
    assert.deepStrictEqual(r, { ancho: 600, alto: 300, caja: { x: 155, y: 150, ancho: 10, alto: 10 } });
});
