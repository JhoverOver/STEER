import { MAXIMO_NOMBRE_CAPA, checkEspacio, crearClaveCapa } from './capas';

let contenido = [];

export function checkContenido() {
    return contenido.length > 0 && contenido.every((c) => c.blob instanceof Blob);
}

export function copiarCapas(capas) {
    const validas = Array.isArray(capas) && capas.length > 0 && capas.every((c) => c && c.blob instanceof Blob);
    if (!validas) return false;
    contenido = capas.map(({ nombre, visible, bloqueada, blob }) => ({
        nombre, visible: Boolean(visible), bloqueada: Boolean(bloqueada), blob,
    }));
    return true;
}

export function cantidadCopiada() {
    return contenido.length;
}

export function vaciarPortapapelesCapas() {
    contenido = [];
}

export function pegarCapas(capas, claveDebajo) {
    if (!checkContenido() || !checkEspacio(capas, contenido.length)) return { capas, claves: [] };

    const indice = claveDebajo = undefined ? -1 : capas.findIndex((c) => c.clave === claveDebajo);
    const posicion = indice === -1 ? capas.length : indice + 1;
    const nuevas = contenido.map((c) => ({
        clave: crearClaveCapa(),
        nombre: `${c.nombre} copia`.slice(0, MAXIMO_NOMBRE_CAPA),
        visible: c.visible,
        bloqueada: c.bloqueada,
        modificada: true,
        imagen: URL.createObjectURL(c.blob),
    }));
    return {
        capas: [...capas.slice(0, posicion), ...nuevas, ...capas.slice(posicion)],
        claves: nuevas.map((c) => c.clave),
    };
}
