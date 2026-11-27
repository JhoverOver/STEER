// Manijas de la caja de los objetos elegidos con "Mover", como en otros editores de imagen:
// cuatro esquinas para escalar y una manija redonda que sobresale arriba para girar.
// Son funciones puras: reciben rectángulos y puntos en píxeles de la zona de trabajo, y el zoom
// (las manijas miden lo mismo en pantalla con cualquier zoom).
// Devuelven transformaciones { dx, dy, escalaX, escalaY, angulo } respecto del centro de la caja (utils/herramientas.js).

import { ESCALA_MINIMA, ESCALA_MAXIMA } from './herramientas';
import { limitar } from './comunes';

export const LADO_MANIJA = 9; // px en pantalla
export const DISTANCIA_GIRO = 26; // px en pantalla entre la caja y la manija de giro
const PASO_GIRO = 15; // grados, al girar con Shift
const MARGEN_TOQUE = 4; // px en pantalla de más para acertarle a una manija
const CAJA_CHICA = 30; // px en pantalla: en una caja más chica, el interior sirve para mover y no para escalar

export const ESQUINAS = ['no', 'ne', 'se', 'so']; // noroeste, noreste, sureste, suroeste
const OPUESTA = { no: 'se', ne: 'so', se: 'no', so: 'ne' };

export const CURSOR_MANIJA = { no: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', so: 'nesw-resize', giro: 'grab' };

export const SIN_TRANSFORMACION = { dx: 0, dy: 0, escalaX: 1, escalaY: 1, angulo: 0 };

function esquina(rect, id) {
    return {
        x: id === 'ne' || id === 'se' ? rect.x + rect.ancho : rect.x,
        y: id === 'se' || id === 'so' ? rect.y + rect.alto : rect.y,
    };
}

// Dónde va cada manija. La de giro sobresale arriba, al centro; si arriba no hay espacio (la caja toca el borde
// de la zona de trabajo), va abajo. "borde" es el punto de la caja del que sale la línea hacia la manija de giro.
export function posicionesManijas(rect, zoom) {
    const distancia = DISTANCIA_GIRO / zoom;
    const arriba = rect.y - distancia >= 0;
    const centroX = rect.x + rect.ancho / 2;
    return {
        no: esquina(rect, 'no'),
        ne: esquina(rect, 'ne'),
        se: esquina(rect, 'se'),
        so: esquina(rect, 'so'),
        giro: { x: centroX, y: arriba ? rect.y - distancia : rect.y + rect.alto + distancia },
        borde: { x: centroX, y: arriba ? rect.y : rect.y + rect.alto },
    };
}

// La manija que está bajo el punto: 'no', 'ne', 'se', 'so', 'giro' o null
export function manijaEnPunto(rect, punto, zoom) {
    const posiciones = posicionesManijas(rect, zoom);
    const alcance = (LADO_MANIJA / 2 + MARGEN_TOQUE) / zoom;
    const cerca = (p) => Math.abs(punto.x - p.x) <= alcance && Math.abs(punto.y - p.y) <= alcance;
    if (cerca(posiciones.giro)) return 'giro';
    // En una caja chica las esquinas taparían el objeto: desde adentro se mueve
    const dentro = punto.x > rect.x && punto.x < rect.x + rect.ancho && punto.y > rect.y && punto.y < rect.y + rect.alto;
    const chica = rect.ancho * zoom < CAJA_CHICA || rect.alto * zoom < CAJA_CHICA;
    if (dentro && chica) return null;
    return ESQUINAS.find((id) => cerca(posiciones[id])) || null;
}

function limitarEje(escala, lado) {
    const minima = Math.max(ESCALA_MINIMA, 1 / lado); // nunca menos de 1 px ni dada vuelta
    return limitar(escala, minima, ESCALA_MAXIMA);
}

// Escalar arrastrando la esquina "id" hasta "punto": la esquina opuesta queda fija.
// Mantiene la proporción, salvo con "libre" (Shift), que estira cada eje por separado.
export function escalaPorEsquina(rect, id, punto, libre = false) {
    const ancla = esquina(rect, OPUESTA[id]);
    const original = esquina(rect, id);
    const diagonal = { x: original.x - ancla.x, y: original.y - ancla.y };
    let escalaX;
    let escalaY;
    if (libre) {
        escalaX = limitarEje((punto.x - ancla.x) / diagonal.x, rect.ancho);
        escalaY = limitarEje((punto.y - ancla.y) / diagonal.y, rect.alto);
    } else {
        // Proyección del mouse sobre la diagonal de la caja: avanza parejo aunque el mouse se desvíe
        const proyeccion = ((punto.x - ancla.x) * diagonal.x + (punto.y - ancla.y) * diagonal.y)
            / (diagonal.x * diagonal.x + diagonal.y * diagonal.y);
        escalaX = limitarEje(proyeccion, Math.min(rect.ancho, rect.alto));
        escalaY = escalaX;
    }
    // El centro se corre para que la esquina opuesta no se mueva
    const centroX = rect.x + rect.ancho / 2;
    const centroY = rect.y + rect.alto / 2;
    return {
        dx: (centroX - ancla.x) * (escalaX - 1),
        dy: (centroY - ancla.y) * (escalaY - 1),
        escalaX,
        escalaY,
        angulo: 0,
    };
}

// Girar arrastrando la manija de giro desde "inicio" hasta "punto", alrededor del centro de la caja.
// Con "ajustar" (Shift) el ángulo va de 15 en 15 grados
export function giroPorManija(rect, inicio, punto, ajustar = false) {
    const centroX = rect.x + rect.ancho / 2;
    const centroY = rect.y + rect.alto / 2;
    const desde = Math.atan2(inicio.y - centroY, inicio.x - centroX);
    const hasta = Math.atan2(punto.y - centroY, punto.x - centroX);
    let angulo = ((hasta - desde) * 180) / Math.PI;
    if (angulo > 180) angulo -= 360;
    if (angulo <= -180) angulo += 360;
    if (ajustar) angulo = Math.round(angulo / PASO_GIRO) * PASO_GIRO;
    return { ...SIN_TRANSFORMACION, angulo };
}

export function esSinTransformacion(t) {
    return t.dx === 0 && t.dy === 0 && t.escalaX === 1 && t.escalaY === 1 && t.angulo % 360 === 0;
}

// ¿El rectángulo queda entero dentro de la zona de trabajo?
export function cabeEnArea(rect, area) {
    return rect.x >= 0 && rect.y >= 0 && rect.x + rect.ancho <= area.ancho && rect.y + rect.alto <= area.alto;
}
// Un gesto de las manijas sobre algo que ya estaba transformado (alrededor del mismo centro): se suman los movimientos
// y los giros, y se multiplican las escalas
export function sumarGestos(t, gesto) {
    return {
        dx: Math.round((t.dx + (gesto.dx || 0)) * 10) / 10,
        dy: Math.round((t.dy + (gesto.dy || 0)) * 10) / 10,
        escalaX: limitar(t.escalaX * (gesto.escalaX ?? 1), ESCALA_MINIMA, ESCALA_MAXIMA),
        escalaY: limitar(t.escalaY * (gesto.escalaY ?? 1), ESCALA_MINIMA, ESCALA_MAXIMA),
        angulo: Math.round((t.angulo + (gesto.angulo || 0)) * 100) / 100,
    };
}
