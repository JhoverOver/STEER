// Keyframes de una capa (pestaña Video), con un punto que va por encima de la capa. Cada keyframe guarda dónde está
// el punto en un momento (x, y, en píxeles del lienzo), su escala (1 = igual) y su giro (grados). Lo que tenga la capa
// sigue al punto; la capa misma no cambia: se muestra transformada. "punto" es dónde está el punto sobre la capa sin
// transformar, y "actual" el estado del punto en el frame de esa capa. Deben coincidir con fe/src/utils/animacion.js.
//
//   { id, punto: { x, y }, keyframes: [{ tiempo, x, y, escala, giro }], actual?: { x, y, escala, giro } }
const { MAX_KEYFRAMES, LADO_MAXIMO, FACTOR_AREA_TRABAJO, DURACION_MAXIMA, MAX_FRAMES } = require('../config/limites');

const LIMITE_POSICION = LADO_MAXIMO * FACTOR_AREA_TRABAJO;
const TIEMPO_MAXIMO = DURACION_MAXIMA * MAX_FRAMES;

const esNumero = (n, minimo, maximo) => typeof n === 'number' && Number.isFinite(n) && n >= minimo && n <= maximo;
const posicion = (n) => esNumero(n, -LIMITE_POSICION, LIMITE_POSICION);
const redondear = (n, decimales) => Math.round(n * 10 ** decimales) / 10 ** decimales;

function validarPunto(p) {
    if (!p || typeof p !== 'object' || !posicion(p.x) || !posicion(p.y)) return null;
    return { x: redondear(p.x, 1), y: redondear(p.y, 1) };
}

// Estado del punto: posición, escala y giro
function validarEstado(e) {
    const punto = validarPunto(e);
    if (!punto || !esNumero(e.escala, 0.01, 100) || !esNumero(e.giro, -36000, 36000)) return null;
    return { ...punto, escala: redondear(e.escala, 4), giro: redondear(e.giro, 2) };
}

function validarKeyframe(k) {
    if (!k || typeof k !== 'object' || !Number.isInteger(k.tiempo) || k.tiempo < 0 || k.tiempo > TIEMPO_MAXIMO) return null;
    const estado = validarEstado(k);
    return estado && { tiempo: k.tiempo, ...estado };
}

// Devuelve { valor } (undefined si no viene, null si se quita) o { error } con el motivo
function validarAnimacion(animacion) {
    if (animacion === undefined) return { valor: undefined };
    if (animacion === null) return { valor: null };
    if (typeof animacion !== 'object' || Array.isArray(animacion)) return { error: 'no es válida.' };
    const { id, punto, keyframes, actual } = animacion;
    if (typeof id !== 'string' || !id || id.length > 40) return { error: 'no tiene un id válido.' };
    const puntoLimpio = validarPunto(punto);
    if (!puntoLimpio) return { error: 'no tiene un punto válido.' };
    if (!Array.isArray(keyframes) || keyframes.length < 1 || keyframes.length > MAX_KEYFRAMES) {
        return { error: `debe tener de 1 a ${MAX_KEYFRAMES} keyframes.` };
    }
    const limpios = keyframes.map(validarKeyframe);
    if (limpios.some((k) => !k)) return { error: 'tiene un keyframe no válido.' };
    limpios.sort((a, b) => a.tiempo - b.tiempo);
    if (limpios.some((k, i) => i > 0 && k.tiempo === limpios[i - 1].tiempo)) return { error: 'tiene dos keyframes en el mismo momento.' };
    const valor = { id, punto: puntoLimpio, keyframes: limpios };
    if (actual !== undefined && actual !== null) {
        const actualLimpio = validarEstado(actual);
        if (!actualLimpio) return { error: 'tiene un estado actual no válido.' };
        valor.actual = actualLimpio;
    }
    return { valor };
}

// Al cambiar el tamaño del lienzo el dibujo se corre (dx, dy): el punto y sus keyframes también
function moverAnimacion(animacion, dx, dy) {
    const correr = (p) => ({ ...p, x: p.x + dx, y: p.y + dy });
    const movida = { ...animacion, punto: correr(animacion.punto), keyframes: animacion.keyframes.map(correr) };
    if (animacion.actual) movida.actual = correr(animacion.actual);
    return movida;
}

module.exports = { validarAnimacion, moverAnimacion };
