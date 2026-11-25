// Cálculos de la línea de tiempo de la pestaña Video. Los tiempos van en milisegundos y la escala en
// píxeles por segundo: un frame de 100 ms con escala 200 mide 20 px.
import { DURACION_MINIMA, DURACION_MAXIMA } from '../config/limites';
import { limitar } from './comunes';

export const ESCALA_MINIMA = 20;
export const ESCALA_MAXIMA = 2000;
const PASO_DURACION = 10; // al arrastrar el borde de un frame, la duración avanza de 10 en 10 ms

// Separaciones posibles entre las marcas de la regla; se usa la menor que deje las etiquetas a 60 px o más
const INTERVALOS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000];
const SEPARACION_MINIMA = 60;

export function limitarEscala(escala) {
    return limitar(escala, ESCALA_MINIMA, ESCALA_MAXIMA);
}

// En qué momento empieza cada frame
export function inicios(frames) {
    const lista = [];
    let acumulado = 0;
    for (const frame of frames) {
        lista.push(acumulado);
        acumulado += frame.duracion;
    }
    return lista;
}

export function duracionTotal(frames) {
    return frames.reduce((suma, frame) => suma + frame.duracion, 0);
}

// El frame que se ve en un momento dado. Antes de 0 es el primero; desde el final en adelante, el último
export function indiceEnTiempo(frames, tiempo) {
    let acumulado = 0;
    for (let i = 0; i < frames.length; i++) {
        acumulado += frames[i].duracion;
        if (tiempo < acumulado) return i;
    }
    return Math.max(frames.length - 1, 0);
}

export function aPixeles(tiempo, escala) {
    return (tiempo * escala) / 1000;
}

export function aTiempo(pixeles, escala) {
    return (pixeles * 1000) / escala;
}

// Cada cuántos ms va una marca con número en la regla
export function intervaloRegla(escala) {
    return INTERVALOS.find((ms) => aPixeles(ms, escala) >= SEPARACION_MINIMA) || INTERVALOS[INTERVALOS.length - 1];
}

// "0.35 s", "12.00 s"
export function formatearTiempo(tiempo) {
    return `${(Math.max(tiempo, 0) / 1000).toFixed(2)} s`;
}

// Nueva duración al arrastrar el borde derecho de un frame "desplazamiento" píxeles
export function duracionArrastrada(inicial, desplazamiento, escala) {
    const bruta = inicial + aTiempo(desplazamiento, escala);
    const redondeada = Math.round(bruta / PASO_DURACION) * PASO_DURACION;
    return limitar(redondeada, DURACION_MINIMA, DURACION_MAXIMA);
}