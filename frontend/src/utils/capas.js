export const MAX_CAPAS = 10;
export const MAXIMO_NOMBRE_CAPA = 50;

let contadorClaves = 0;
export function crearClaveCapa() {
    contadorClaves += 1;
    return `capa-${contadorClaves}`;
}

function returnCambio(original, nueva) {
    const igual = original.length === nueva.length && original.every((c, i) => c === nueva[i]);
    return igual ? original : nueva;
}

// Capas que entrega el servidor
export function desdeServidor(capasServidor) {
    return capasServidor.map((c) => ({
        clave: crearClaveCapa(),
        id: c.id,
        nombre: c.nombre,
        visible: c.visible,
        bloqueada: c.bloqueada,
        modificada: false,
        imagen: c.imagen,
    }));
}

// Las capas de un fotograma que aún no se guardó
export function crearFondo() {
    return { clave: crearClaveCapa(), nombre: 'Fondo', visible: true, bloqueada: false, modificada: true };
}

export function checkEspacio(capas, cantidad = 1) {
    return capas.length + cantidad <= MAX_CAPAS;
}

export function checkNombre(nombre) {
    const limpio = typeof nombre === 'string' ? nombre.trim() : '';
    return limpio.length >= 1 && limpio.length <= MAXIMO_NOMBRE_CAPA;
}

// nombres con el primer número que ninguna capa esté usando
export function nombreNuevaCapa(capas) {
    const usados = new Set(capas.map((c) => c.nombre));
    let numero = 1;
    while (usados.has(`Capa ${numero}`)) numero += 1;
    return `Capa ${numero}`;
}

// La capa solo recibe trazos si está visible y desbloqueada
export function capaEditable(capa) {
    return Boolean(capa) && capa.visible && !capa.bloqueada;
}

function indiceDe(capas, clave) {
    return capas.findIndex((c) => c.clave === clave);
}

// Agrega una capa vacía justo encima de la capa "claveDebajo"
export function agregarCapa(capas, claveDebajo) {
    if (!checkEspacio(capas)) return capas;
    const indice = claveDebajo === undefined ? -1 : indiceDe(capas, claveDebajo);
    const posicion = indice === -1 ? capas.length : indice + 1;
    const nueva = { clave: crearClaveCapa(), nombre: nombreNuevaCapa(capas), visible: true, bloqueada: false, modificada: true };
    return [...capas.slice(0, posicion), nueva, ...capas.slice(posicion)];
}

export function agregarCapaConImagen(capas, claveDebajo, { nombre, imagen }) {
    if (!checkEspacio(capas)) return capas;
    const indice = claveDebajo === undefined ? -1 : indiceDe(capas, claveDebajo);
    const posicion = indice === -1 ? capas.length : indice + 1;
    const limpio = checkNombre(nombre) ? nombre.trim() : nombreNuevaCapa(capas);
    const nueva = { clave: crearClaveCapa(), nombre: limpio, visible: true, bloqueada: false, modificada: true, imagen };
    return [...capas.slice(0, posicion), nueva, ...capas.slice(posicion)];
}

// Un fotograma siempre conserva al menos una capa
export function eliminarCapa(capas, clave) {
    if (capas.length <= 1 || indiceDe(capas, clave) === -1) return capas;
    return capas.filter((c) => c.clave !== clave);
}

// Copia la capa justo encima de la original. Esta función solo copia los datos de la capa
export function duplicarCapa(capas, clave) {
    const indice = indiceDe(capas, clave);
    if (indice === -1 || !checkEspacio(capas)) return capas;
    const original = capas[indice];
    const copia = {
        clave: crearClaveCapa(),
        nombre: `${original.nombre} copia`.slice(0, MAXIMO_NOMBRE_CAPA),
        visible: original.visible,
        bloqueada: original.bloqueada,
        modificada: true,
    };
    return [...capas.slice(0, indice + 1), copia, ...capas.slice(indice + 1)];
}

export function renombrarCapa(capas, clave, nombre) {
    if (!checkNombre(nombre)) return capas;
    const limpio = nombre.trim();
    return returnCambio(capas, capas.map((c) => (c.clave === clave && c.nombre !== limpio ? { ...c, nombre: limpio } : c)));
}

export function cambiarVisibilidad(capas, clave) {
    return capas.map((c) => (c.clave === clave ? { ...c, visible: !c.visible } : c));
}

export function bloquearCapa(capas, clave) {
    return capas.map((c) => (c.clave === clave ? { ...c, bloqueada: !c.bloqueada } : c));
}

// Mueve la capa a la posición "destino" (0 = abajo del todo). 
export function reordenarCapas(capas, clave, destino) {
    const origen = indiceDe(capas, clave);
    if (origen === -1 || !Number.isInteger(destino)) return capas;
    const final = Math.min(Math.max(destino, 0), capas.length - 1);
    if (final === origen) return capas;
    const nueva = [...capas];
    const [movida] = nueva.splice(origen, 1);
    nueva.splice(final, 0, movida);
    return nueva;
}

// Avisa que los píxeles de la capa cambiaron: al guardar habrá que subir su PNG
export function marcarModificada(capas, clave) {
    return returnCambio(capas, capas.map((c) => (c.clave === clave && !c.modificada ? { ...c, modificada: true } : c)));
}