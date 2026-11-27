// Keyframes de una fila de capas (pestaña Video), con un punto rojo que va por encima de la capa. El punto representa
// el movimiento: cada keyframe guarda dónde está el punto en ese momento, su escala y su giro. Lo que tenga la capa
// sigue al punto (se mueve, escala y gira con él, a la misma distancia), pero la capa misma nunca se modifica: la
// transformación se aplica al mostrarla y al armar la imagen del frame. Así aplicar varias veces no acumula nada,
// escalar o girar no pierde calidad, y lo que se dibuje en la capa (en la pestaña Imagen) también sigue al punto.
//
//   animacion: { id, punto: { x, y }, keyframes: [{ tiempo, x, y, escala, giro }], actual? }
//   - punto: dónde está el punto sobre la capa sin transformar (el centro de lo que tenía al crear los keyframes)
//   - keyframes: dónde está el punto en cada momento (px del lienzo), su escala (1 = igual) y su giro (grados)
//   - actual: el estado del punto en el frame de esa capa (lo calcula "Aplicar"; sin él la capa se ve tal cual)
// Cada capa de la fila guarda la animación (con su "actual"), para mostrarla y para volver a editar los keyframes.
// Entre dos keyframes todo avanza en línea recta; después del último queda como en el último, y los frames de antes
// del primero no se tocan.
import { MAX_KEYFRAMES } from '../config/limites';
import { limitar } from './comunes';
import { inicios } from './lineaTiempo';

const ESCALA = [0.01, 100];

let contador = 0;
function idAnimacion() {
    contador += 1;
    return `a${Date.now().toString(36)}${contador}`;
}

const ordenar = (keyframes) => [...keyframes].sort((a, b) => a.tiempo - b.tiempo);
function limpiar({ x, y, escala, giro }) {
    return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        escala: Math.round(limitar(escala, ...ESCALA) * 10000) / 10000,
        giro: Math.round(giro * 100) / 100,
    };
}

// Keyframes nuevos con el punto en "punto" (sin mover, escalar ni girar) en "tiempo"
export function crearAnimacion(tiempo, punto) {
    const quieto = limpiar({ ...punto, escala: 1, giro: 0 });
    return { id: idAnimacion(), punto: { x: quieto.x, y: quieto.y }, keyframes: [{ tiempo, ...quieto }] };
}

// El estado del punto en un momento: entre dos keyframes, en línea recta; antes del primero, el del primero; después
// del último, el del último
export function estadoEn(keyframes, tiempo) {
    const lista = ordenar(keyframes);
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const sinTiempo = ({ x, y, escala, giro }) => ({ x, y, escala, giro });
    if (tiempo <= primero.tiempo) return sinTiempo(primero);
    if (tiempo >= ultimo.tiempo) return sinTiempo(ultimo);
    const siguiente = lista.findIndex((k) => k.tiempo > tiempo);
    const a = lista[siguiente - 1];
    const b = lista[siguiente];
    const p = (tiempo - a.tiempo) / (b.tiempo - a.tiempo);
    const entre = (campo) => a[campo] + (b[campo] - a[campo]) * p;
    return limpiar({ x: entre('x'), y: entre('y'), escala: entre('escala'), giro: entre('giro') });
}

// ---- cambios a los keyframes (devuelven la misma animación si no cambia nada) ----

// Pone (o reemplaza) el keyframe de "tiempo" con el estado "estado"
export function ponerKeyframe(animacion, tiempo, estado) {
    const existente = animacion.keyframes.find((k) => k.tiempo === tiempo);
    if (!existente && animacion.keyframes.length >= MAX_KEYFRAMES) return animacion;
    const resto = animacion.keyframes.filter((k) => k.tiempo !== tiempo);
    return { ...animacion, keyframes: ordenar([...resto, { tiempo, ...limpiar(estado) }]) };
}

// Agrega un keyframe en "tiempo" con el estado que ya tiene el punto en ese momento
export function agregarKeyframe(animacion, tiempo) {
    if (animacion.keyframes.some((k) => k.tiempo === tiempo)) return animacion;
    return ponerKeyframe(animacion, tiempo, estadoEn(animacion.keyframes, tiempo));
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

// Un gesto de las manijas (alrededor de "centro", el centro de la caja que se arrastró) sobre el punto en "estado":
// el punto se lleva con el gesto, y la escala y el giro se suman
export function moverEstado(estado, gesto, centro) {
    const radianes = ((gesto.angulo || 0) * Math.PI) / 180;
    const s = gesto.escalaX ?? 1;
    const rx = (estado.x - centro.x) * s;
    const ry = (estado.y - centro.y) * s;
    return limpiar({
        x: centro.x + (gesto.dx || 0) + rx * Math.cos(radianes) - ry * Math.sin(radianes),
        y: centro.y + (gesto.dy || 0) + rx * Math.sin(radianes) + ry * Math.cos(radianes),
        escala: estado.escala * s,
        giro: estado.giro + (gesto.angulo || 0),
    });
}

// ---- dibujar ----

// La transformación de la capa como matriz de canvas [a, b, c, d, e, f] (p' = (a·x + c·y + e, b·x + d·y + f)), o
// null si la capa se ve tal cual. "estado" (opcional) reemplaza al actual de la capa
export function matrizDe(animacion, estado = animacion?.actual) {
    if (!animacion || !estado) return null;
    const r = (estado.giro * Math.PI) / 180;
    const a = estado.escala * Math.cos(r);
    const b = estado.escala * Math.sin(r);
    const { punto } = animacion;
    return [a, b, -b, a, estado.x - (a * punto.x - b * punto.y), estado.y - (b * punto.x + a * punto.y)];
}

// Aplica la matriz al contexto (que dibuja en píxeles del lienzo)
export function transformarContexto(ctx, matriz) {
    if (matriz) ctx.transform(...matriz);
}

// Un punto de la pantalla (px del lienzo) llevado a la capa sin transformar (para saber qué hay bajo el mouse)
export function aLaCapa(matriz, { x, y }) {
    if (!matriz) return { x, y };
    const [a, b, c, d, e, f] = matriz;
    const det = a * d - b * c;
    const px = x - e;
    const py = y - f;
    return { x: (d * px - c * py) / det, y: (a * py - b * px) / det };
}

// ---- frames ----

// El estado del punto en cada frame que anima: los que empiezan en el primer keyframe o después, con el del momento
// en que empiezan. Devuelve un Map: índice del frame -> estado
export function estadosPorFrame(frames, animacion) {
    const desde = ordenar(animacion.keyframes)[0].tiempo;
    const resultado = new Map();
    inicios(frames).forEach((inicio, indice) => {
        if (inicio >= desde) resultado.set(indice, estadoEn(animacion.keyframes, inicio));
    });
    return resultado;
}

// La animación de la fila (sin el "actual" de una capa): la de la primera capa de la fila que tenga una
export function animacionDeFila(celdas) {
    const capa = celdas.find((c) => c?.animacion);
    if (!capa) return null;
    const { actual, ...animacion } = capa.animacion;
    return animacion;
}
