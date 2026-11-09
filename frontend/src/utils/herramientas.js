// Herramientas de dibujo sobre el canvas de UNA capa: pincel, borrador, selección y transformaciones.
// Hay dos tipos de funciones:
//   - de geometría (rectángulos, límites, avisos): puras, no tocan ningún canvas;
//   - de dibujo: reciben el contexto 2D ("ctx") del canvas de la capa activa y lo modifican.
// Quien las usa (Lienzo) decide cuándo llamarlas; aquí no se mira el mouse ni la capa activa.
// Un rectángulo es { x, y, ancho, alto } en píxeles enteros del lienzo.
import { capaEditable } from './capas';

export const TAMANO_MINIMO = 1;
export const TAMANO_MAXIMO = 100;
export const ESCALA_MINIMA = 0.1;
export const ESCALA_MAXIMA = 10;

// ---------- Avisos y valores permitidos ----------

// Mensaje para el usuario si en la capa no se puede dibujar (RF39); null si sí se puede
export function mensajeCapaNoEditable(capa) {
    if (!capa) return 'No hay una capa activa.';
    if (capaEditable(capa)) return null;
    if (!capa.visible) return 'La capa activa está oculta: hazla visible para dibujar en ella.';
    return 'La capa activa está bloqueada: desbloquéala para dibujar en ella.';
}

// El tamaño del pincel y del borrador es un entero de 1 a 100 px (RF36)
export function limitarTamano(valor) {
    const numero = Math.round(Number(valor));
    if (!Number.isFinite(numero)) return TAMANO_MINIMO;
    return Math.min(Math.max(numero, TAMANO_MINIMO), TAMANO_MAXIMO);
}

export function limitarEscala(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 1;
    return Math.min(Math.max(numero, ESCALA_MINIMA), ESCALA_MAXIMA);
}

export function colorValido(color) {
    return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

// ---------- Rectángulos ----------

// Deja el rectángulo dentro del lienzo; null si queda sin área
export function recortarARectangulo(rect, anchoLienzo, altoLienzo) {
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

// Transformación: { dx, dy, escala, angulo } (mover, escalar desde el centro y girar en grados).
// Rectángulo que ocupará el contenido de "region" después de transformarlo (sin recortar al lienzo)
export function rectanguloTransformado(region, transformacion) {
    const { dx = 0, dy = 0, escala = 1, angulo = 0 } = transformacion;
    const centroX = region.x + region.ancho / 2;
    const centroY = region.y + region.alto / 2;
    const radianes = (angulo * Math.PI) / 180;
    const coseno = Math.cos(radianes);
    const seno = Math.sin(radianes);
    const esquinas = [
        [-region.ancho / 2, -region.alto / 2], [region.ancho / 2, -region.alto / 2],
        [region.ancho / 2, region.alto / 2], [-region.ancho / 2, region.alto / 2],
    ].map(([x, y]) => ({
        x: centroX + dx + escala * (x * coseno - y * seno),
        y: centroY + dy + escala * (x * seno + y * coseno),
    }));
    const xs = esquinas.map((e) => e.x);
    const ys = esquinas.map((e) => e.y);
    const x1 = Math.floor(Math.min(...xs));
    const y1 = Math.floor(Math.min(...ys));
    return { x: x1, y: y1, ancho: Math.ceil(Math.max(...xs)) - x1, alto: Math.ceil(Math.max(...ys)) - y1 };
}

// Todo lo que cambia en el lienzo al transformar "region": el lugar de origen y el de destino.
// Se calcula ANTES de transformar, para guardar esos píxeles en el historial.
export function rectanguloAfectado(region, transformacion, anchoLienzo, altoLienzo) {
    const origen = recortarARectangulo(region, anchoLienzo, altoLienzo);
    const destino = recortarARectangulo(rectanguloTransformado(region, transformacion), anchoLienzo, altoLienzo);
    return unirRectangulos(origen, destino);
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

// Mueve, escala y gira el contenido de "region" (RF41 a RF43): lo levanta, deja ese lugar vacío
// y lo vuelve a poner transformado. Lo que sale del lienzo se pierde al terminar.
export function transformarRegion(ctx, region, transformacion) {
    const { dx = 0, dy = 0, escala = 1, angulo = 0 } = transformacion;
    const copia = copiarCanvas(ctx.canvas, region);
    ctx.clearRect(region.x, region.y, region.ancho, region.alto);
    ctx.save();
    ctx.translate(region.x + region.ancho / 2 + dx, region.y + region.alto / 2 + dy);
    ctx.rotate((angulo * Math.PI) / 180);
    ctx.scale(escala, escala);
    ctx.drawImage(copia, -region.ancho / 2, -region.alto / 2);
    ctx.restore();
}

// ---------- Copias y lectura de píxeles ----------

// Copia un canvas (o solo un rectángulo de él) en un canvas nuevo
export function copiarCanvas(canvas, rect = { x: 0, y: 0, ancho: canvas.width, alto: canvas.height }) {
    const copia = document.createElement('canvas');
    copia.width = rect.ancho;
    copia.height = rect.alto;
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