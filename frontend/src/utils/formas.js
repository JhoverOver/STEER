// Formas: capas que se pueden volver a editar porque guardan cómo son, además de su dibujo (un PNG como cualquier
// capa). Cada cambio (contenido, color, mover, escalar, girar...) vuelve a dibujar la capa desde su forma.
// Los mismos valores que revisa el servidor (be/utils/validarForma.js).
//
//   { tipo: 'texto', contenido, fuente, tamano, color, negrita, cursiva, alineacion, x, y, rotacion, grupo? }
//   { tipo: 'rectangulo', x, y, ancho, alto, rotacion, color, grupo? }
//
// (x, y) es el centro, en píxeles del lienzo (puede quedar fuera de él); la rotación va en grados.
// "grupo" une las copias de una misma forma en varios frames: en Video se cambian todas juntas.
import { FACTOR_AREA_TRABAJO } from '../config/limites';
import { crearCanvas } from './imagenes';
import {
    cajaTexto, dibujarTexto, esquinasTexto, medirBloque, medirTexto, problemaTexto, transformarTexto,
} from './texto';
import { limitar } from './comunes';

export const LADO_RECTANGULO_MAXIMO = 4000;
const NOMBRES = { texto: 'Texto', rectangulo: 'Rectángulo' };

let contadorGrupos = 0;
export function grupoNuevo() {
    contadorGrupos += 1;
    return `g${Date.now().toString(36)}${contadorGrupos}`;
}

export const nombreDeForma = (forma) => NOMBRES[forma?.tipo] || 'Forma';

// Rectángulo entre dos esquinas (arrastrando), sin girar
export function rectanguloEntre(a, b, color) {
    const ancho = Math.max(1, Math.round(Math.abs(b.x - a.x)));
    const alto = Math.max(1, Math.round(Math.abs(b.y - a.y)));
    return {
        tipo: 'rectangulo',
        x: Math.round(Math.min(a.x, b.x) + ancho / 2),
        y: Math.round(Math.min(a.y, b.y) + alto / 2),
        ancho,
        alto,
        rotacion: 0,
        color,
    };
}

// '' si la forma se puede guardar; si no, el motivo
export function problemaForma(forma) {
    if (forma.tipo === 'texto') return problemaTexto(forma);
    if (forma.ancho < 1 || forma.alto < 1) return 'El rectángulo es demasiado chico.';
    return '';
}

// Las 4 esquinas, ya giradas, en píxeles del lienzo
function esquinasDe(forma) {
    if (forma.tipo === 'texto') return esquinasTexto(forma, medirTexto(forma));
    return esquinasTexto(forma, { ancho: forma.ancho, alto: forma.alto });
}

// Rectángulo (en píxeles enteros del lienzo) que envuelve a la forma
export function cajaForma(forma) {
    if (forma.tipo === 'texto') return cajaTexto(forma, medirTexto(forma));
    const esquinas = esquinasDe(forma);
    const xs = esquinas.map((e) => e.x);
    const ys = esquinas.map((e) => e.y);
    const x = Math.floor(Math.min(...xs));
    const y = Math.floor(Math.min(...ys));
    return { x, y, ancho: Math.ceil(Math.max(...xs)) - x, alto: Math.ceil(Math.max(...ys)) - y };
}

// Dibuja la forma en un contexto cuyo origen es el del lienzo
export function dibujarForma(ctx, forma) {
    if (forma.tipo === 'texto') {
        dibujarTexto(ctx, forma, medirBloque(forma));
        return;
    }
    ctx.save();
    ctx.translate(forma.x, forma.y);
    ctx.rotate((forma.rotacion * Math.PI) / 180);
    ctx.fillStyle = forma.color;
    ctx.fillRect(-forma.ancho / 2, -forma.alto / 2, forma.ancho, forma.alto);
    ctx.restore();
}

// El dibujo de la capa: un canvas del tamaño del lienzo o, si la forma se sale, de la zona de trabajo (como las
// demás capas, para no perder lo que queda afuera)
export function canvasDeForma(forma, ancho, alto) {
    const caja = cajaForma(forma);
    const cabe = caja.x >= 0 && caja.y >= 0 && caja.x + caja.ancho <= ancho && caja.y + caja.alto <= alto;
    const canvas = crearCanvas(cabe ? ancho : ancho * FACTOR_AREA_TRABAJO, cabe ? alto : alto * FACTOR_AREA_TRABAJO);
    const ctx = canvas.getContext('2d');
    if (!cabe) ctx.translate(ancho, alto);
    dibujarForma(ctx, forma);
    return canvas;
}

// Aplica una transformación de las manijas ({ dx, dy, escalaX, escalaY, angulo }, alrededor del centro de "region",
// en las mismas coordenadas que la forma): se mueve, cambia de tamaño y gira sin dejar de ser forma
export function transformarForma(forma, region, t) {
    if (forma.tipo === 'texto') return transformarTexto(forma, region, t);
    const movida = transformarTexto({ ...forma, tamano: 10 }, region, t); // centro y giro: la misma cuenta del texto
    return {
        ...forma,
        x: movida.x,
        y: movida.y,
        rotacion: movida.rotacion,
        ancho: limitar(Math.round(forma.ancho * (t.escalaX ?? 1)), 1, LADO_RECTANGULO_MAXIMO),
        alto: limitar(Math.round(forma.alto * (t.escalaY ?? 1)), 1, LADO_RECTANGULO_MAXIMO),
    };
}

// La forma corrida (dx, dy): al cambiar el tamaño del lienzo o al mover una fila en Video
export const moverForma = (forma, dx, dy) => ({ ...forma, x: forma.x + dx, y: forma.y + dy });
