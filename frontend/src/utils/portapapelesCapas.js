import { checkEspacio, crearClaveCapa, copiaDeForma } from './capas';
import {MAXIMO_NOMBRE_CAPA } from '../config/limites';

let contenido = [];

export function checkContenido() {
    return contenido.length > 0 && contenido.every((c) => c.blob instanceof Blob);
}

export function copiarCapas(capas) {
    const validas = Array.isArray(capas) && capas.length > 0 && capas.every((c) => c && c.blob instanceof Blob);
    if (!validas) return false;
    contenido = capas.map(({ nombre, visible, bloqueada, blob, forma }) => ({
        nombre, visible: Boolean(visible), bloqueada: Boolean(bloqueada), blob, forma: copiaDeForma(forma),
    }));
    return true;
}

export function pegarCapas(capas, claveDebajo) {
    if (!checkContenido() || !checkEspacio(capas, contenido.length)) return { capas, claves: [] };

    const indice = claveDebajo === undefined ? -1 : capas.findIndex((c) => c.clave === claveDebajo);
    const posicion = indice === -1 ? capas.length : indice + 1;
    const nuevas = contenido.map((c) => ({
        clave: crearClaveCapa(),
        nombre: `${c.nombre} copia`.slice(0, MAXIMO_NOMBRE_CAPA),
        visible: c.visible,
        bloqueada: c.bloqueada,
        modificada: true,
        imagen: URL.createObjectURL(c.blob),
        ...(c.forma && { forma: c.forma }),
    }));
    return {
        capas: [...capas.slice(0, posicion), ...nuevas, ...capas.slice(posicion)],
        claves: nuevas.map((c) => c.clave),
    };
}
