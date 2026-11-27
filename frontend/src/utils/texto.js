// Texto editable: la forma de tipo 'texto' (utils/formas.js). Aquí van las cuentas propias del texto: medir sus
// líneas, dibujarlo y cambiar su tamaño. Los mismos valores que revisa el servidor (be/utils/validarForma.js).
//
// Texto: { tipo: 'texto', contenido, fuente, tamano (px), color (#rrggbb), negrita, cursiva, alineacion, x, y,
//          rotacion (grados), grupo? }. (x, y) es el centro del bloque, en píxeles del lienzo.
import { limitar } from './comunes';

export const FUENTES = [
    { id: 'sans', nombre: 'Sans', familia: "Inter, 'Helvetica Neue', Arial, sans-serif" },
    { id: 'serif', nombre: 'Serif', familia: "Georgia, 'Times New Roman', serif" },
    { id: 'mono', nombre: 'Mono', familia: "'Courier New', Courier, monospace" },
    { id: 'impacto', nombre: 'Impacto', familia: "Impact, 'Arial Black', sans-serif" },
    { id: 'manuscrita', nombre: 'Manuscrita', familia: "'Comic Sans MS', 'Segoe Print', cursive" },
];
export const LARGO_MAXIMO_TEXTO = 500;
export const TAMANO_TEXTO_MINIMO = 4;
export const TAMANO_TEXTO_MAXIMO = 600;
const ALTO_LINEA = 1.2; // veces el tamaño de la letra

export function textoInicial(x, y, color = '#ffffff') {
    return {
        tipo: 'texto',
        contenido: 'Texto', fuente: 'sans', tamano: 48, color, negrita: true, cursiva: false,
        alineacion: 'centro', x: Math.round(x), y: Math.round(y), rotacion: 0,
    };
}

export function limitarTamanoTexto(valor) {
    const numero = Math.round(Number(valor));
    if (!Number.isFinite(numero)) return TAMANO_TEXTO_MINIMO;
    return limitar(numero, TAMANO_TEXTO_MINIMO, TAMANO_TEXTO_MAXIMO);
}

// '' si el texto se puede guardar; si no, el motivo
export function problemaTexto(texto) {
    if (!texto.contenido.trim()) return 'Escribe algo.';
    if (texto.contenido.length > LARGO_MAXIMO_TEXTO) return `Máximo ${LARGO_MAXIMO_TEXTO} caracteres.`;
    return '';
}

function fuenteCss(texto) {
    const familia = (FUENTES.find((f) => f.id === texto.fuente) || FUENTES[0]).familia;
    return `${texto.cursiva ? 'italic ' : ''}${texto.negrita ? '700' : '400'} ${texto.tamano}px ${familia}`;
}

// Medidas del bloque: { ancho, alto, lineas: [{ texto, ancho }] }. "medir(linea)" da el ancho de una línea en px
// (por defecto, el de un canvas con la fuente del texto)
export function medirBloque(texto, medir = medidorDe(texto)) {
    const lineas = texto.contenido.split('\n').map((linea) => ({ texto: linea, ancho: medir(linea) }));
    return {
        ancho: Math.max(1, ...lineas.map((l) => l.ancho)),
        alto: Math.max(1, lineas.length * texto.tamano * ALTO_LINEA),
        lineas,
    };
}

// Medidor con un canvas: usa la fuente del texto
let contextoMedidas = null;
function medidorDe(texto) {
    if (!contextoMedidas) contextoMedidas = document.createElement('canvas').getContext('2d');
    contextoMedidas.font = fuenteCss(texto);
    return (linea) => contextoMedidas.measureText(linea).width;
}

// Las 4 esquinas del bloque, ya girado, en píxeles del lienzo (arriba-izq., arriba-der., abajo-der., abajo-izq.)
export function esquinasTexto(texto, bloque) {
    const radianes = (texto.rotacion * Math.PI) / 180;
    const coseno = Math.cos(radianes);
    const seno = Math.sin(radianes);
    const medio = { x: bloque.ancho / 2, y: bloque.alto / 2 };
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const x = sx * medio.x;
        const y = sy * medio.y;
        return { x: texto.x + x * coseno - y * seno, y: texto.y + x * seno + y * coseno };
    });
}

// Medidas del bloque con la fuente real del texto
export const medirTexto = (texto) => medirBloque(texto);

// Rectángulo (en píxeles enteros del lienzo) que envuelve al texto
export function cajaTexto(texto, bloque) {
    const esquinas = esquinasTexto(texto, bloque);
    const xs = esquinas.map((e) => e.x);
    const ys = esquinas.map((e) => e.y);
    const x = Math.floor(Math.min(...xs));
    const y = Math.floor(Math.min(...ys));
    return { x, y, ancho: Math.ceil(Math.max(...xs)) - x, alto: Math.ceil(Math.max(...ys)) - y };
}

// Dibuja el texto en un contexto cuyo origen es el del lienzo
export function dibujarTexto(ctx, texto, bloque = medirBloque(texto)) {
    ctx.save();
    ctx.translate(texto.x, texto.y);
    ctx.rotate((texto.rotacion * Math.PI) / 180);
    ctx.font = fuenteCss(texto);
    ctx.fillStyle = texto.color;
    ctx.textBaseline = 'middle';
    const altoLinea = texto.tamano * ALTO_LINEA;
    bloque.lineas.forEach((linea, i) => {
        let x = -linea.ancho / 2;
        if (texto.alineacion === 'izquierda') x = -bloque.ancho / 2;
        if (texto.alineacion === 'derecha') x = bloque.ancho / 2 - linea.ancho;
        const y = -bloque.alto / 2 + altoLinea * (i + 0.5);
        ctx.fillText(linea.texto, x, y);
    });
    ctx.restore();
}

// Aplica al texto una transformación de las manijas ({ dx, dy, escalaX, escalaY, angulo }, alrededor del centro de
// "region", en las mismas coordenadas que el texto): se mueve, cambia de tamaño y gira sin dejar de ser texto
export function transformarTexto(texto, region, t) {
    const escala = ((t.escalaX ?? 1) + (t.escalaY ?? 1)) / 2;
    const centro = { x: region.x + region.ancho / 2, y: region.y + region.alto / 2 };
    const radianes = ((t.angulo || 0) * Math.PI) / 180;
    const rx = (texto.x - centro.x) * (t.escalaX ?? 1);
    const ry = (texto.y - centro.y) * (t.escalaY ?? 1);
    let rotacion = texto.rotacion + (t.angulo || 0);
    if (rotacion > 360) rotacion -= 360;
    if (rotacion < -360) rotacion += 360;
    return {
        ...texto,
        x: Math.round((centro.x + (t.dx || 0) + rx * Math.cos(radianes) - ry * Math.sin(radianes)) * 10) / 10,
        y: Math.round((centro.y + (t.dy || 0) + rx * Math.sin(radianes) + ry * Math.cos(radianes)) * 10) / 10,
        tamano: limitarTamanoTexto(texto.tamano * escala),
        rotacion,
    };
}
