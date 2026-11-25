// Capas de texto editable. Una capa de texto guarda su dibujo como cualquier capa (un PNG) y, además, cómo es su
// texto: así se puede cambiar después (contenido, fuente, tamaño, color, posición...) y se vuelve a dibujar.
// Los mismos valores que revisa el servidor (be/utils/validarTexto.js).
//
// Texto: { contenido, fuente, tamano (px), color (#rrggbb), negrita, cursiva, alineacion, x, y, rotacion (grados),
//          grupo? }. (x, y) es el centro del bloque de texto, en píxeles del lienzo (puede quedar fuera de él).
// "grupo" une las copias de un mismo texto en varios frames: al editarlo en Video se cambian todas juntas.
import { FACTOR_AREA_TRABAJO } from '../config/limites';
import { crearCanvas } from './imagenes';
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

let contadorGrupos = 0;
export function grupoNuevo() {
    contadorGrupos += 1;
    return `t${Date.now().toString(36)}${contadorGrupos}`;
}

export function textoInicial(x, y, color = '#ffffff') {
    return {
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
export function medirBloque(texto, medir) {
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
export function dibujarTexto(ctx, texto, bloque = medirBloque(texto, medidorDe(texto))) {
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

// El dibujo de la capa: un canvas del tamaño del lienzo o, si el texto se sale, de la zona de trabajo (como las
// demás capas, para no perder lo que queda afuera)
export function canvasDeTexto(texto, ancho, alto) {
    const bloque = medirBloque(texto, medidorDe(texto));
    const caja = cajaTexto(texto, bloque);
    const cabe = caja.x >= 0 && caja.y >= 0 && caja.x + caja.ancho <= ancho && caja.y + caja.alto <= alto;
    const canvas = crearCanvas(cabe ? ancho : ancho * FACTOR_AREA_TRABAJO, cabe ? alto : alto * FACTOR_AREA_TRABAJO);
    const ctx = canvas.getContext('2d');
    if (!cabe) ctx.translate(ancho, alto);
    dibujarTexto(ctx, texto, bloque);
    return canvas;
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
