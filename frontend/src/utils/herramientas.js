// Herramientas de dibujo sobre el canvas de UNA capa: pincel, borrador, selección y transformaciones.
// Hay dos tipos de funciones:
//   - de geometría (rectángulos, límites, avisos): puras, no tocan ningún canvas;
//   - de dibujo: reciben el contexto 2D ("ctx") del canvas de la capa activa y lo modifican.
// Quien las usa (Lienzo) decide cuándo llamarlas; aquí no se mira el mouse ni la capa activa.
// Un rectángulo es { x, y, ancho, alto } en píxeles enteros del lienzo.
import { capaEditable } from './capas';
import { crearCanvas } from './imagenes';
import { limitar } from './comunes';

export const TAMANO_MINIMO = 1;
export const TAMANO_MAXIMO = 100;
export const ESCALA_MINIMA = 0.1;
export const ESCALA_MAXIMA = 10;

// ---------- Avisos y valores permitidos ----------

// Mensaje para el usuario si en la capa no se puede dibujar (RF39); null si sí se puede
export function mensajeCapaNoEditable(capa) {
    if (!capa) return 'No hay una capa activa.';
    if (capa.texto && capaEditable(capa)) {
        return 'Es una capa de texto: cámbiala en el panel Texto o conviértela en imagen para dibujar en ella.';
    }
    if (capaEditable(capa)) return null;
    if (!capa.visible) return 'La capa activa está oculta: hazla visible para dibujar en ella.';
    return 'La capa activa está bloqueada: desbloquéala para dibujar en ella.';
}

// El tamaño del pincel y del borrador es un entero de 1 a 100 px (RF36)
export function limitarTamano(valor) {
    const numero = Math.round(Number(valor));
    if (!Number.isFinite(numero)) return TAMANO_MINIMO;
    return limitar(numero, TAMANO_MINIMO, TAMANO_MAXIMO);
}

export function limitarEscala(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 1;
    return limitar(numero, ESCALA_MINIMA, ESCALA_MAXIMA);
}

// ---------- Rectángulos ----------

// Deja el rectángulo dentro del lienzo; null si queda sin área
function recortarARectangulo(rect, anchoLienzo, altoLienzo) {
    const x1 = Math.max(rect.x, 0);
    const y1 = Math.max(rect.y, 0);
    const x2 = Math.min(rect.x + rect.ancho, anchoLienzo);
    const y2 = Math.min(rect.y + rect.alto, altoLienzo);
    if (x2 <= x1 || y2 <= y1) return null;
    return { x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 };
}

export function unirRectangulos(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + a.ancho, b.x + b.ancho);
    const y2 = Math.max(a.y + a.alto, b.y + b.alto);
    return { x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 };
}

// Rectángulo que toca un segmento de trazo de ese grosor (un píxel de margen para el suavizado)
export function rectanguloDeTrazo(desde, hasta, tamano, anchoLienzo, altoLienzo) {
    const radio = tamano / 2 + 1;
    const x1 = Math.floor(Math.min(desde.x, hasta.x) - radio);
    const y1 = Math.floor(Math.min(desde.y, hasta.y) - radio);
    const x2 = Math.ceil(Math.max(desde.x, hasta.x) + radio);
    const y2 = Math.ceil(Math.max(desde.y, hasta.y) + radio);
    return recortarARectangulo({ x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 }, anchoLienzo, altoLienzo);
}

// Rectángulo entre dos esquinas arrastradas con el mouse, en cualquier dirección (RF38)
export function rectanguloDeSeleccion(esquinaA, esquinaB, anchoLienzo, altoLienzo) {
    const x1 = Math.round(Math.min(esquinaA.x, esquinaB.x));
    const y1 = Math.round(Math.min(esquinaA.y, esquinaB.y));
    const x2 = Math.round(Math.max(esquinaA.x, esquinaB.x));
    const y2 = Math.round(Math.max(esquinaA.y, esquinaB.y));
    return recortarARectangulo({ x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 }, anchoLienzo, altoLienzo);
}

// Las cuatro esquinas de "region" después de la transformación, en orden: arriba-izq., arriba-der., abajo-der., abajo-izq.
// La transformación es respecto del centro de la región: el centro se mueve dx, dy; luego se escala y se gira (grados).
// "escala" escala igual los dos ejes; escalaX y escalaY (si vienen) escalan cada eje por separado.
export function esquinasTransformadas(region, transformacion) {
    const { dx = 0, dy = 0, escala = 1, angulo = 0 } = transformacion;
    const escalaX = transformacion.escalaX ?? escala;
    const escalaY = transformacion.escalaY ?? escala;
    const centroX = region.x + region.ancho / 2;
    const centroY = region.y + region.alto / 2;
    const radianes = (angulo * Math.PI) / 180;
    const coseno = Math.cos(radianes);
    const seno = Math.sin(radianes);
    return [
        [-region.ancho / 2, -region.alto / 2], [region.ancho / 2, -region.alto / 2],
        [region.ancho / 2, region.alto / 2], [-region.ancho / 2, region.alto / 2],
    ].map(([x, y]) => ({
        x: centroX + dx + (x * escalaX) * coseno - (y * escalaY) * seno,
        y: centroY + dy + (x * escalaX) * seno + (y * escalaY) * coseno,
    }));
}

// Rectángulo (en píxeles enteros) que envuelve a la región transformada
export function rectanguloTransformado(region, transformacion) {
    const esquinas = esquinasTransformadas(region, transformacion);
    const xs = esquinas.map((e) => e.x);
    const ys = esquinas.map((e) => e.y);
    const x1 = Math.floor(Math.min(...xs));
    const y1 = Math.floor(Math.min(...ys));
    return { x: x1, y: y1, ancho: Math.ceil(Math.max(...xs)) - x1, alto: Math.ceil(Math.max(...ys)) - y1 };
}

// Dibuja "flotante" (los píxeles levantados de "region") con la transformación aplicada
export function dibujarTransformado(ctx, flotante, region, transformacion) {
    const { dx = 0, dy = 0, escala = 1, angulo = 0 } = transformacion;
    ctx.save();
    ctx.translate(region.x + region.ancho / 2 + dx, region.y + region.alto / 2 + dy);
    ctx.rotate((angulo * Math.PI) / 180);
    ctx.scale(transformacion.escalaX ?? escala, transformacion.escalaY ?? escala);
    ctx.drawImage(flotante, -region.ancho / 2, -region.alto / 2);
    ctx.restore();
}

// ---------- Dibujo sobre el canvas de la capa ----------

function trazar(ctx, desde, hasta, tamano) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = tamano;
    if (desde.x === hasta.x && desde.y === hasta.y) {
        // Un clic sin mover: se dibuja un punto del tamaño del pincel
        ctx.beginPath();
        ctx.arc(desde.x, desde.y, tamano / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }
    ctx.beginPath();
    ctx.moveTo(desde.x, desde.y);
    ctx.lineTo(hasta.x, hasta.y);
    ctx.stroke();
}

// Pincel (RF36): un tramo del trazo, entre dos posiciones consecutivas del mouse
export function dibujarTrazo(ctx, desde, hasta, color, tamano) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    trazar(ctx, desde, hasta, tamano);
    ctx.restore();
}

// Borrador (RF37): deja transparente lo que toca, solo en este canvas
export function borrarTrazo(ctx, desde, hasta, tamano) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    trazar(ctx, desde, hasta, tamano);
    ctx.restore();
}

// Borra un rectángulo (RF38)
export function borrarRegion(ctx, region) {
    ctx.clearRect(region.x, region.y, region.ancho, region.alto);
}

// Separa un grupo de objetos (utils/objetos.js) del resto de la capa. Devuelve dos canvas nuevos:
//   - "flotante": del tamaño de la caja del grupo, solo con los píxeles del grupo;
//   - "base": una copia de la capa entera, pero sin los píxeles del grupo.
// El canvas original no se toca.
export function levantarGrupo(canvas, grupo) {
    const { rect, mascara } = grupo;
    const base = copiarCanvas(canvas);
    const ctxBase = base.getContext('2d');
    const pixeles = ctxBase.getImageData(rect.x, rect.y, rect.ancho, rect.alto);
    const flotante = crearCanvas(rect.ancho, rect.alto);
    const propios = new ImageData(rect.ancho, rect.alto);
    for (let i = 0; i < mascara.length; i++) {
        if (!mascara[i]) continue;
        const k = i * 4;
        propios.data.set(pixeles.data.subarray(k, k + 4), k);
        pixeles.data[k + 3] = 0;
    }
    flotante.getContext('2d').putImageData(propios, 0, 0);
    ctxBase.putImageData(pixeles, rect.x, rect.y);
    return { base, flotante };
}

// Vuelve a poner en "ctx", dentro de "rect", lo que había en "base" (la capa sin los objetos levantados).
// Se usa al soltar, transformar o borrar objetos: primero se limpia el rectángulo y luego se pinta la base.
export function restaurarBase(ctx, base, rect) {
    ctx.clearRect(rect.x, rect.y, rect.ancho, rect.alto);
    ctx.drawImage(base, rect.x, rect.y, rect.ancho, rect.alto, rect.x, rect.y, rect.ancho, rect.alto);
}

// ---------- Copias y lectura de píxeles ----------

// Copia un canvas (o solo un rectángulo de él) en un canvas nuevo
export function copiarCanvas(canvas, rect = { x: 0, y: 0, ancho: canvas.width, alto: canvas.height }) {
    const copia = crearCanvas(rect.ancho, rect.alto);
    copia.getContext('2d').drawImage(canvas, rect.x, rect.y, rect.ancho, rect.alto, 0, 0, rect.ancho, rect.alto);
    return copia;
}

// Lectura y escritura de un rectángulo: son las funciones que usa historialEditor
export function leerRegion(ctx, rect) {
    return ctx.getImageData(rect.x, rect.y, rect.ancho, rect.alto);
}

export function escribirRegion(ctx, x, y, pixeles) {
    ctx.putImageData(pixeles, x, y);
}


// Todos los píxeles RGBA de un canvas (ImageData.data)
export function pixelesDe(canvas) {
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
}

// Canvas nuevo con solo lo que cae dentro del lienzo del proyecto (ancho x alto, que empieza en "centro")
export function recortarAlLienzo(canvas, centro) {
    const recorte = crearCanvas(centro.ancho, centro.alto);
    recorte.getContext('2d').drawImage(canvas, -centro.x, -centro.y);
    return recorte;
}
