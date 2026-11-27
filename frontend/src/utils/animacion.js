// Animación de una fila de capas (pestaña Video). Los keyframes no son capas: son puntos en el tiempo que dicen dónde
// está la capa de la fila (movida, escalada y girada desde su lugar original). Al aplicarlos, cada frame desde el
// primer keyframe recibe su capa transformada según el momento en que empieza; después del último keyframe queda
// como en el último, y los frames de antes del primero no se tocan.
//
// Cada capa animada guarda la animación de su fila y su dibujo sin animar ("original", o la forma sin animar en
// animacion.forma), así que volver a aplicar los keyframes siempre parte del dibujo original y no pierde calidad.
// Lo que se dibuje encima en la pestaña Imagen se pierde al volver a aplicarlos.
//
//   animacion: { id, caja, keyframes: [{ tiempo, dx, dy, escalaX, escalaY, angulo }], forma? }
//   capa animada: { ...capa, animacion, original (URL), originalBlob? (si es nuevo), originalDe? (id de la capa
//                   guardada que ya lo tiene) }
// "caja" es la caja de la capa al crear la animación: los keyframes la mueven, y escalan y giran alrededor de su
// centro (en píxeles del lienzo). Los valores de un keyframe son los mismos de las manijas (utils/manijas.js).
import { MAX_KEYFRAMES } from '../config/limites';
import { limitar } from './comunes';
import { inicios } from './lineaTiempo';

export const NEUTRO = { dx: 0, dy: 0, escalaX: 1, escalaY: 1, angulo: 0 };
const CAMPOS = Object.keys(NEUTRO);
const ESCALA = [0.01, 100];

let contador = 0;
export function idAnimacion() {
    contador += 1;
    return `a${Date.now().toString(36)}${contador}`;
}

const ordenar = (keyframes) => [...keyframes].sort((a, b) => a.tiempo - b.tiempo);

function limpiar(valores) {
    return {
        dx: Math.round(valores.dx * 10) / 10,
        dy: Math.round(valores.dy * 10) / 10,
        escalaX: limitar(valores.escalaX, ...ESCALA),
        escalaY: limitar(valores.escalaY, ...ESCALA),
        angulo: Math.round(valores.angulo * 100) / 100,
    };
}

// Animación nueva para la capa con caja "caja": un keyframe sin cambios en "tiempo"
export function crearAnimacion(caja, tiempo) {
    return { id: idAnimacion(), caja, keyframes: [{ tiempo, ...NEUTRO }] };
}

// Los valores en un momento: entre dos keyframes, en línea recta; antes del primero, los del primero; después del
// último, los del último
export function valoresEn(keyframes, tiempo) {
    const lista = ordenar(keyframes);
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (tiempo <= primero.tiempo) return pick(primero);
    if (tiempo >= ultimo.tiempo) return pick(ultimo);
    const siguiente = lista.findIndex((k) => k.tiempo > tiempo);
    const a = lista[siguiente - 1];
    const b = lista[siguiente];
    const p = (tiempo - a.tiempo) / (b.tiempo - a.tiempo);
    const valores = {};
    for (const campo of CAMPOS) valores[campo] = a[campo] + (b[campo] - a[campo]) * p;
    return valores;
}

function pick(keyframe) {
    const valores = {};
    for (const campo of CAMPOS) valores[campo] = keyframe[campo];
    return valores;
}

// Un gesto de las manijas sobre lo que ya está transformado: se suman los movimientos y los giros, y se multiplican
// las escalas (las manijas escalan y giran alrededor del centro de la caja, igual que los keyframes)
export function componer(valores, gesto) {
    return limpiar({
        dx: valores.dx + (gesto.dx || 0),
        dy: valores.dy + (gesto.dy || 0),
        escalaX: valores.escalaX * (gesto.escalaX ?? 1),
        escalaY: valores.escalaY * (gesto.escalaY ?? 1),
        angulo: valores.angulo + (gesto.angulo || 0),
    });
}

// ---- cambios a los keyframes (devuelven la misma animación si no cambia nada) ----

// Pone (o reemplaza) el keyframe de "tiempo" con "valores"
export function ponerKeyframe(animacion, tiempo, valores) {
    const existente = animacion.keyframes.find((k) => k.tiempo === tiempo);
    if (!existente && animacion.keyframes.length >= MAX_KEYFRAMES) return animacion;
    const nuevo = { tiempo, ...limpiar(valores) };
    const resto = animacion.keyframes.filter((k) => k.tiempo !== tiempo);
    return { ...animacion, keyframes: ordenar([...resto, nuevo]) };
}

// Agrega un keyframe en "tiempo" con los valores que ya tiene la animación en ese momento
export function agregarKeyframe(animacion, tiempo) {
    if (animacion.keyframes.some((k) => k.tiempo === tiempo)) return animacion;
    return ponerKeyframe(animacion, tiempo, valoresEn(animacion.keyframes, tiempo));
}

export function moverKeyframe(animacion, desde, hasta) {
    if (desde === hasta || animacion.keyframes.some((k) => k.tiempo === hasta)) return animacion;
    return { ...animacion, keyframes: ordenar(animacion.keyframes.map((k) => (k.tiempo === desde ? { ...k, tiempo: hasta } : k))) };
}

// Una animación conserva al menos un keyframe
export function quitarKeyframe(animacion, tiempo) {
    if (animacion.keyframes.length <= 1) return animacion;
    return { ...animacion, keyframes: animacion.keyframes.filter((k) => k.tiempo !== tiempo) };
}

// ---- frames ----

// Los frames que anima: los que empiezan en el primer keyframe o después, con los valores del momento en que
// empiezan. Devuelve un Map: índice del frame -> valores
export function valoresPorFrame(frames, animacion) {
    const desde = ordenar(animacion.keyframes)[0].tiempo;
    const resultado = new Map();
    inicios(frames).forEach((inicio, indice) => {
        if (inicio >= desde) resultado.set(indice, valoresEn(animacion.keyframes, inicio));
    });
    return resultado;
}

// La animación de la fila: la de la primera capa de la fila que tenga una (null si ninguna)
export function animacionDeFila(celdas) {
    const capa = celdas.find((c) => c?.animacion);
    return capa ? capa.animacion : null;
}

// Lo que se anima de una capa: su dibujo y su forma sin animar
export function baseDe(capa) {
    if (capa.animacion) return { imagen: capa.original || capa.imagen, forma: capa.animacion.forma || null };
    return { imagen: capa.imagen, forma: capa.forma || null };
}
